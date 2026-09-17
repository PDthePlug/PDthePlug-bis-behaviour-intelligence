"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, FlaskConical, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmationRedirectUrl } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function authErrorMessage(message: string) {
  const normalised = message.toLowerCase();
  if (normalised.includes("email rate limit exceeded") || normalised.includes("rate limit")) {
    return "BIS cannot send another verification email right now. Wait a minute and try again.";
  }
  if (normalised.includes("email not confirmed")) {
    return "This account exists, but its email is still waiting for confirmation. Request a new verification email below if the first one did not arrive.";
  }
  if (
    normalised.includes("error sending confirmation email") ||
    normalised.includes("failed to send") ||
    normalised.includes("email address not authorized")
  ) {
    return "BIS could not send the verification email. Please try again shortly. If it still does not arrive, contact the BIS team.";
  }
  if (normalised.includes("user already registered") || normalised.includes("already registered")) {
    return "A BIS account already exists for this email. Choose Sign in and use your password.";
  }
  if (normalised.includes("invalid login credentials") || normalised.includes("invalid credentials")) {
    return "The email or password is incorrect. Check your details and try again.";
  }
  return "BIS could not complete that request. Check your details and try again.";
}

export function SignInForm({ next, initialError = "" }: { next: string; initialError?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function changeMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  function updateEmail(value: string) {
    setEmail(value);
    setConfirmationPending(false);
    setResendCooldown(0);
  }

  function callbackUrl() {
    return confirmationRedirectUrl(next, window.location.origin);
  }

  async function resendConfirmation() {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError("Enter the email address used for this BIS account first.");
      return;
    }
    setResendBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (result.error) throw result.error;
      setConfirmationPending(true);
      setResendCooldown(60);
      setMessage("A new BIS verification email has been requested. Check your inbox and spam or junk folders.");
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : "BIS could not complete that request.";
      setError(authErrorMessage(raw));
    } finally {
      setResendBusy(false);
    }
  }

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
          emailRedirectTo: callbackUrl(),
        },
      });
      if (result.error) throw result.error;
      if (result.data.session) {
        router.replace(next);
        router.refresh();
      } else {
        setConfirmationPending(true);
        setMessage("Check your email to confirm your BIS account. If the message does not arrive, use Resend verification email below.");
      }
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : "BIS could not complete that request.";
      const normalised = raw.toLowerCase();
      setError(authErrorMessage(raw));
      if (normalised.includes("already registered")) {
        setMode("signin");
        setMessage("Your details are still in the form. Sign in with the account that already exists.");
      } else if (normalised.includes("email not confirmed")) {
        setMode("signin");
        setConfirmationPending(true);
      }
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
          <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => changeMode("signin")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Create account</button>
        </div>
        <form onSubmit={submit}>
          {mode === "signup" ? <label><span>Name</span><Input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} /></label> : null}
          <label><span>Email</span><Input type="email" autoComplete="email" value={email} onChange={(event) => updateEmail(event.target.value)} required /></label>
          <label><span>Password</span><Input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          {message ? <p className="auth-message" role="status">{message}</p> : null}
          <Button size="lg" className="w-full" disabled={busy || resendBusy}>{busy ? "Please wait…" : mode === "signin" ? <>Enter BIS <ArrowRight /></> : <>Create account <ArrowRight /></>}</Button>
          {confirmationPending ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy || resendBusy || resendCooldown > 0}
              onClick={() => void resendConfirmation()}
            >
              {resendBusy ? "Requesting…" : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend verification email"}
            </Button>
          ) : null}
        </form>
        <small>Authentication verifies your identity. BIS privacy, consent and role controls govern what each person can access.</small>
      </section>
    </main>
  );
}
