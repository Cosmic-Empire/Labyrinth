"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { ArrowDown, ArrowUp, Command, FileText, Files, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useNotesWorkspace } from "@/src/components/workspace/NotesProvider";
import { createClient } from "@/src/lib/supabase/client";
import { readCachedDriveFiles } from "@/src/lib/drive-cache";
import type { DriveFile } from "@/src/lib/drive-types";
import type { Note } from "@/src/lib/notes";

type SearchKind = "note" | "file" | "report";
type SearchResult = { kind: SearchKind; source_type: "note" | "file"; id: string; title: string; snippet: string; updated_at: string; rank: number; offline?: boolean };
type PaletteItem = { id: string; kind: SearchKind | "command" | "ask"; target?: "note" | "file"; title: string; snippet: string; query?: string };

const OPEN_EVENT = "workspace:open-search";
const CLOSE_MS = 220;
const SEARCH_BUTTON_CLASS = "relative z-20 flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 self-end rounded-full border border-white/15 bg-[#1b1b1b] px-2.5 text-zinc-200 shadow-lg transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:min-w-10 group-data-[collapsible=icon]:px-0";
const COMMANDS: PaletteItem[] = [
  { id: "command:new-note", kind: "command", title: "New note", snippet: "Create a note and start writing" },
  { id: "command:files", kind: "command", title: "Go to Files", snippet: "Open your workspace Drive" },
  { id: "command:settings", kind: "command", title: "Open settings", snippet: "Manage your account and preferences" },
];

export function WorkspaceSearchTrigger({ className = "" }: { className?: string }) {
  return <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} aria-label="Search workspace (⌘K / Ctrl+K)" title="Search workspace (⌘K / Ctrl+K)" className={`${SEARCH_BUTTON_CLASS} ${className}`}><Search aria-hidden="true" className="size-4" /><span className="text-[10px] text-white/55 group-data-[collapsible=icon]:hidden">⌘K</span></button>;
}

function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function localSearch(notes: Note[], files: DriveFile[], query: string): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase();
  const matches: SearchResult[] = [
    ...notes.map((note) => ({
      kind: /\b(report|lab record)\b/i.test(note.title) ? "report" as const : "note" as const,
      source_type: "note" as const,
      id: note.id,
      title: note.title || "Untitled note",
      snippet: plainText(note.content),
      updated_at: new Date(note.updatedAt).toISOString(),
      rank: note.updatedAt,
      offline: true,
    })),
    ...files.filter((file) => file.status === "ready" && !file.is_deleted).map((file) => ({
      kind: /\b(report|lab record)\b/i.test(file.name) ? "report" as const : "file" as const,
      source_type: "file" as const,
      id: file.id,
      title: file.name,
      snippet: file.name,
      updated_at: file.created_at,
      rank: Date.parse(file.created_at) || 0,
      offline: true,
    })),
  ];
  return matches.filter((result) => !normalized || `${result.title} ${result.snippet}`.toLocaleLowerCase().includes(normalized))
    .sort((a, b) => b.rank - a.rank).slice(0, 30);
}

function SearchIcon({ kind, target }: { kind: PaletteItem["kind"]; target?: PaletteItem["target"] }) {
  if (kind === "file" || (kind === "report" && target === "file")) return <Files aria-hidden="true" className="size-4 shrink-0 text-white/45" />;
  if (kind === "ask") return <Sparkles aria-hidden="true" className="size-4 shrink-0 text-[#c9c7bd]" />;
  if (kind === "command") return <Command aria-hidden="true" className="size-4 shrink-0 text-white/45" />;
  return <FileText aria-hidden="true" className="size-4 shrink-0 text-white/45" />;
}

function highlightQuery(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const terms = query.trim().split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return <>{text}</>;
  return <>{text.split(new RegExp(`(${terms.join("|")})`, "ig")).map((part, index) => terms.some((term) => new RegExp(`^${term}$`, "i").test(part)) ? <mark key={index} className="rounded bg-white/15 text-white">{part}</mark> : <span key={index}>{part}</span>)}</>;
}

function renderSnippet(snippet: string) {
  return <>{snippet.split(/(<b>[\s\S]*?<\/b>)/gi).map((part, index) => {
    const match = part.match(/^<b>([\s\S]*)<\/b>$/i);
    return match ? <mark key={index} className="rounded bg-white/15 text-white">{match[1]}</mark> : <span key={index}>{part}</span>;
  })}</>;
}

export function WorkspaceSearch() {
  const router = useRouter();
  const { userId, notes, loaded, create, select } = useNotesWorkspace();
  const client = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
  const [mergedResults, setMergedResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const openRef = useRef(false);
  const searchTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resultListRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const lastFocus = useRef<HTMLElement | null>(null);
  const activePosition = useRef(0);

  const openPalette = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestId.current += 1;
    setMounted(true);
    setOpen(true);
    setQuery("");
    setResults([]);
    setSemanticResults([]);
    setMergedResults([]);
    setLoading(false);
    setSemanticLoading(false);
    setSearchError("");
    activePosition.current = 0;
    setActiveIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    requestId.current += 1;
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    setOpen(false);
    setQuery("");
    setResults([]);
    setSemanticResults([]);
    setMergedResults([]);
    setLoading(false);
    setSemanticLoading(false);
    setSearchError("");
    window.requestAnimationFrame(() => lastFocus.current?.focus());
  }, []);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    const onOpen = () => openPalette();
    const isTypingTarget = (target: EventTarget | null) => target instanceof HTMLElement &&
      (target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")));
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openPalette();
      } else if (openRef.current && event.key === "Escape") {
        event.preventDefault();
        closePalette();
      } else if (!openRef.current && event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener(OPEN_EVENT, onOpen); window.removeEventListener("keydown", onKeyDown); };
  }, [closePalette, openPalette]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => setMounted(false), CLOSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const performSearch = useCallback(async (value: string, scheduledRequest?: number) => {
    if (!openRef.current || !loaded) return;
    const currentRequest = scheduledRequest ?? requestId.current;
    if (currentRequest !== requestId.current || value.length > 512) return;
    const term = value.trim();
    try {
      if (!navigator.onLine) {
        const cachedFiles = readCachedDriveFiles(userId);
        const local = localSearch(notes, cachedFiles, term);
        if (currentRequest === requestId.current) {
          setResults(local);
          setSearchError("Offline search uses cached notes and file names only.");
        }
      } else {
        const { data, error } = await client.rpc("search_workspace", { p_query: term || null, p_limit: 30 });
        if (error) throw error;
        if (currentRequest === requestId.current && openRef.current) setResults((data ?? []) as SearchResult[]);
      }
    } catch {
      if (currentRequest !== requestId.current || !openRef.current) return;
      const cachedFiles = readCachedDriveFiles(userId);
      setResults(localSearch(notes, cachedFiles, term));
      setSearchError(!navigator.onLine ? "Offline search uses cached notes and file names only." : "Showing cached notes and file names while server search is unavailable.");
    } finally {
      if (currentRequest === requestId.current && openRef.current) {
        setLoading(false);
      }
    }
  }, [client, loaded, notes, userId]);

  const performSemanticSearch = useCallback(async (value: string, scheduledRequest: number) => {
    const term = value.trim();
    if (!term || term.length > 512 || !navigator.onLine || scheduledRequest !== requestId.current || !openRef.current) return;
    setSemanticLoading(true);
    try {
      const pendingNotes = notes.filter((note) => note.title.trim() || plainText(note.content).trim());
      const response = await fetch("/api/workspace/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({ query: term, noteIds: pendingNotes.map((note) => note.id).slice(0, 100) }),
      });
      const payload = await response.json() as { semantic?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Semantic search is currently unavailable.");
      if (scheduledRequest !== requestId.current || !openRef.current) return;
      const merged = await client.rpc("merge_workspace_search_ranks", {
        p_keyword: results.filter((item) => !item.offline).map((item) => ({ source_type: item.source_type, id: item.id })),
        p_semantic: (payload.semantic ?? []).map((item) => ({ source_type: item.source_type, id: item.id })),
        p_limit: 30,
      });
      if (merged.error) throw merged.error;
      const order = new Map<string, number>((merged.data ?? []).map((item: { source_type: string; id: string }, index: number) => [`${item.source_type}:${item.id}`, index]));
      const onlineResults = [...results.filter((item) => !item.offline), ...(payload.semantic ?? []).filter((item) => !results.some((keyword) => keyword.source_type === item.source_type && keyword.id === item.id))]
        .sort((left, right) => (order.get(`${left.source_type}:${left.id}`) ?? Number.MAX_SAFE_INTEGER) - (order.get(`${right.source_type}:${right.id}`) ?? Number.MAX_SAFE_INTEGER));
      const combined = [...onlineResults, ...results.filter((item) => item.offline)];
      setSemanticResults((payload.semantic ?? []).filter((item) => !results.some((keyword) => keyword.source_type === item.source_type && keyword.id === item.id)));
      setMergedResults(combined);
      setSearchError("");
    } catch {
      if (scheduledRequest !== requestId.current || !openRef.current) return;
      setSearchError("Semantic search is unavailable right now; showing keyword results.");
    } finally {
      if (scheduledRequest === requestId.current && openRef.current) setSemanticLoading(false);
    }
  }, [client, notes, results]);

  useEffect(() => {
    if (!open || !loaded) return;
    const searchId = ++requestId.current;
    activePosition.current = 0;
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null;
      setActiveIndex(0);
      setLoading(true);
      setSemanticResults([]);
      setSearchError("");
      void performSearch(query, searchId);
    }, query.trim() ? 140 : 0);
    return () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    };
  }, [loaded, open, performSearch, query]);

  useEffect(() => {
    if (!open || !loaded || !query.trim() || !isOnline) return;
    const currentRequest = requestId.current;
    const timer = window.setTimeout(() => {
      if (requestId.current === currentRequest && openRef.current) {
        void performSemanticSearch(query, currentRequest);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isOnline, loaded, open, performSemanticSearch, query]);

  const combinedResults = useMemo(() => mergedResults.length ? mergedResults : [...results, ...semanticResults], [mergedResults, results, semanticResults]);
  const resultItems = useMemo<PaletteItem[]>(() => combinedResults.map((result) => ({
    id: `${result.kind}:${result.id}`,
    kind: result.kind,
    target: result.source_type,
    title: result.title,
    snippet: `${result.snippet || (result.kind === "file" ? "File name searchable; contents are not extracted yet." : "No preview available.")}${result.offline && result.kind === "file" ? " · Offline: file names only; contents aren’t cached." : ""}`,
    query,
  })), [combinedResults, query]);
  const commands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const aliases: Record<string, string> = {
      "new note": "command:new-note", "create note": "command:new-note", "new file": "command:new-note",
      files: "command:files", drive: "command:files", "go to files": "command:files",
    };
    const exactMatch = aliases[normalized];
    return COMMANDS.filter((item) => !normalized ||
      `${item.title} ${item.snippet}`.toLocaleLowerCase().includes(normalized) || item.id === exactMatch);
  }, [query]);
  const askItem: PaletteItem[] = query.trim() ? [{ id: "ask-labora", kind: "ask", title: `Ask Labora: ${query.trim()}`, snippet: "Send this question to your workspace assistant", query: query.trim() }] : [];
  const groups = useMemo(() => ([
    { kind: "note", label: "Notes" }, { kind: "file", label: "Files" }, { kind: "report", label: "Reports" },
  ] as const).map((group) => ({ ...group, items: resultItems.filter((item) => item.kind === group.kind) })).filter((group) => group.items.length > 0), [resultItems]);
  const items = [...groups.flatMap((group) => group.items), ...commands, ...askItem];
  const resultsLoading = loading || semanticLoading;

  useEffect(() => {
    const nextIndex = Math.min(activePosition.current, Math.max(items.length - 1, 0));
    activePosition.current = nextIndex;
    if (activeIndex !== nextIndex) setActiveIndex(nextIndex);
  }, [activeIndex, items.length]);
  useEffect(() => {
    const container = resultListRef.current;
    const activeElement = resultRefs.current[activeIndex];
    if (!container || !activeElement) return;
    const elementRect = activeElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (elementRect.bottom > containerRect.bottom) container.scrollTop += elementRect.bottom - containerRect.bottom;
    else if (elementRect.top < containerRect.top) container.scrollTop -= containerRect.top - elementRect.top;
  }, [activeIndex]);

  function moveActive(direction: -1 | 1) {
    const currentIndex = Math.min(activePosition.current, Math.max(items.length - 1, 0));
    const nextIndex = items.length ? (currentIndex + direction + items.length) % items.length : 0;
    activePosition.current = nextIndex;
    setActiveIndex(nextIndex);
  }

  function openItem(item: PaletteItem) {
    if (item.kind === "command" && item.id === "command:new-note") {
      const id = create();
      closePalette();
      router.push(`/workspace/notes?note=${encodeURIComponent(id)}`);
      return;
    }
    if (item.kind === "command" && item.id === "command:files") {
      closePalette();
      router.push("/drive");
      return;
    }
    if (item.kind === "command" && item.id === "command:settings") {
      closePalette();
      router.push("/settings");
      return;
    }
    if (item.kind === "ask") {
      closePalette();
      window.dispatchEvent(new CustomEvent("labora:ask", { detail: item.query ?? query.trim() }));
      return;
    }
    if (item.kind === "note" || (item.kind === "report" && item.target !== "file")) {
      const id = item.id.slice(item.id.indexOf(":") + 1);
      select(id);
      closePalette();
      router.push(`/workspace/notes?note=${encodeURIComponent(id)}`);
      return;
    }
    if (item.kind === "file" || (item.kind === "report" && item.target === "file")) {
      const id = item.id.slice(item.id.indexOf(":") + 1);
      closePalette();
      router.push(`/drive?file=${encodeURIComponent(id)}`);
    }
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); closePalette(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); moveActive(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); moveActive(-1); }
    else if (event.key === "Enter") {
      event.preventDefault();
      if (query.trim()) {
        if (searchTimer.current !== null) {
          window.clearTimeout(searchTimer.current);
          searchTimer.current = null;
          const searchId = ++requestId.current;
          setLoading(true);
          void performSearch(query, searchId);
        }
        void performSemanticSearch(query, requestId.current);
        return;
      }
      if (resultsLoading) return;
      if (items[activeIndex]) openItem(items[activeIndex]);
    }
  }

  if (!mounted) return null;
  let flatIndex = 0;
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) closePalette(); }}>
    <DialogContent aria-labelledby="workspace-search-title" showCloseButton={false} className="top-[12vh] flex max-h-[min(72vh,44rem)] w-[calc(100%-2rem)] max-w-2xl translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border-white/10 bg-[#151514]/[0.98] p-0 shadow-2xl shadow-black/60 duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 sm:top-[16vh] sm:max-w-2xl">
      <DialogHeader className="sr-only"><DialogTitle id="workspace-search-title">Search workspace</DialogTitle><DialogDescription>Search recent workspace notes and files, run workspace actions, or ask Labora a question.</DialogDescription></DialogHeader>
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4"><Search aria-hidden="true" className="size-5 shrink-0 text-white/45" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value.slice(0, 512))} onKeyDown={onInputKeyDown} placeholder="Search notes, files, reports, or actions…" aria-label="Search notes, files, and reports" data-theme-search-input maxLength={512} aria-controls="workspace-search-results" aria-activedescendant={items[activeIndex] ? `workspace-search-option-${activeIndex}` : undefined} autoComplete="off" className="h-14 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/35" />{(loading || semanticLoading) && <LoaderCircle aria-label="Searching" className="size-4 animate-spin text-white/40" />}<button type="button" onClick={closePalette} aria-label="Close search" className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/45 transition hover:bg-white/10 hover:text-white">ESC</button></div>
      <div id="workspace-search-results" ref={resultListRef} role="listbox" aria-label="Search results" aria-busy={resultsLoading} className="min-h-0 overflow-y-auto p-2">
        {!query.trim() && <p className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.16em] text-white/30">Recent in your workspace</p>}
        {(loading || semanticLoading) && <p role="status" className="px-3 py-3 text-xs text-white/40">{loading ? (query.trim() ? "Searching your workspace…" : "Loading recent notes and files…") : "Looking for related notes…"}</p>}
        {searchError && <p role="status" data-theme-warning className="px-3 py-2 text-xs text-amber-100/65">{searchError}</p>}
        {loaded && !resultsLoading && !query.trim() && results.length === 0 && !searchError && <p className="px-3 py-5 text-center text-xs text-white/35">No recent notes or files yet.</p>}
        {groups.map((group) => <div key={group.kind} className="py-1"><p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">{group.label}</p>{group.items.map((item) => { const index = flatIndex++; return <SearchOption key={item.id} item={item} index={index} active={index === activeIndex} buttonRef={(element) => { resultRefs.current[index] = element; }} onSelect={() => openItem(item)} onActive={(next) => { activePosition.current = next; setActiveIndex(next); }} />; })}</div>)}
        {commands.length > 0 && <div className="py-1"><p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">Actions</p>{commands.map((item) => { const index = flatIndex++; return <SearchOption key={item.id} item={{ ...item, query }} index={index} active={index === activeIndex} buttonRef={(element) => { resultRefs.current[index] = element; }} onSelect={() => openItem(item)} onActive={(next) => { activePosition.current = next; setActiveIndex(next); }} />; })}</div>}
        {askItem.map((item) => { const index = flatIndex++; return <div key={item.id} className="mt-2 border-t border-white/[0.08] pt-2"><SearchOption item={item} index={index} active={index === activeIndex} buttonRef={(element) => { resultRefs.current[index] = element; }} onSelect={() => openItem(item)} onActive={(next) => { activePosition.current = next; setActiveIndex(next); }} /></div>; })}
        {loaded && !resultsLoading && !searchError && combinedResults.length === 0 && query.trim() && <p className="px-3 py-6 text-center text-sm text-white/40">No matching notes, files, or reports yet.</p>}
        {!isOnline && <p className="px-3 pb-2 pt-3 text-[10px] text-white/30">Offline: only cached notes and file names can be searched.</p>}
      </div>
      <footer className="flex shrink-0 flex-col gap-2 border-t border-white/[0.07] px-4 py-2 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between"><span>Workspace-only keyword search · semantic matches for notes · extracted file text when available</span><span className="flex items-center gap-3"><span className="inline-flex items-center gap-1"><ArrowUp className="size-3" /><ArrowDown className="size-3" /> Navigate</span><span>↵ Open</span><span>⌘K Search</span></span></footer>
    </DialogContent>
  </Dialog>;
}

function SearchOption({ item, index, active, buttonRef, onSelect, onActive }: { item: PaletteItem; index: number; active: boolean; buttonRef: (element: HTMLButtonElement | null) => void; onSelect: () => void; onActive: (index: number) => void }) {
  return <button ref={buttonRef} id={`workspace-search-option-${index}`} type="button" role="option" aria-selected={active} data-search-active={active || undefined} onMouseEnter={() => onActive(index)} onClick={onSelect} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${active ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"}`}><span className="mt-0.5"><SearchIcon kind={item.kind} target={item.target} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-white/85">{highlightQuery(item.title, item.kind === "command" ? "" : item.query ?? "")}</span><span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-white/40">{renderSnippet(item.snippet)}</span></span>{item.kind === "ask" && <span className="mt-0.5 shrink-0 text-[10px] text-white/35">Ask ↵</span>}</button>;
}
