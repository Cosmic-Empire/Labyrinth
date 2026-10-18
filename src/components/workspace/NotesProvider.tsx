"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { useNotesSync, type NoteSyncStatus } from "@/src/lib/notes-sync";
import type { Note } from "@/src/lib/notes";

type NotesWorkspaceValue = {
  userId: string;
  user: User;
  notes: Note[];
  loaded: boolean;
  status: NoteSyncStatus;
  active: Note | null;
  create: () => string;
  select: (id: string) => void;
  update: (id: string, patch: Partial<Pick<Note, "title" | "content">>) => void;
  remove: (id: string) => void;
};

const NotesWorkspaceContext = createContext<NotesWorkspaceValue | null>(null);

export function NotesProvider({ user, children }: { user: User; children: ReactNode }) {
  const { notes, loaded, status, create: createNote, update, remove } = useNotesSync(user);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes]);
  const requestedNoteId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("note");
  const selectedId = requestedNoteId && sorted.some((note) => note.id === requestedNoteId) ? requestedNoteId : activeId;
  const active = sorted.find((note) => note.id === selectedId) ?? sorted[0] ?? null;

  const create = useCallback(() => {
    const id = createNote();
    setActiveId(id);
    return id;
  }, [createNote]);
  const select = useCallback((id: string) => setActiveId(id), []);

  const value = useMemo(
    () => ({ userId: user.id, user, notes: sorted, loaded, status, active, create, select, update, remove }),
    [user, sorted, loaded, status, active, create, select, update, remove],
  );

  return <NotesWorkspaceContext.Provider value={value}>{children}</NotesWorkspaceContext.Provider>;
}

export function useNotesWorkspace() {
  const context = useContext(NotesWorkspaceContext);
  if (!context) throw new Error("useNotesWorkspace must be used inside NotesProvider.");
  return context;
}
