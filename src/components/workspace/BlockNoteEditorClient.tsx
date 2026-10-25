"use client";

import dynamic from "next/dynamic";

const NoteEditor = dynamic(() => import("@/src/components/workspace/NoteEditor"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[16rem]" aria-label="Loading note editor" />,
});

export default NoteEditor;
