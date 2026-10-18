"use client";

import { useRef } from "react";
import { FileUp, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useNotesWorkspace } from "@/src/components/workspace/NotesProvider";
import { DRIVE_ALLOWED_TYPES } from "@/src/lib/drive-constants";

export function DriveUploadButton({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const { create } = useNotesWorkspace();
  const isDrive = pathname === "/drive";

  if (isDrive) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DRIVE_ALLOWED_TYPES.join(",")}
          className="sr-only"
          aria-label="Choose files to upload"
          onChange={(event) => {
            const files = event.currentTarget.files;
            if (files) window.dispatchEvent(new CustomEvent("drive:files-selected", { detail: Array.from(files) }));
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Upload files"
          title="Upload files"
          className={`relative z-20 flex size-10 shrink-0 ${compact ? "" : "translate-x-[calc(-26%+0.75rem)]"} items-center justify-center self-end rounded-full border border-white/15 bg-[#1b1b1b] text-zinc-200 shadow-lg transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e4c42] ${className}`}
        >
          <FileUp className="size-5" />
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={create}
      aria-label="Create new note"
      title="Create new note"
      className={`relative z-20 flex size-10 shrink-0 ${compact ? "" : "translate-x-[calc(-26%+0.75rem)]"} items-center justify-center self-end rounded-full border border-white/15 bg-[#1b1b1b] text-zinc-200 shadow-lg transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 ${className}`}
    >
      <Plus className="size-5" />
    </button>
  );
}
