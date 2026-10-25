"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotesWorkspace } from "@/src/components/workspace/NotesProvider";
import { ArrowUp, ArrowUpRight, Check, ChevronDown, Download, FileText, LoaderCircle, Minus, PanelLeftClose, ScrollText, Sparkles, Square, X } from "lucide-react";

type Provider = "gemini" | "openrouter-gemma" | "openrouter-liquid";
type Source = { id: string; type: "note" | "file"; name: string };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[]; contextTruncated?: boolean; workspaceUsed?: boolean };
type ChatErrorCode = "timeout" | "rate_limited" | "unavailable" | "authentication" | "network" | "provider_error" | "quota_exceeded";
type TokenQuota = { used: number; reserved: number; limit: number; remaining: number; resetsAt: string };
type ChatError = { error?: string; code?: ChatErrorCode; retryAfterSeconds?: number; quota?: TokenQuota | null };
type ReportSource = Source & { date: string; href: string | null };
type WorkspaceReport = { title: string; dateRange: string; author: string; sources: ReportSource[]; sections: Array<{ title: string; content: string }>; createdAt: string };

const REPORT_SECTIONS = [
  "Objective", "Summary", "Materials and reagents", "Samples and conditions", "Procedure", "Deviations",
  "Observations", "Results", "Interpretation", "Issues and open questions", "Next steps", "Progress vs previous reports",
];

function createReport(answer: string, sources: ReportSource[], author: string): WorkspaceReport {
  const heading = answer.match(/^Title:\s*(.+)$/im)?.[1]?.trim();
  const sectionContent = new Map<string, string[]>();
  let currentSection: string | null = null;
  for (const line of answer.split(/\r?\n/)) {
    const normalizedHeading = line.trim().replace(/\s*:\s*$/, "").toLocaleLowerCase();
    const sectionHeading = REPORT_SECTIONS.find((section) => section.toLocaleLowerCase() === normalizedHeading);
    if (sectionHeading) {
      currentSection = sectionHeading;
      sectionContent.set(currentSection, []);
    } else if (currentSection) {
      sectionContent.get(currentSection)?.push(line);
    }
  }
  const sections = REPORT_SECTIONS.map((title) => ({
    title,
    content: sectionContent.get(title)?.join("\n").trim() || "Not documented in the available sources.",
  }));
  const dates = sources.map((source) => Date.parse(source.date)).filter(Number.isFinite).sort((a, b) => a - b);
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
  const dateRange = dates.length > 0
    ? dates[0] === dates[dates.length - 1] ? dateFormat.format(dates[0]) : `${dateFormat.format(dates[0])} – ${dateFormat.format(dates[dates.length - 1])}`
    : "No dated sources";
  return { title: heading || "Workspace report", dateRange, author, sources, sections, createdAt: new Date().toISOString() };
}

function downloadWorkspaceReport(report: WorkspaceReport) {
  const sourceList = report.sources.map((source) => `- [${source.name}](${source.href ?? "#"}) — ${source.type}, ${new Date(source.date).toLocaleDateString()}`).join(String.fromCharCode(10)) || "- No source documents were found.";
  const content = [
    `# ${report.title}`, `**Date range:** ${report.dateRange}  `, `**Author:** ${report.author}  `, "**Status:** Draft", "",
    "## Source notes and files", sourceList, "", "## Report",
    ...report.sections.flatMap((section) => [`### ${section.title}`, section.content, ""]),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "workspace-report"}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const MODELS: Record<Provider, { name: string; model: string }> = {
  gemini: { name: "Google Gemini", model: "3.8 Flash" },
  "openrouter-gemma": { name: "OpenRouter", model: "Gemma 4 31B · Free" },
  "openrouter-liquid": { name: "OpenRouter", model: "Liquid LFM2.5 · Free" },
};
const MODEL_IDS = Object.keys(MODELS) as Provider[];

function LaboraFace({ compact = false, answering = false }: { compact?: boolean; answering?: boolean }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-[#1b1b1b] shadow-lg ${compact ? "size-9" : "size-12"}`}>
      <span className="absolute inset-[3px] rounded-full border border-white/[0.07]" />
      <span className={`relative flex items-center gap-1.5 ${answering ? "animate-[labora-eyes_1.2s_linear_infinite]" : ""}`}>
        <span className={`rounded-full bg-[#e4e3dd] shadow-[0_0_7px_rgba(228,227,221,0.35)] ${compact ? "size-1.5" : "size-2"}`} />
        <span className={`rounded-full bg-[#e4e3dd] shadow-[0_0_7px_rgba(228,227,221,0.35)] ${compact ? "size-1.5" : "size-2"}`} />
      </span>
    </span>
  );
}

export function LaboraAssistant() {
  const router = useRouter();
  const { select } = useNotesWorkspace();
  const [open, setOpen] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<ChatErrorCode | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [quota, setQuota] = useState<TokenQuota | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMounted, setReportMounted] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [pending, setPending] = useState(false);
  const [workspaceFollowUp, setWorkspaceFollowUp] = useState(false);
  const queuedSearchRef = useRef("");
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  const modelOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reportControllerRef = useRef<AbortController | null>(null);
  const reportLoadingRef = useRef(false);

  useEffect(() => {
    if (open) {
      const animationFrame = window.requestAnimationFrame(() => setPanelVisible(true));
      return () => window.cancelAnimationFrame(animationFrame);
    }
    const closeTimer = window.setTimeout(() => setPanelMounted(false), 300);
    return () => window.clearTimeout(closeTimer);
  }, [open]);

  useEffect(() => {
    if (reportOpen) {
      const animationFrame = window.requestAnimationFrame(() => setReportVisible(true));
      return () => window.cancelAnimationFrame(animationFrame);
    }
    const closeTimer = window.setTimeout(() => setReportMounted(false), 300);
    return () => window.clearTimeout(closeTimer);
  }, [reportOpen]);

  useEffect(() => {
    if (open) {
      let cancelled = false;
      fetch("/api/labora/chat", { cache: "no-store" })
        .then(async (response) => response.ok ? response.json() as Promise<{ quota?: TokenQuota | null }> : null)
        .then((result) => { if (!cancelled && result?.quota) setQuota(result.quota); })
        .catch(() => undefined);
      return () => { cancelled = true; };
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      reportControllerRef.current?.abort();
      reportControllerRef.current = null;
      reportLoadingRef.current = false;
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeChat();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const onAsk = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail !== "string" || !detail.trim()) return;
      queuedSearchRef.current = detail.trim();
      setPanelMounted(true);
      setOpen(true);
    };
    window.addEventListener("labora:ask", onAsk);
    return () => window.removeEventListener("labora:ask", onAsk);
  }, []);

  useEffect(() => {
    if (!open || !queuedSearchRef.current) return;
    const text = queuedSearchRef.current;
    queuedSearchRef.current = "";
    setDraft(text);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    modelOptionRefs.current[provider === "gemini" ? 0 : 1]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!modelSelectorRef.current?.contains(event.target as Node)) setModelMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModelMenuOpen(false);
        modelTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [modelMenuOpen, provider]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 112 ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function stopRequest() {
    requestControllerRef.current?.abort();
  }

  function closeChat() {
    setOpen(false);
    setPanelVisible(false);
    setReportOpen(false);
    setReportVisible(false);
    setModelMenuOpen(false);
    reportControllerRef.current?.abort();
    reportControllerRef.current = null;
    reportLoadingRef.current = false;
    setReportLoading(false);
  }

  const isRequestActive = pending;

  async function openWorkspaceReport() {
    setReportMounted(true);
    setReportOpen(true);
    if (report || reportLoadingRef.current) return;
    reportLoadingRef.current = true;
    setReportLoading(true);
    setReportError("");
    const controller = new AbortController();
    reportControllerRef.current = controller;
    try {
      const response = await fetch("/api/labora/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: provider,
          reportMode: true,
          messages: [{ role: "user", content: "Create a workspace report from my notes and files using the report template. Find related prior reports and compare progress. Cite sources and leave unsupported facts undocumented." }],
        }),
      });
      const result = await response.json() as { answer?: string; sources?: ReportSource[]; author?: string; quota?: TokenQuota | null } & ChatError;
      if (result.quota) setQuota(result.quota);
      if (!response.ok || !result.answer) throw new Error(result.error || "Could not create a workspace report.");
      setReport(createReport(result.answer, result.sources ?? [], result.author ?? "Signed-in user"));
    } catch (requestError) {
      if (!controller.signal.aborted) setReportError(requestError instanceof Error ? requestError.message : "Could not create a workspace report.");
    } finally {
      reportLoadingRef.current = false;
      setReportLoading(false);
      reportControllerRef.current = null;
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setDraft("");
    setError("");
    setErrorCode(null);
    setRetryAfterSeconds(null);
    setPending(true);
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    try {
      const recentMessages = nextMessages.slice(-10);
      const firstUserIndex = recentMessages.findIndex((message) => message.role === "user");
      const response = await fetch("/api/labora/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,        body: JSON.stringify({
          model: provider,
          workspaceFollowUp,
          messages: recentMessages.slice(firstUserIndex).map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
      });
      const result = await response.json() as { answer?: string; sources?: Source[]; contextTruncated?: boolean; workspaceUsed?: boolean } & ChatError;
      if (result.quota) setQuota(result.quota);
      if (!response.ok || !result.answer) {
        setRetryAfterSeconds(result.retryAfterSeconds ?? null);
        setErrorCode(result.code ?? null);
        throw new Error(result.error || "Labora couldn’t answer just now. Please try again.");
      }
      setMessages((current) => [...current, {
        role: "assistant",
        content: result.answer!,
        sources: result.sources ?? [],
        contextTruncated: result.contextTruncated ?? false,
        workspaceUsed: result.workspaceUsed ?? false,
      }]);
      setWorkspaceFollowUp(result.workspaceUsed ?? false);
    } catch (requestError) {
      if (controller.signal.aborted) {
        setMessages((current) => current.filter((_, index) => index !== current.length - 1));
        setError("Response stopped.");
        setErrorCode(null);
        setRetryAfterSeconds(null);
      } else {
        setMessages((current) => current.filter((_, index) => index !== current.length - 1));
        setDraft(content);
        setError(requestError instanceof Error ? requestError.message : "Labora couldn’t answer just now. Please try again.");
      }
      setWorkspaceFollowUp(false);
    } finally {
      if (requestIdRef.current === requestId) {
        setPending(false);
        requestControllerRef.current = null;
      }
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex justify-end p-4 sm:p-6">
      <div className="pointer-events-auto relative flex flex-col items-end gap-3">
        <div
          aria-hidden={!open}
          inert={!open}
          className={`absolute bottom-[calc(100%+0.75rem)] right-0 flex max-h-[calc(100dvh-6rem)] origin-bottom-right flex-col-reverse overflow-hidden rounded-3xl border border-white/10 bg-[#141413]/[0.97] shadow-2xl shadow-black/50 backdrop-blur-xl transition-[width,height,transform,opacity,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:flex-row ${reportOpen ? "h-[min(44rem,calc(100dvh-6rem))] w-[min(82rem,calc(100vw-2rem))]" : "h-[min(34rem,calc(100dvh-6rem))] w-[min(25rem,calc(100vw-2rem))]"} ${panelVisible ? "visible translate-y-0 scale-100 opacity-100" : `${panelMounted ? "visible" : "invisible"} pointer-events-none translate-y-3 scale-[0.97] opacity-0`}`}
        >
        {reportMounted && (
          <aside aria-label="Workspace report" aria-hidden={!reportVisible} inert={!reportVisible} className={`flex min-h-0 min-w-0 flex-1 flex-col border-b border-white/10 bg-[#111110] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:border-b-0 sm:border-r ${reportVisible ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"}`}>
            <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-3">
              <button type="button" onClick={() => { setReportVisible(false); setReportOpen(false); }} aria-label="Close report and return to chat" title="Return to chat" className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/50"><PanelLeftClose className="size-4" /></button>
              <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-white">Workspace report</h2><p className="text-[10px] text-white/40">Source-grounded lab record</p></div>
              <button type="button" onClick={() => report && downloadWorkspaceReport(report)} disabled={!report} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Download className="size-3.5" /> Download</button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {reportLoading ? <div className="flex h-full min-h-40 items-center justify-center gap-2 text-sm text-white/50"><LoaderCircle className="size-4 animate-spin" /> Building report from your workspace…</div> : reportError ? <div role="alert" className="rounded-xl border border-red-300/15 bg-red-300/[0.06] p-4 text-sm text-red-100/80">{reportError}<button type="button" onClick={() => { setReport(null); void openWorkspaceReport(); }} className="ml-2 underline">Try again</button></div> : report ? (
                <article className="mx-auto max-w-3xl text-white/80">
                  <div className="border-b border-white/10 pb-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Labora · Workspace report</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{report.title}</h1>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3"><div><dt className="text-white/35">Date range</dt><dd className="mt-0.5 text-white/75">{report.dateRange}</dd></div><div><dt className="text-white/35">Author</dt><dd className="mt-0.5 break-words text-white/75">{report.author}</dd></div><div><dt className="text-white/35">Status</dt><dd className="mt-0.5 inline-flex items-center gap-1.5 text-amber-200/80"><span className="size-1.5 rounded-full bg-amber-300/70" />Draft</dd></div></dl>
                    <div className="mt-5"><h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Source notes and files</h2>{report.sources.length ? <ul className="mt-2 flex flex-wrap gap-2">{report.sources.map((source) => <li key={`${source.type}-${source.id}`}>{source.type === "note" ? <button type="button" onClick={() => { select(source.id); router.push("/workspace/notes"); }} className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-white/65 transition hover:border-white/20 hover:text-white"><FileText className="size-3 shrink-0" /><span className="max-w-56 truncate">{source.name}</span><ArrowUpRight className="size-3 shrink-0 text-white/35" /></button> : <a href={source.href ?? undefined} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-white/65 transition hover:border-white/20 hover:text-white"><FileText className="size-3 shrink-0" /><span className="max-w-56 truncate">{source.name}</span><ArrowUpRight className="size-3 shrink-0 text-white/35" /></a>}</li>)}</ul> : <p className="mt-2 text-xs text-white/45">No readable source notes or files were found.</p>}</div>
                  </div>
                  <div className="divide-y divide-white/[0.07]">{report.sections.map((section) => <section key={section.title} className="py-4"><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">{section.title}</h2><p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-white/75">{section.content}</p></section>)}</div>
                </article>
              ) : null}
            </div>
          </aside>
        )}
        <section
          id="labora-chat-panel"
          aria-label="Labora assistant chat"
          aria-hidden={!open}
          className={`flex min-h-0 w-full shrink-0 flex-col overflow-hidden transition-[height,border-color,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:h-full sm:w-[25rem] ${reportOpen ? "h-1/2 border-b border-white/10 sm:border-b-0 sm:border-l" : "h-full border-b-transparent sm:border-l-transparent"}`}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3.5">
            <LaboraFace compact answering={isRequestActive} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold tracking-wide text-white">Labora</h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40"><span className="size-1.5 rounded-full bg-emerald-400/80" />Workspace assistant</p>
            </div>
            <button type="button" onClick={() => reportOpen ? (setReportVisible(false), setReportOpen(false)) : void openWorkspaceReport()} aria-label={reportOpen ? "Show workspace report" : "Create workspace report"} title={reportOpen ? "Show workspace report" : "Create workspace report"} className={`rounded-lg p-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 ${reportOpen ? "bg-white/[0.08] text-white" : "text-white/45 hover:bg-white/[0.07] hover:text-white"}`}><ScrollText className="size-4" /></button>
            <button type="button" onClick={closeChat} aria-label="Minimize Labora" className="rounded-lg p-2 text-white/45 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50">
              <Minus className="size-4" />
            </button>
            <button type="button" onClick={closeChat} aria-label="Close Labora" className="rounded-lg p-2 text-white/45 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50">
              <X className="size-4" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex items-start gap-2.5">
                <LaboraFace compact answering={isRequestActive} />
                <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.045] px-3.5 py-3 text-[13px] leading-5 text-white/75">
                  Hey, I’m Labora. Ask me about your notes or Drive, and I’ll look through your workspace for an answer.
                </div>
              </div>
            ) : messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex items-start gap-2.5 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "assistant" && <LaboraFace compact answering={isRequestActive} />}
                <div className={`max-w-[86%] min-w-0 rounded-2xl px-3.5 py-3 text-[13px] leading-5 ${message.role === "user" ? "rounded-tr-md bg-white/[0.12] text-white" : "rounded-tl-md border border-white/[0.07] bg-white/[0.045] text-white/80"}`}>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {message.role === "assistant" && message.workspaceUsed && (message.sources?.length ?? 0) > 0 && (
                    <details className="mt-3 border-t border-white/[0.08] pt-2 text-[11px] text-white/45">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 hover:text-white/70">
                        <FileText className="size-3" /> Checked {message.sources!.length} workspace {message.sources!.length === 1 ? "source" : "sources"}
                        {message.contextTruncated && <span className="text-white/30">· relevant sources</span>}
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {message.sources!.map((source) => <li key={source.id} className="flex items-center gap-1.5 break-all"><span className="size-1 shrink-0 rounded-full bg-white/30" />{source.name}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
                {message.role === "user" && <span className="sr-only">You</span>}
              </div>
            ))}
            {pending && <div className="flex items-center gap-2.5 text-[12px] text-white/45"><LaboraFace compact answering={isRequestActive} /><LoaderCircle className="size-3.5 animate-spin" />Labora is thinking…</div>}
            {error && (
              <div role="alert" className="ml-11 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-3 py-2 text-[12px] leading-5 text-red-100/80">
                <p>{error}</p>
                {retryAfterSeconds !== null && <p className="mt-1 text-red-100/55">Retry after {retryAfterSeconds} seconds, or choose the other model.</p>}
                {(errorCode === "timeout" || errorCode === "rate_limited" || errorCode === "unavailable" || errorCode === "network") && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = MODEL_IDS.indexOf(provider);
                      setProvider(MODEL_IDS[(currentIndex + 1) % MODEL_IDS.length]);
                      setError("");
                      setErrorCode(null);
                      setRetryAfterSeconds(null);
                    }}
                    className="mt-2 rounded-full border border-white/15 bg-[#1b1b1b] px-2.5 py-1 text-[10px] text-white/70 transition hover:bg-white/15 hover:text-white"
                  >
                    Try {MODELS[MODEL_IDS[(MODEL_IDS.indexOf(provider) + 1) % MODEL_IDS.length]].name} {MODELS[MODEL_IDS[(MODEL_IDS.indexOf(provider) + 1) % MODEL_IDS.length]].model}
                  </button>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="shrink-0 border-t border-white/10 p-3">
            <label htmlFor="labora-message" className="sr-only">Message Labora</label>
            {quota && (
              <div className="mb-2 px-2" aria-label="Monthly Labora token usage">
                <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/45">
                  <span>Monthly token allowance</span>
                  <span>{new Intl.NumberFormat().format(quota.remaining)} left · resets {new Date(quota.resetsAt).toLocaleDateString()}</span>
                </div>
                <div role="progressbar" aria-label="Monthly token allowance used" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={Math.min(quota.limit, quota.used + quota.reserved)} className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-white/60 transition-[width]" style={{ width: `${Math.min(100, ((quota.limit - quota.remaining) / quota.limit) * 100)}%` }} />
                </div>
              </div>
            )}
            <div className="mb-2 flex items-center justify-between px-2">
              <label htmlFor="labora-model" className="text-[10px] uppercase tracking-[0.12em] text-white/35">Model</label>
              <div ref={modelSelectorRef} className="relative z-20 flex items-center">
                <button
                  ref={modelTriggerRef}
                  id="labora-model"
                  type="button"
                  aria-label="Choose Labora model"
                  aria-haspopup="listbox"
                  aria-expanded={modelMenuOpen}
                  aria-controls="labora-model-options"
                  disabled={pending}
                  onClick={() => setModelMenuOpen((current) => !current)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      setModelMenuOpen(true);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-[#1b1b1b] py-2 pl-3 pr-3 text-xs text-zinc-200 shadow-lg outline-none transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{MODELS[provider].name} · {MODELS[provider].model}</span>
                  <ChevronDown aria-hidden="true" className={`size-3.5 text-zinc-400 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {modelMenuOpen && (
                  <div
                    id="labora-model-options"
                    role="listbox"
                    aria-label="Available Labora models"
                    className="absolute bottom-[calc(100%+0.5rem)] right-0 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#191918] p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
                  >
                    {MODEL_IDS.map((modelProvider, index) => (
                      <button
                        key={modelProvider}
                        ref={(element) => { modelOptionRefs.current[index] = element; }}
                        type="button"
                        role="option"
                        aria-selected={provider === modelProvider}
                        onClick={() => {
                          setProvider(modelProvider);
                          setModelMenuOpen(false);
                          modelTriggerRef.current?.focus();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            const direction = event.key === "ArrowDown" ? 1 : -1;
                            const nextIndex = (index + direction + MODEL_IDS.length) % MODEL_IDS.length;
                            modelOptionRefs.current[nextIndex]?.focus();
                          } else if (event.key === "Home" || event.key === "End") {
                            event.preventDefault();
                            modelOptionRefs.current[event.key === "Home" ? 0 : MODEL_IDS.length - 1]?.focus();
                          } else if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setProvider(modelProvider);
                            setModelMenuOpen(false);
                            modelTriggerRef.current?.focus();
                          }
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-white/50 ${provider === modelProvider ? "bg-white/[0.08] text-white" : "text-white/65 hover:bg-white/[0.07] hover:text-white"}`}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium">{MODELS[modelProvider].name}</span>
                          <span className="mt-0.5 block text-[10px] text-white/40">{MODELS[modelProvider].model}</span>
                        </span>
                        {provider === modelProvider && <Check aria-hidden="true" className="size-3.5 shrink-0 text-white/70" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-end gap-2 rounded-[1.65rem] border border-white/10 bg-black/25 p-1.5 pl-4 transition focus-within:border-white/25">
              <textarea
                ref={textareaRef}
                id="labora-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask about your workspace…"
                data-theme-labora-input
                rows={1}
                maxLength={4000}
                disabled={pending}
                className="min-h-10 min-w-0 flex-1 resize-none self-center overflow-y-hidden bg-transparent py-2.5 text-sm leading-5 text-white outline-none placeholder:text-white/30 disabled:opacity-50"
              />
              <button
                type={pending ? "button" : "submit"}
                aria-label={pending ? "Stop response" : "Send message"}
                data-destructive={pending || undefined}
                onClick={pending ? stopRequest : undefined}
                disabled={pending ? false : !draft.trim()}
                className={`mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#1b1b1b] text-zinc-200 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 ${pending ? "text-red-200" : ""}`}
              >
                {pending ? <Square className="size-3 fill-current" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-white/25"><Sparkles className="size-3" />Workspace lookup when needed</p>
          </form>
        </section>
        </div>

        <button
          type="button"
          aria-label={open ? "Close Labora assistant" : "Open Labora assistant"}
          aria-expanded={open}
          aria-controls="labora-chat-panel"
          onClick={() => {
            if (open) {
              closeChat();
            } else {
              setPanelMounted(true);
              setOpen(true);
            }
          }}
          className={`group relative flex size-12 items-center justify-center rounded-full border border-white/15 bg-[#1b1b1b] text-zinc-200 shadow-xl shadow-black/30 transition duration-200 hover:scale-105 hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60 active:scale-95 motion-reduce:transform-none ${isRequestActive ? "ring-1 ring-white/25" : ""}`}
        >
          <span className="absolute -inset-1 -z-10 rounded-full bg-white/[0.035] blur-md transition group-hover:bg-white/[0.08]" />
          <LaboraFace answering={isRequestActive} />
          {!open && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-[#0c0c0b] bg-[#d4d3cb]" />}
        </button>
        <div aria-hidden="true" onClick={closeChat} className={`fixed inset-0 -z-10 cursor-default bg-transparent transition-opacity duration-300 motion-reduce:transition-none ${open ? "visible opacity-100" : "invisible opacity-0"}`} />
      </div>
    </div>
  );
}
