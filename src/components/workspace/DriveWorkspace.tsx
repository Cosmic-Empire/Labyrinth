"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AudioLines, Check, Clipboard, File, FileImage, FileText, FileUp, Film, GripVertical, HardDrive, LoaderCircle, MoreHorizontal, Pencil, Trash2, UploadCloud, WifiOff, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { PdfThumbnail } from "@/src/components/workspace/PdfThumbnail";
import { toast } from "sonner";
import { useNotesWorkspace } from "@/src/components/workspace/NotesProvider";
import { createClient } from "@/src/lib/supabase/client";
import { cacheDriveFiles, readCachedDriveFiles } from "@/src/lib/drive-cache";
import {
  deleteDriveFile,
  copyDriveFileToClipboard,
  getDriveStorageUsage,
  listDriveFiles,
  uploadDriveFile,
  renameDriveFile,
} from "@/src/lib/drive";
import { DRIVE_ALLOWED_TYPES, DRIVE_STORAGE_LIMIT_BYTES, getDriveFileType, validateDriveFile } from "@/src/lib/drive-constants";
import type { DriveFile, UploadingDriveFile } from "@/src/lib/drive-types";

const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

function formatStorage(size: number): string {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${formatter.format(size / (1024 * 1024))} MB`;
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${formatter.format(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${formatter.format(size / (1024 * 1024))} MB`;
  return `${formatter.format(size / (1024 * 1024 * 1024))} GB`;
}

function FileGlyph({ type }: { type: string }) {
  if (type.startsWith("image/")) return <FileImage className="size-7" />;
  if (type.startsWith("audio/")) return <AudioLines className="size-7" />;
  if (type.startsWith("video/")) return <Film className="size-7" />;
  if (type.includes("pdf") || type.startsWith("text/")) return <FileText className="size-7" />;
  return <File className="size-7" />;
}

function FileTile({
  file,
  selected,
  progress,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dropTarget,
  dragging,
}: {
  file: DriveFile;
  selected: boolean;
  progress?: UploadingDriveFile;
  onSelect: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  dropTarget: boolean;
  dragging: boolean;
}) {
  const uploading = file.status === "uploading" || progress?.status === "uploading";
  const failed = file.status === "failed" || progress?.status === "failed";
  const image = file.type.startsWith("image/") && file.type !== "image/svg+xml";

  return (
    <div
      draggable={file.status === "ready"}
      onClick={onSelect}
      onDoubleClick={() => file.signed_url && window.open(file.signed_url, "_blank", "noopener,noreferrer")}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      role="button"
      tabIndex={0}
      aria-label={`${file.name}, ${formatSize(file.size)}${failed ? ", upload failed" : ""}`}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }}
      data-drive-file-tile
      data-drive-selected={selected || undefined}
      className={`group relative flex h-full min-w-0 cursor-pointer flex-col items-center rounded-2xl border p-4 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e4c42] ${selected ? "border-[var(--drive-selection-border)] bg-[var(--drive-selection)]" : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"} ${dropTarget ? "border-white/50 bg-white/[0.08]" : ""} ${dragging ? "opacity-45" : ""}`}
    >
      <div className="relative mb-3 flex aspect-[4/3] w-full max-w-56 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] text-white/50">
        {file.thumbnail_url ? (
          <Image src={file.thumbnail_url} alt={`Preview of ${file.name}`} fill unoptimized sizes="(max-width: 640px) 45vw, (max-width: 1280px) 24vw, 16vw" className="object-contain" />
        ) : file.type === "application/pdf" && file.signed_url ? (
          <PdfThumbnail url={file.signed_url} name={file.name} />
        ) : image && file.signed_url ? (
          <Image src={file.signed_url} alt={`Preview of ${file.name}`} fill unoptimized sizes="(max-width: 640px) 45vw, (max-width: 1280px) 24vw, 16vw" className="object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/50">
            <FileGlyph type={file.type} />
            <span className="max-w-full truncate px-2 text-[10px] uppercase tracking-wider">{file.name.split(".").pop() || "FILE"}</span>
          </div>
        )}
        {file.status === "ready" && (
          <button type="button" data-drive-menu-button onClick={(event) => { event.stopPropagation(); onContextMenu(event); }} aria-label={`More actions for ${file.name}`} className="absolute right-2 top-2 rounded-lg border border-white/10 bg-black/65 p-1.5 text-white/75 opacity-0 transition hover:bg-black/90 hover:text-white focus:opacity-100 group-hover:opacity-100">
            <MoreHorizontal className="size-4" />
          </button>
        )}
        {uploading && (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-[#0e4c42]">
            <LoaderCircle className="size-4 animate-spin" />
          </span>
        )}
        {failed && <span className="absolute right-2 top-2 rounded-full bg-red-950/80 p-1.5 text-red-300"><X className="size-4" /></span>}
      </div>
      <span className="w-full truncate text-sm text-white/85" title={file.name}>{file.name}</span>
      <span className={`mt-1 text-xs ${failed ? "text-red-300" : "text-white/40"}`}>
        {failed ? progress?.error || "Upload failed" : formatSize(file.size)}
      </span>
      {uploading && (
        <span className="mt-3 w-full" aria-label={`Uploading ${progress?.progress ?? 0}%`}>
          <span className="mb-1 flex items-center justify-between text-[10px] text-white/45">
            <span>Uploading</span><span>{progress?.progress ?? 0}%</span>
          </span>
          <span className="block h-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-[#0e4c42] transition-[width] duration-200" style={{ width: `${progress?.progress ?? 0}%` }} />
          </span>
        </span>
      )}
      {file.status === "ready" && <span className="sr-only">Uploaded</span>}
      <span aria-hidden="true" className="absolute bottom-2 right-2 text-white/20 opacity-0 transition group-hover:opacity-100"><GripVertical className="size-4" /></span>
    </div>
  );
}

export function DriveWorkspace() {
  const { userId } = useNotesWorkspace();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [uploads, setUploads] = useState<UploadingDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageUploadId, setPageUploadId] = useState<string | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissedRequestedFileId, setDismissedRequestedFileId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [menu, setMenu] = useState<{ fileId: string; x: number; y: number } | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const client = useMemo(() => createClient(), []);

  const refresh = useCallback(async (cancelled?: () => boolean) => {
    const next = await listDriveFiles(client, userId);
    if (cancelled?.()) return;
    setFiles(next);
    setStorageUsed(await getDriveStorageUsage(client));
    cacheDriveFiles(userId, next);
  }, [client, userId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      const cached = readCachedDriveFiles(userId);
      setFiles(cached);
      setStorageUsed(cached.filter((file) => file.status === "ready" || file.status === "uploading").reduce((total, file) => total + file.size, 0));
      try {
        await refresh(() => cancelled);
        if (!cancelled) setStorageLoaded(true);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load Drive files.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setStorageLoaded(true);
        }
      }
    });
    return () => { cancelled = true; };
  }, [refresh, userId]);

  const beginUploads = useCallback(async (incoming: File[]) => {
    if (incoming.length === 0) return;
    if (!navigator.onLine) {
      toast.error("You’re offline. Drive files are cached, but uploads need an internet connection.");
      return;
    }

    const accepted: File[] = [];
    for (const file of incoming) {
      const validation = validateDriveFile(file);
      if (validation) toast.error(`${file.name}: ${validation}`);
      else accepted.push(file);
    }

    const pendingUsage = accepted.reduce((total, file) => total + file.size, 0);
    if (!storageLoaded || storageUsed + pendingUsage > DRIVE_STORAGE_LIMIT_BYTES) {
      toast.error("These files would exceed your 500 MB Drive storage limit.");
      return;
    }

    const placeholders = accepted.map((file, index) => {
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180) || "file";
      return {
        id,
        user_id: userId,
        name: file.name,
        type: getDriveFileType(file)!,
        size: file.size,
        storage_path: `${userId}/${id}/${safeName}`,
        thumbnail_path: null,
        note_id: null,
        status: "uploading" as const,
        extracted_text: null,
        created_at: new Date().toISOString(),
        sort_order: Date.now() + index,
        is_deleted: false,
      };
    });
    setFiles((current) => [...current, ...placeholders]);
    setStorageUsed((current) => Math.min(DRIVE_STORAGE_LIMIT_BYTES, current + accepted.reduce((total, file) => total + file.size, 0)));
    setUploads((current) => [...current, ...accepted.map((file, index) => ({
      id: placeholders[index].id, name: file.name, type: file.type, size: file.size, progress: 0, status: "uploading" as const,
    }))]);

    await Promise.all(accepted.map(async (file, index) => {
      const placeholder = placeholders[index];
      setPageUploadId(placeholder.id);
      try {
        await uploadDriveFile(client, userId, file, (progress) => {
          setUploads((current) => current.map((upload) => upload.id === placeholder.id ? { ...upload, progress } : upload));
        }, placeholder.id);
        setUploads((current) => current.filter((upload) => upload.id !== placeholder.id));
        setPageUploadId((current) => current === placeholder.id ? null : current);
        await refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setFiles((current) => current.map((item) => item.id === placeholder.id ? { ...item, status: "failed" } : item));
        setStorageUsed((current) => Math.max(0, current - placeholder.size));
        setUploads((current) => current.map((upload) => upload.id === placeholder.id ? { ...upload, status: "failed", error: message } : upload));
        setPageUploadId((current) => current === placeholder.id ? null : current);
        toast.error(`${file.name}: ${message}`);
      }
    }));
  }, [client, refresh, storageLoaded, storageUsed, userId]);

  useEffect(() => {
    const selected = (event: Event) => {
      const custom = event as CustomEvent<File[]>;
      void beginUploads(custom.detail ?? []);
    };
    window.addEventListener("drive:files-selected", selected);
    return () => window.removeEventListener("drive:files-selected", selected);
  }, [beginUploads]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        setRenameId(null);
      }
    };
    const dismiss = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-drive-file-tile], [data-drive-context-menu]")) return;
      setMenu(null);
      setSelectedId(null);
      setDismissedRequestedFileId(searchParams.get("file"));
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("click", dismiss, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("click", dismiss, true);
    };
  }, [searchParams]);

  const menuFile = files.find((file) => file.id === menu?.fileId);
  const uploadById = useMemo(() => new Map(uploads.map((upload) => [upload.id, upload])), [uploads]);
  const orderedFiles = useMemo(() => [...files].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)), [files]);

  const requestedFileId = searchParams.get("file");
  const effectiveSelectedId = requestedFileId && requestedFileId !== dismissedRequestedFileId && files.some((file) => file.id === requestedFileId) ? requestedFileId : selectedId;

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    void beginUploads(Array.from(event.dataTransfer.files));
  };

  const persistOrder = async (nextFiles: DriveFile[]) => {
    const updates = nextFiles.map((file, index) => ({ id: file.id, sort_order: (index + 1) * 1000 }));
    const results = await Promise.all(updates.map(({ id, sort_order }) =>
      client.from("files").update({ sort_order }).eq("id", id).eq("user_id", userId),
    ));
    const failed = results.find((result) => result.error)?.error;
    if (failed) throw failed;
    const reordered = nextFiles.map((file, index) => ({ ...file, sort_order: (index + 1) * 1000 }));
    setFiles(reordered);
    cacheDriveFiles(userId, reordered);
  };

  const reorderFile = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const next = [...orderedFiles];
    const sourceIndex = next.findIndex((file) => file.id === sourceId);
    const targetIndex = next.findIndex((file) => file.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setFiles(next.map((file, index) => ({ ...file, sort_order: (index + 1) * 1000 })));
    void persistOrder(next).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not save file order.");
      void refresh();
    });
  };

  const handleRename = async () => {
    if (!renameId) return;
    const fileToRename = files.find((file) => file.id === renameId);
    if (!fileToRename) return;
    try {
      await renameDriveFile(client, userId, fileToRename, renameValue);
      setRenameId(null);
      await refresh();
      toast.success("File renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename file.");
    }
  };

  const handleCopy = async (file: DriveFile) => {
    setCopyingId(file.id);
    setMenu(null);
    try {
      await copyDriveFileToClipboard(file);
      toast.success(file.type.startsWith("text/") || file.type === "application/json"
        ? "File contents copied to clipboard."
        : file.type.startsWith("image/") && file.type !== "image/svg+xml"
          ? "Image copied to clipboard."
          : "File link copied to clipboard.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not copy file.");
    } finally {
      setCopyingId(null);
    }
  };

  const handleDelete = async (file: DriveFile) => {
    if (!window.confirm(`Delete “${file.name}”? This can’t be undone.`)) return;
    try {
      await deleteDriveFile(client, userId, file);
      const remaining = files.filter((item) => item.id !== file.id);
      setFiles(remaining);
      if (file.status === "ready" || file.status === "uploading") setStorageUsed((current) => Math.max(0, current - file.size));
      cacheDriveFiles(userId, remaining);
      setMenu(null);
      setSelectedId(null);
      setRenameId(null);
      toast.success("File deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete file.");
    }
  };

  const beginRename = (file: DriveFile) => {
    setSelectedId(file.id);
    setRenameId(file.id);
    setRenameValue(file.name);
    setMenu(null);
    window.setTimeout(() => document.getElementById("drive-rename-input")?.focus(), 0);
  };

  return (
    <section
      className="relative min-h-[calc(100vh-3.5rem)]"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragCounter.current += 1;
        setDragActive(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) { dragCounter.current = 0; setDragActive(false); }
      }}
      onDrop={onDrop}
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Drive</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={DRIVE_ALLOWED_TYPES.join(",")}
            className="sr-only"
            aria-label="Choose files to upload"
            onChange={(event) => {
              if (event.currentTarget.files) void beginUploads(Array.from(event.currentTarget.files));
              event.currentTarget.value = "";
            }}
          />
          <button type="button" onClick={() => inputRef.current?.click()} aria-label="Upload files" title="Upload files" className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-[#1b1b1b] text-zinc-200 shadow-lg transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e4c42]">
            {pageUploadId ? <LoaderCircle className="size-5 animate-spin text-[#6db4a7]" /> : <FileUp className="size-5" />}
          </button>
          <div className="w-full min-w-44 max-w-64 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 sm:w-56">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] text-white/55">
              <span className="flex items-center gap-1.5"><HardDrive className="size-3.5" /> Storage</span>
              <span>{storageLoaded ? `${formatStorage(storageUsed)} / 500 MB` : "Loading storage…"}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Drive storage used"
              aria-valuemin={0}
              aria-valuemax={DRIVE_STORAGE_LIMIT_BYTES}
              aria-valuenow={Math.min(storageUsed, DRIVE_STORAGE_LIMIT_BYTES)}
              aria-valuetext={storageLoaded ? `${formatStorage(storageUsed)} of 500 MB used` : "Loading storage usage"}
              data-drive-storage-bar
              className="h-1.5 overflow-hidden rounded-full bg-white/10"
              aria-busy={!storageLoaded}
            >
              <div className={`h-full rounded-full transition-[width] ${storageUsed >= DRIVE_STORAGE_LIMIT_BYTES ? "bg-rose-400" : "bg-[#679889]"}`} style={{ width: `${Math.min(100, (storageUsed / DRIVE_STORAGE_LIMIT_BYTES) * 100)}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/45">
            {online ? <span className="size-1.5 rounded-full bg-emerald-400" /> : <WifiOff className="size-3.5" />}
            {online ? `${files.filter((file) => file.status === "ready").length} files` : "Offline · cached list"}
          </div>
        </div>
      </header>

      {!online && (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/80">
          <WifiOff className="size-4 shrink-0" /> You’re offline. Cached file details remain available; uploads and previews need a connection.
        </div>
      )}

      {loading && orderedFiles.length === 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] auto-rows-fr gap-6 sm:gap-7 lg:gap-8">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-[1.15/1.35] animate-pulse rounded-2xl border border-white/5 bg-white/[0.025]" />)}
        </div>
      ) : orderedFiles.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-6 text-center">
          <h2 className="font-mono text-lg text-white/85">Your Drive is ready</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/45">Drop files here or use Upload file to add your first document, image, audio recording, or video.</p>

        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">All files</h2>
            <span className="text-xs text-white/35">Drag files to reorder</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] auto-rows-fr gap-6 sm:gap-7 lg:gap-8">
            {orderedFiles.map((file) => (
              <div key={file.id} className="relative min-w-0">
                {renameId === file.id ? (
                  <div className="rounded-2xl border border-[#0e4c42]/70 bg-white/[0.04] p-3">
                    <div className="mb-3 flex aspect-[1.15/0.9] items-center justify-center rounded-xl bg-white/[0.035] text-white/40"><FileGlyph type={file.type} /></div>
                    <form onSubmit={(event) => { event.preventDefault(); void handleRename(); }} className="flex gap-1">
                      <input id="drive-rename-input" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2 py-1 text-xs text-white outline-none focus:border-[#0e4c42]" aria-label="New file name" />
                      <button type="submit" aria-label="Save name" className="rounded-md bg-[#0e4c42] p-1.5 text-white"><Check className="size-3.5" /></button>
                    </form>
                  </div>
                ) : (
                  <FileTile
                    file={file}
                    selected={effectiveSelectedId === file.id}
                    progress={uploadById.get(file.id)}
                    onSelect={() => setSelectedId(file.id)}
                    dropTarget={dropTargetId === file.id}
                    dragging={draggedId === file.id}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelectedId(file.id);
                      const tile = event.currentTarget.closest<HTMLElement>("[data-drive-file-tile]") ?? event.currentTarget;
                      const rect = tile.getBoundingClientRect();
                      const menuWidth = 192;
                      setMenu({
                        fileId: file.id,
                        x: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
                        y: Math.max(8, Math.min(rect.top + 8, window.innerHeight - 160)),
                      });
                    }}
                    onDragStart={(event) => {
                      setDraggedId(file.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", file.id);
                    }}
                    onDragOver={(event) => {
                      if (draggedId && draggedId !== file.id) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTargetId(file.id);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
                      if (sourceId) reorderFile(sourceId, file.id);
                      setDraggedId(null);
                      setDropTargetId(null);
                    }}
                    onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {menu && menuFile && createPortal(
        <div
          role="menu"
          data-drive-context-menu
          aria-label={`Actions for ${menuFile.name}`}
          className="fixed z-[100] w-48 overflow-hidden rounded-xl border border-white/10 bg-[#191918] p-1.5 shadow-2xl shadow-black/50"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button role="menuitem" type="button" onClick={() => void handleCopy(menuFile)} disabled={copyingId === menuFile.id} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/[0.07] disabled:opacity-50"><Clipboard className="size-4 text-white/45" /> Copy</button>
          <button role="menuitem" type="button" onClick={() => beginRename(menuFile)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/[0.07]"><Pencil className="size-4 text-white/45" /> Rename</button>
          <div className="my-1 h-px bg-white/10" />
          <button role="menuitem" type="button" data-destructive onClick={() => void handleDelete(menuFile)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10"><Trash2 className="size-4" /> Delete</button>
        </div>,
        document.body,
      )}

      {dragActive && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm" aria-live="polite">
          <div className="relative flex w-full max-w-lg flex-col items-center rounded-3xl border border-white/15 bg-[#111413] px-8 py-12 text-center shadow-2xl shadow-black/50">
            <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] text-[#a8c8c0]">
              <UploadCloud className="size-6" />
            </div>
            <h2 className="font-mono text-2xl text-white">Drop to upload</h2>
            <p className="mt-2 text-sm text-white/50">Files will be added to your Drive in upload order.</p>
            <span className="mt-6 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/40">Up to 100 MB per file</span>
            <button type="button" onClick={() => { dragCounter.current = 0; setDragActive(false); }} className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/30 p-2 text-white/60 hover:text-white" aria-label="Cancel drop"><X className="size-5" /></button>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
