"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical, LockKeyhole, ShieldCheck } from "lucide-react";
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
        setMessage("Check your email to confirm your BIS account, then return here to sign in.");
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
          <p className="eyebrow">Applied Commerce® · Private evidence workspace</p>
          <h1>Investigate a pattern. Test it in real life.</h1>
          <p>One account carries your place, your evidence, and your privacy controls across Habit, Decision, and Money Lab.</p>
        </div>
        <div className="auth-principles">
          <span><LockKeyhole /> Private by default</span>
          <span><FlaskConical /> Evidence before judgment</span>
          <span><ShieldCheck /> Role-scoped access</span>
        </div>
      </section>
      <section className="auth-card surface-card">
        <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Create your private workspace"}</p>
        <h2>{mode === "signin" ? "Continue your investigation." : "Begin with one account."}</h2>
        <p>{mode === "signin" ? "Sign in to return to your latest evidence." : "Your Lab setup and consent choices come next."}</p>
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
          <Button size="lg" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? <>Sign in <ArrowRight /></> : <>Create account <ArrowRight /></>}</Button>
        </form>
        <small>Authentication verifies your identity. BIS privacy and consent controls still govern how your behavioural evidence is used.</small>
      </section>
    </main>
  );
}
