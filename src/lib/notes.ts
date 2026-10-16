"use client";

import { useCallback, useEffect, useState } from "react";

export type Note = {
  id: string;
  title: string;
  content: string; // HTML from the editor
  updatedAt: number;
};

const KEY = "labyrinth:notes";

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;

  const note = value as Record<string, unknown>;
  return (
    typeof note.id === "string" &&
    typeof note.title === "string" &&
    typeof note.content === "string" &&
    typeof note.updatedAt === "number"
  );
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);

  // load once on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) {
          const stored: unknown = JSON.parse(raw);
          if (Array.isArray(stored)) {
            setNotes(stored.filter(isNote));
          }
        }
      } catch (error) {
        console.error("Unable to load saved notes from local storage.", error);
      } finally {
        setLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Save only after local storage has been read, so the initial empty state
  // cannot overwrite notes before they load.
  useEffect(() => {
    if (!loaded) return;

    try {
      window.localStorage.setItem(KEY, JSON.stringify(notes));
    } catch (error) {
      console.error("Unable to save notes to local storage.", error);
    }
  }, [notes, loaded]);

  const create = useCallback(() => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      content: "",
      updatedAt: Date.now(),
    };
    setNotes((prev) => [note, ...prev]);
    return note.id;
  }, []);

  const update = useCallback((id: string, patch: Partial<Pick<Note, "title" | "content">>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notes, loaded, create, update, remove };
}