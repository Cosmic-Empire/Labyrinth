"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <main className="flex min-h-screen items-center justify-center bg-[#0c0c0b] px-5 py-12 text-white">
      <section className="w-full max-w-sm">
        <Link href="/" className="mb-12 block text-center font-mono text-sm tracking-[0.28em] text-white/80">
          LABYRINTH
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30 sm:p-8">
          <h1 className="font-mono text-2xl tracking-tight">{isSignIn ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">
            {isSignIn ? "Sign in to continue to your workspace." : "Sign up to get started with your workspace."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block space-y-2 text-sm text-white/70">
              Email
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-11 border-white/15 bg-black/30 text-white placeholder:text-white/30"
              />
            </label>
            <label className="block space-y-2 text-sm text-white/70">
              Password
              <Input
                type="password"
                autoComplete={isSignIn ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                className="h-11 border-white/15 bg-black/30 text-white placeholder:text-white/30"
              />
            </label>

            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {message && <p role="status" className="text-sm leading-6 text-emerald-300">{message}</p>}

            <Button type="submit" disabled={pending} className="h-11 w-full bg-white text-black hover:bg-white/90">
              {pending ? "Please wait…" : isSignIn ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/50">
            {isSignIn ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(isSignIn ? "sign-up" : "sign-in");
                setError("");
                setMessage("");
              }}
              className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              {isSignIn ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
