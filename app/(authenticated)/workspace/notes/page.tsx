"use client";

import NoteEditor from "@/src/components/workspace/NoteEditor";
import { useNotesWorkspace } from "@/src/components/workspace/NotesProvider";

export default function NotesPage() {
  const { loaded, active, update, remove } = useNotesWorkspace();

  if (!loaded) return null;

  if (!active) {
    return (
      <section className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-white/40">
        Choose a note or create one with the plus button.
      </section>
    );
  }

  return (
    <main aria-label="Note editor" className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-4xl flex-col py-2 sm:py-6">
      <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
        <input
          aria-label="Note title"
          value={active.title}
          onChange={(event) => update(active.id, { title: event.target.value })}
          placeholder="Untitled"
          className="min-w-0 flex-1 bg-transparent font-mono text-2xl text-white outline-none placeholder:text-white/30 sm:text-3xl"
        />
        <button
          type="button"
          onClick={() => remove(active.id)}
          aria-label={`Delete ${active.title || "untitled note"}`}
          data-note-delete
          className="rounded-lg px-3 py-2 font-mono text-xs text-white/40 transition hover:bg-white/5 hover:text-red-400"
        >
          DELETE
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <NoteEditor
          key={active.id}
          initialContent={active.content}
          onChange={(html) => update(active.id, { content: html })}
        />
      </div>
    </main>
  );
}