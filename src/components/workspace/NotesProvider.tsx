"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNotes } from "@/src/lib/notes";
import type { Note } from "@/src/lib/notes";

type NotesWorkspaceValue = {
  notes: Note[];
  loaded: boolean;
  active: Note | null;
  create: () => string;
  select: (id: string) => void;
  update: (id: string, patch: Partial<Pick<Note, "title" | "content">>) => void;
  remove: (id: string) => void;
};

const NotesWorkspaceContext = createContext<NotesWorkspaceValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const { notes, loaded, create: createNote, update, remove } = useNotes();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sorted = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );
  const active = sorted.find((note) => note.id === activeId) ?? sorted[0] ?? null;

  const create = useCallback(() => {
    const id = createNote();
    setActiveId(id);
    return id;
  }, [createNote]);
  const select = useCallback((id: string) => setActiveId(id), []);

  const value = useMemo(
    () => ({ notes: sorted, loaded, active, create, select, update, remove }),
    [sorted, loaded, active, create, select, update, remove],
  );

  return (
    <NotesWorkspaceContext.Provider value={value}>
      {children}
    </NotesWorkspaceContext.Provider>
  );
}

export function useNotesWorkspace() {
  const context = useContext(NotesWorkspaceContext);
  if (!context) {
    throw new Error("useNotesWorkspace must be used inside NotesProvider.");
  }
  return context;
}
