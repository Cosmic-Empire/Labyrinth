"use client";

import { Cloud, CloudOff, LoaderCircle } from "lucide-react";
import { useNotesWorkspace } from "@/src/components/workspace/NotesProvider";

export function SyncIndicator() {
  const { status } = useNotesWorkspace();
  const presentation = {
    loading: { label: "Loading", Icon: LoaderCircle, motion: "animate-spin", color: "bg-white/30" },
    saved: { label: "Saved", Icon: Cloud, motion: "", color: "bg-emerald-400" },
    offline: { label: "Offline, will sync", Icon: CloudOff, motion: "", color: "bg-amber-300" },
    syncing: { label: "Syncing", Icon: LoaderCircle, motion: "animate-spin", color: "bg-sky-300" },
  }[status];
  const { Icon } = presentation;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Notes: ${presentation.label}`}
      className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-[#1b1b1b]/95 px-3 py-2 text-xs text-zinc-200 shadow-lg backdrop-blur md:right-6 md:top-5"
    >
      <span className={`size-1.5 rounded-full ${presentation.color}`} />
      <Icon className={`size-3.5 text-zinc-300 ${presentation.motion}`} />
      <span>{presentation.label}</span>
    </div>
  );
}
