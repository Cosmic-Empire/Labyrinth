"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/client";
import {
  acknowledgeNote,
  hasMigratedLegacyNotes,
  migrateLegacyNotes,
  queueNote,
  readLocalNotes,
  readPendingNotes,
  readServerClockOffset,
  reconcileLocalNotes,
  writeServerClockOffset,
  type PendingNote,
  type RemoteNote,
} from "@/src/lib/notes-storage";
import type { Note } from "@/src/lib/notes";

export type NoteSyncStatus = "loading" | "saved" | "offline" | "syncing";

type RemoteRow = {
  id: string;
  title: string;
  content: string;
  is_deleted: boolean;
  revision_at: string;
  updated_at: string;
};

function fromRemote(row: RemoteRow, serverClockOffset = 0): RemoteNote {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: Date.parse(row.revision_at) - serverClockOffset,
    deleted: row.is_deleted,
  };
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function useNotesSync(user: User) {
  const [notes, setNotes] = useState<Note[]>([]);
  const noteRevisionSignature = useMemo(() => notes.map((note) => `${note.id}:${note.updatedAt}`).join("|"), [notes]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<NoteSyncStatus>("loading");
  const online = useOnline();
  const notesRef = useRef(notes);
  const syncLock = useRef(false);
  const syncTimer = useRef<number | null>(null);
  const retrySync = useRef<() => void>(() => undefined);
  const userId = user.id;
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => { notesRef.current = notes; }, [notes]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      notesRef.current = [];
      setNotes([]);
      setLoaded(false);
      setStatus("loading");
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (sessionData.session?.user.id !== userId) return;

        const migrated = await hasMigratedLegacyNotes(userId);
        let offset = await readServerClockOffset(userId);
        if (navigator.onLine) {
          const started = Date.now();
          const clock = await supabase.rpc("server_now_ms");
          const midpoint = started + (Date.now() - started) / 2;
          if (!clock.error && Number.isFinite(Number(clock.data))) {
            offset = Number(clock.data) - midpoint;
            await writeServerClockOffset(userId, offset);
          }
        }
        if (!migrated) await migrateLegacyNotes(userId, offset);
        const [local, pending] = await Promise.all([
          readLocalNotes(userId),
          readPendingNotes(userId),
        ]);
        if (cancelled) return;
        notesRef.current = local;
        setNotes(local);
        setLoaded(true);
        setStatus(navigator.onLine ? (pending.length ? "syncing" : "saved") : "offline");

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session || session.user.id !== userId) {
            notesRef.current = [];
            setNotes([]);
            setLoaded(false);
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } catch (loadError) {
        console.error("Unable to load local notes.", loadError);
        if (!cancelled) {
          setLoaded(true);
          setStatus("offline");
        }
      }
    }

    void load();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [supabase, userId]);

  const synchronize = useCallback(async () => {
    if (!online || !loaded || syncLock.current) {
      if (!online && loaded) setStatus("offline");
      return;
    }
    syncLock.current = true;
    let succeeded = false;
    setStatus("syncing");

    try {
      const { data: { user: verifiedUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!verifiedUser || verifiedUser.id !== userId) {
        notesRef.current = [];
        setNotes([]);
        setLoaded(false);
        return;
      }

      const oldOffset = await readServerClockOffset(userId);
      let offset = oldOffset;
      const clockStarted = Date.now();
      const clockBeforeWrites = await supabase.rpc("server_now_ms");
      const clockMidpoint = clockStarted + (Date.now() - clockStarted) / 2;
      if (clockBeforeWrites.error) throw clockBeforeWrites.error;
      if (Number.isFinite(Number(clockBeforeWrites.data))) {
        offset = Number(clockBeforeWrites.data) - clockMidpoint;
        await writeServerClockOffset(userId, offset);
      }

      let pending = await readPendingNotes(userId);
      while (pending.length > 0) {
        const item = pending[0];
        const { data, error } = await supabase.rpc("save_note", {
          p_id: item.id,
          p_title: item.title,
          p_content: item.content,
          p_updated_at_ms: Math.round(item.updatedAt + offset),
          p_is_deleted: item.deleted,
        });
        if (error) throw error;
        const result = data as RemoteRow | RemoteRow[] | null;
        const row = Array.isArray(result) ? result[0] : result;
        if (!row) throw new Error("The notes endpoint returned no saved row.");

        const saved = fromRemote(row, offset);
        const acknowledged = await acknowledgeNote(userId, item, saved);
        if (!acknowledged) {
          notesRef.current = await readLocalNotes(userId);
          setNotes(notesRef.current);
          throw new Error("A newer local edit was kept and will be retried.");
        }

        if (saved.deleted) {
          notesRef.current = notesRef.current.filter((note) => note.id !== saved.id);
        } else {
          const synced: Note = {
            id: saved.id,
            title: saved.title,
            content: saved.content,
            updatedAt: saved.updatedAt,
          };
          notesRef.current = [synced, ...notesRef.current.filter((note) => note.id !== synced.id)];
        }
        setNotes(notesRef.current);
        pending = await readPendingNotes(userId);
      }

      const { data: rows, error: selectError } = await supabase
        .from("notes")
        .select("id,title,content,is_deleted,revision_at,updated_at")
        .eq("user_id", userId);
      if (selectError) throw selectError;
      const remote = ((rows ?? []) as RemoteRow[]).map((row) => fromRemote(row, offset));
      const reconciled = await reconcileLocalNotes(userId, remote);
      notesRef.current = reconciled;
      setNotes(reconciled);
      const unsynced = await readPendingNotes(userId);
      setStatus(unsynced.length ? "syncing" : "saved");
      succeeded = true;
    } catch (syncError) {
      console.error("Unable to sync notes with Supabase.", syncError);
      setStatus("offline");
    } finally {
      syncLock.current = false;
      if (succeeded && navigator.onLine && syncTimer.current === null) {
        const remaining = await readPendingNotes(userId).catch(() => []);
        if (remaining.length > 0) {
          syncTimer.current = window.setTimeout(() => {
            syncTimer.current = null;
            retrySync.current();
          }, 350);
        }
      }
    }
  }, [loaded, online, supabase, userId]);

  useEffect(() => {
    retrySync.current = () => { void synchronize(); };
  }, [synchronize]);

  useEffect(() => {
    if (!loaded || !online) return;
    const refreshSearchEmbeddings = () => {
      void fetch("/api/workspace/search", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) console.warn("Background note search indexing is unavailable.");
        })
        .catch(() => console.warn("Background note search indexing could not connect."));
    };
    refreshSearchEmbeddings();
    const debounce = window.setTimeout(refreshSearchEmbeddings, 900);
    const interval = window.setInterval(refreshSearchEmbeddings, 60_000);
    return () => {
      window.clearTimeout(debounce);
      window.clearInterval(interval);
    };
  }, [loaded, noteRevisionSignature, online]);

  useEffect(() => {
    if (!loaded) return;
    const initialSync = window.setTimeout(() => void synchronize(), 0);
    const retry = () => void synchronize();
    window.addEventListener("online", retry);
    const interval = window.setInterval(retry, 20000);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("online", retry);
      window.clearInterval(interval);
    };
  }, [loaded, synchronize]);

  const enqueue = useCallback((note: PendingNote) => {
    setStatus(navigator.onLine ? "syncing" : "offline");
    void queueNote(userId, note).then(() => {
      if (!navigator.onLine) return;
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        syncTimer.current = null;
        retrySync.current();
      }, 350);
    }).catch((error: unknown) => {
      console.error("Unable to save the note to IndexedDB.", error);
      setStatus("offline");
    });
  }, [userId]);

  const create = useCallback(() => {
    const note: Note = { id: crypto.randomUUID(), title: "", content: "", updatedAt: Date.now() };
    notesRef.current = [note, ...notesRef.current];
    setNotes((current) => [note, ...current]);
    enqueue({ ...note, deleted: false });
    return note.id;
  }, [enqueue]);

  const update = useCallback((id: string, patch: Partial<Pick<Note, "title" | "content">>) => {
    const current = notesRef.current.find((note) => note.id === id);
    if (!current) return;
    const updated = { ...current, ...patch, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    notesRef.current = notesRef.current.map((note) => note.id === id ? updated : note);
    setNotes((items) => items.map((note) => note.id === id ? updated : note));
    enqueue({ ...updated, deleted: false });
  }, [enqueue]);

  const remove = useCallback((id: string) => {
    const current = notesRef.current.find((note) => note.id === id);
    if (!current) return;
    const tombstone: PendingNote = { ...current, updatedAt: Math.max(Date.now(), current.updatedAt + 1), deleted: true };
    notesRef.current = notesRef.current.filter((note) => note.id !== id);
    setNotes((items) => items.filter((note) => note.id !== id));
    enqueue(tombstone);
  }, [enqueue]);

  return { notes, loaded, status, create, update, remove };
}
