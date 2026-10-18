"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type AuthMode = "sign-in" | "sign-up";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);

    try {
      const supabase = createClient();
      const result = mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=/workspace/notes`,
            },
          });

      if (result.error) throw result.error;

      if (mode === "sign-up" && !result.data.session) {
        setMessage("Check your email for a confirmation link to finish creating your account.");
        return;
      }

      router.replace("/workspace/notes");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const isSignIn = mode === "sign-in";

  return (
    <main data-auth-page className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#0c0c0b] px-4 py-10 text-white sm:px-6 sm:py-14">
      <div data-auth-background aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-[-8rem] size-[25rem] rounded-full bg-white/[0.045] blur-3xl" />
        <div className="absolute -bottom-40 -right-24 size-[30rem] rounded-full bg-[#a3a3a3]/[0.08] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,#0c0c0b_78%)]" />
      </div>

      <section className="relative w-full max-w-md">
        <Link href="/" className="mb-12 block text-center font-mono text-sm tracking-[0.28em] text-white/80">
          LABYRINTH
        </Link>

        <div data-auth-card className="overflow-hidden rounded-[2rem] border border-white/[0.11] bg-[#121211]/90 shadow-[0_28px_100px_-35px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div data-auth-card-accent className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="p-6 sm:p-9">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
              {isSignIn ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/50">
              {isSignIn ? "Sign in and pick up where your ideas left off." : "Make a little room for your notes, research, and ideas."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <label data-auth-label className="block space-y-3 text-xs font-medium text-white/65">
                <span>Email address</span>
                <span className="relative block">
                  <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    data-auth-input
                    className="h-12 rounded-2xl border-white/10 bg-black/25 pl-11 text-sm text-white placeholder:text-white/30 focus-visible:border-white/25 focus-visible:ring-white/10"
                  />
                </span>
              </label>
              <label data-auth-label className="block space-y-3 text-xs font-medium text-white/65">
                <span>Password</span>
                <span className="relative block">
                  <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                  <Input
                    type="password"
                    autoComplete={isSignIn ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 6 characters"
                    data-auth-input
                    className="h-12 rounded-2xl border-white/10 bg-black/25 pl-11 text-sm text-white placeholder:text-white/30 focus-visible:border-white/25 focus-visible:ring-white/10"
                  />
                </span>
              </label>

              {error && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-sm leading-5 text-red-300">{error}</p>}
              {message && <p role="status" className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-sm leading-5 text-emerald-200">{message}</p>}

              <Button type="submit" data-auth-primary disabled={pending} className="group h-12 w-full rounded-2xl bg-[#e8e8e5] text-sm font-normal text-[#171816] shadow-lg shadow-black/20 transition hover:bg-[#d4d5d1] disabled:opacity-60">
                <span>{pending ? "Please wait…" : isSignIn ? "Sign in to workspace" : "Create account"}</span>
                {!pending && <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />}
              </Button>
            </form>

            <div className="my-7 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-white/[0.08]" />
              <span className="size-1 rounded-full bg-white/25" />
              <span className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <div data-auth-switch className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 text-center text-sm sm:flex-row sm:gap-1.5">
              <span className="text-white/50">{isSignIn ? "New to Labyrinth?" : "Already have an account?"}</span>
              <button
                type="button"
                onClick={() => {
                  setMode(isSignIn ? "sign-up" : "sign-in");
                  setError("");
                  setMessage("");
                }}
                className="rounded-full px-2 py-1 font-medium text-white/85 underline decoration-white/25 underline-offset-4 transition hover:bg-white/[0.06] hover:decoration-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
              >
                {isSignIn ? "Create an account" : "Sign in instead"}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/30">
          Thoughtfully kept. Yours to shape.
        </p>
      </section>
    </main>
  );
}
