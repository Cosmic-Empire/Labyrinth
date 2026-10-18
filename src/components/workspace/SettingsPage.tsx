"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useNotesWorkspace } from "@/src/components/workspace/NotesProvider";
import { createClient } from "@/src/lib/supabase/client";

const THEME_KEY = "labyrinth-workspace-theme";
const DELETE_CONFIRMATION_HEADER = "x-confirm-account-deletion";
type Theme = "system" | "dark" | "light";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-medium text-white/90">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-white/45">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const fieldClass = "mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25";
const buttonClass = "rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50";

export function SettingsPage() {
  const router = useRouter();
  const { user } = useNotesWorkspace();
  const client = createClient();
  const [theme, setTheme] = useState<Theme>("system");
  const [name, setName] = useState(String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""));
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");

  function applyTheme(next: Theme) {
    const root = document.documentElement;
    root.dataset.workspaceTheme = next;
    root.classList.toggle("dark", next !== "light");
    root.style.colorScheme = next === "light" ? "light" : "dark";
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(THEME_KEY);
      const next = saved === "system" || saved === "dark" || saved === "light" ? saved : "system";
      setTheme(next);
      applyTheme(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function selectTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
  }

  async function saveName() {
    setBusy(true);
    try {
      const { error } = await client.auth.updateUser({ data: { full_name: name.trim() } });
      if (error) throw error;
      toast.success("Name updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your name.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEmail() {
    const nextEmail = email.trim();
    if (!nextEmail || nextEmail === user.email) return;
    setBusy(true);
    try {
      const { error } = await client.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      toast.success("Check your new email inbox to confirm the change.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your email.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (password.length < 6) {
      toast.error("Choose a password with at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      toast.success("Password changed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change your password.");
    } finally {
      setBusy(false);
    }
  }

  async function copyFeedback() {
    const text = feedback.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Feedback copied. You can paste it into a message to the Labyrinth team.");
    } catch {
      toast.error("Clipboard access is unavailable in this browser.");
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") return;
    setBusy(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST", headers: { [DELETE_CONFIRMATION_HEADER]: "DELETE" } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not delete your account.");
      await client.auth.signOut();
      router.replace("/auth");
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main aria-label="Settings" className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-2 sm:py-6">
      <header className="border-b border-white/10 pb-5">
        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/35">Workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Settings</h1>
      </header>

      <Section title="Theme" description="Choose how Labyrinth should appear on this device.">
        <div role="group" aria-label="Theme" className="flex flex-wrap gap-2">
          {(["system", "dark", "light"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={theme === value} onClick={() => selectTheme(value)} className={`rounded-full border px-4 py-2 text-xs transition ${theme === value ? "border-white/35 bg-white/10 text-white" : "border-white/10 text-white/50 hover:bg-white/[0.06] hover:text-white/80"}`}>
              {value === "system" ? "System settings" : value === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/35">Your choice is saved on this device and applied across the workspace.</p>
      </Section>

      <Section title="Account settings" description="Manage the name and sign-in details for this account.">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-xs text-white/55">Name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} className={fieldClass} placeholder="Your name" />
          </label>
          <div className="flex items-end gap-2"><button type="button" onClick={() => void saveName()} disabled={busy} className={`${buttonClass} mb-0.5`}>Save name</button></div>
          <label className="block text-xs text-white/55">Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={320} className={fieldClass} />
          </label>
          <div className="flex items-end gap-2"><button type="button" onClick={() => void saveEmail()} disabled={busy || email.trim() === user.email} className={`${buttonClass} mb-0.5`}>Change email</button></div>
          <label className="block text-xs text-white/55 sm:col-span-2">New password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} className={fieldClass} placeholder="At least 6 characters" />
          </label>
          <div className="sm:col-span-2"><button type="button" onClick={() => void savePassword()} disabled={busy || !password} className={buttonClass}>Change password</button></div>
        </div>
      </Section>

      <Section title="Feedback" description="Share a suggestion or report a problem. Your message is not sent automatically; copy it and send it to the Labyrinth team.">
        <label htmlFor="settings-feedback" className="sr-only">Feedback message</label>
        <textarea id="settings-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value.slice(0, 4000))} rows={4} maxLength={4000} placeholder="What would you like us to know?" className="w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-white/25" />
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-white/30">{feedback.length}/4000</span><button type="button" onClick={() => void copyFeedback()} disabled={!feedback.trim()} className={buttonClass}>Copy feedback</button></div>
      </Section>

      <Section title="AI privacy disclosure" description="AI features can send data to external model providers to fulfill your request.">
        <ul className="space-y-2 text-sm leading-6 text-white/55">
          <li>When you ask Labora about your workspace, relevant notes and file excerpts may be sent with your prompt to the selected AI provider.</li>
          <li>Semantic search sends your search phrase and note chunks to Google Gemini for embedding; embeddings are stored in your workspace database under your account.</li>
          <li>File contents are searchable only after text extraction has completed. Your original files remain the source of truth.</li>
          <li>Review the selected provider’s current retention and model-training terms before sending unpublished or sensitive research. Avoid including information you are not permitted to share.</li>
        </ul>
      </Section>

      <Section title="Delete account" description="Permanently delete your account, notes, and stored Drive files. This cannot be undone.">
        {!deletePromptOpen ? <button type="button" data-destructive onClick={() => { setDeletePromptOpen(true); setDeleteConfirmation(""); setDeleteError(""); }} className="rounded-full border border-red-400/35 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-200 transition hover:border-red-300/60 hover:bg-red-500/20">
          Delete account
        </button> : <div className="mt-4 rounded-xl border border-red-400/15 bg-red-500/[0.04] p-4">
          <p className="text-sm text-white/75">To permanently remove this account and its data, type <strong className="font-mono text-red-200">DELETE</strong>.</p>
          <label className="mt-3 block text-xs text-white/50">Confirmation
            <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" className={fieldClass} placeholder="DELETE" />
          </label>
          {deleteError && <p role="alert" className="mt-3 text-sm text-red-200">{deleteError}</p>}
          <button type="button" data-destructive onClick={() => void deleteAccount()} disabled={busy || deleteConfirmation !== "DELETE"} className="mt-4 rounded-full border border-red-300/35 bg-red-600/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? "Deleting…" : "Permanently delete account"}
          </button>
          <button type="button" onClick={() => { setDeletePromptOpen(false); setDeleteConfirmation(""); }} className="ml-2 rounded-full px-4 py-2 text-xs text-white/50 transition hover:text-white">Cancel</button>
        </div>}
      </Section>
    </main>
  );
}
