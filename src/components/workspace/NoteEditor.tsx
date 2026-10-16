"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type Props = {
  initialContent: string;
  onChange: (html: string) => void;
};

export default function NoteEditor({ initialContent, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    immediatelyRender: false, // avoids a Next.js server/client mismatch
    shouldRerenderOnTransaction: true, // keeps toolbar buttons' active state in sync
    editorProps: { attributes: { class: "tiptap h-full focus:outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    `rounded px-2 py-1 font-mono text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
      active ? "bg-[var(--accent)] text-black" : "text-white/70 hover:bg-white/10"
    }`;
  const toggle =
    (action: (instance: Editor) => void) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      action(editor);
    };

  return (
    <div className="flex h-full flex-col">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="mb-3 flex flex-wrap gap-1 border-b border-white/10 pb-3"
      >
        <button
          type="button"
          aria-label="Bold"
          aria-pressed={editor.isActive("bold")}
          className={btn(editor.isActive("bold"))}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle((instance) => instance.chain().focus().toggleBold().run())}
        >
          B
        </button>
        <button
          type="button"
          aria-label="Italic"
          aria-pressed={editor.isActive("italic")}
          className={btn(editor.isActive("italic"))}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle((instance) => instance.chain().focus().toggleItalic().run())}
        >
          I
        </button>
        <button
          type="button"
          aria-label="Heading 1"
          aria-pressed={editor.isActive("heading", { level: 1 })}
          className={btn(editor.isActive("heading", { level: 1 }))}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle((instance) => instance.chain().focus().toggleHeading({ level: 1 }).run())}
        >
          H1
        </button>
        <button
          type="button"
          aria-label="Heading 2"
          aria-pressed={editor.isActive("heading", { level: 2 })}
          className={btn(editor.isActive("heading", { level: 2 }))}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle((instance) => instance.chain().focus().toggleHeading({ level: 2 }).run())}
        >
          H2
        </button>
        <button
          type="button"
          aria-label="Bullet list"
          aria-pressed={editor.isActive("bulletList")}
          className={btn(editor.isActive("bulletList"))}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle((instance) => instance.chain().focus().toggleBulletList().run())}
        >
          • List
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          aria-pressed={editor.isActive("orderedList")}
          className={btn(editor.isActive("orderedList"))}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle((instance) => instance.chain().focus().toggleOrderedList().run())}
        >
          1. List
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}