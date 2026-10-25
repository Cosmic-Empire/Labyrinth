"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "./NoteEditorTheme.css";

type Props = {
  initialContent: string;
  onChange: (html: string) => void;
};

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-workspace-theme"] });
  return () => observer.disconnect();
}

function getThemeSnapshot(): "light" | "dark" {
  return document.documentElement.dataset.workspaceTheme === "light" ? "light" : "dark";
}

function getServerThemeSnapshot(): "light" | "dark" {
  return "dark";
}

const noteDictionary: Dictionary = {
  ...en,
  placeholders: {
    ...en.placeholders,
    emptyDocument: "Enter text or type '/' for commands",
  },
};

export default function NoteEditor({ initialContent, onChange }: Props) {
  const editor = useCreateBlockNote({ dictionary: noteDictionary });
  const [ready, setReady] = useState(false);
  const initialContentRef = useRef(initialContent);
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    const html = initialContentRef.current;
    const blocks = html.trim() ? editor.tryParseHTMLToBlocks(html) : [];
    if (blocks.length > 0) {
      editor.replaceBlocks(editor.document.map((block) => block.id), blocks);
    }

    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [editor]);

  return (
    <div className={`note-blocknote h-full min-h-[16rem] ${ready ? "" : "invisible"}`} aria-busy={!ready}>
      <BlockNoteView
        editor={editor}
        theme={theme}
        className="bn-shadcn h-full"
        onChange={(instance) => {
          if (ready) onChange(instance.blocksToFullHTML(instance.document));
        }}
      />
    </div>
  );
}