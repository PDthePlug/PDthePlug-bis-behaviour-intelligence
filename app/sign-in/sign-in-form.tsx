"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, FlaskConical, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signin") {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        router.replace(next);
        router.refresh();
        return;
      }

      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: displayName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (result.error) throw result.error;
      if (result.data.session) {
        router.replace(next);
        router.refresh();
      } else {
        setMessage("Check your email to confirm your BIS account. BIS will resolve the right learner or staff dashboard when you return.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "BIS could not complete that request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand"><span className="brand-symbol">B</span><div><strong>BIS</strong><small>Behaviour Intelligence</small></div></div>
        <div>
          <p className="eyebrow">Behaviour Intelligence Series™</p>
          <h1>One identity. The right BIS experience.</h1>
          <p>Sign in once. BIS resolves your role, learner profile and delivery edition, then opens the right dashboard without asking each Lab to classify you again.</p>
        </div>
        <div className="auth-principles">
          <span><BookOpen /> Edition-aware learning</span>
          <span><FlaskConical /> Separate Lab evidence</span>
          <span><ShieldCheck /> Role-based access</span>
        </div>
      </section>
      <section className="auth-card surface-card">
        <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Create your BIS identity"}</p>
        <h2>{mode === "signin" ? "Continue where you belong." : "Create your BIS account."}</h2>
        <p>{mode === "signin" ? "After sign-in, BIS routes you to your learner experience or role-restricted workspace." : "After signup, your learner profile will resolve the correct authored handbook edition."}</p>
        <div className="auth-mode" role="tablist" aria-label="Account action">
          <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button>
        </div>
        <form onSubmit={submit}>
          {mode === "signup" ? <label><span>Name</span><Input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} /></label> : null}
          <label><span>Email</span><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label><span>Password</span><Input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          {message ? <p className="auth-message" role="status">{message}</p> : null}
          <Button size="lg" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? <>Enter BIS <ArrowRight /></> : <>Create account <ArrowRight /></>}</Button>
        </form>
        <small>Authentication verifies your identity. BIS privacy, consent and role controls govern what each person can access.</small>
      </section>
    </main>
  );
}
