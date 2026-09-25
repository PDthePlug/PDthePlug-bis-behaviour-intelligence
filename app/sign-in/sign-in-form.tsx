"use client";

import { BisMark } from "@/components/brand/bis-mark";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { applicationOrigin, confirmationRedirectUrl, safeReturnPath } from "@/lib/auth-redirect";
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

function googleAuthErrorMessage(message: string) {
  const normalised = message.toLowerCase();
  if (normalised.includes("provider is not enabled") || normalised.includes("unsupported provider")) {
    return "Google sign-in is still being configured for BIS. Use email and password for now or try again shortly.";
  }
  return "BIS could not start Google sign-in. Try again, or continue with email and password.";
}

export function SignInForm({ next, initialError = "" }: { next: string; initialError?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
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

  function onCanonicalOrigin() {
    const origin = applicationOrigin(window.location.origin);
    if (origin === window.location.origin) return true;
    const url = new URL("/sign-in", origin);
    url.searchParams.set("next", safeReturnPath(next));
    window.location.replace(url.toString());
    return false;
  }

  function callbackUrl() {
    return confirmationRedirectUrl(next, window.location.origin);
  }

  async function continueWithGoogle() {
    if (!onCanonicalOrigin()) return;
    setGoogleBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl(),
          queryParams: { prompt: "select_account" },
        },
      });
      if (result.error) throw result.error;
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : "BIS could not start Google sign-in.";
      setError(googleAuthErrorMessage(raw));
      setGoogleBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!onCanonicalOrigin()) return;
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
    if (!onCanonicalOrigin()) return;
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
      <section className="auth-story auth-story-simplified">
        <div className="brand"><span className="brand-symbol"><BisMark /></span><div><strong>BIS</strong><small>Behaviour Intelligence</small></div></div>
        <div>
          <p className="eyebrow">Behaviour Intelligence Series™</p>
          <h1>Behaviour comes before results.</h1>
        </div>
      </section>
      <section className="auth-card surface-card">
        <p className="eyebrow">{mode === "signin" ? "Welcome back" : "New to BIS"}</p>
        <h2>{mode === "signin" ? "Every habit tells a story." : "Create your BIS account."}</h2>
        <p>{mode === "signin" ? "Let's discover yours." : "After you sign up, BIS will open the right version of your learning programme."}</p>
        <div className="auth-mode" role="tablist" aria-label="Account action">
          <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => changeMode("signin")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Create account</button>
        </div>
        <div className="grid gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={busy || googleBusy || resendBusy}
            onClick={() => void continueWithGoogle()}
          >
            <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-black text-[#4285F4] shadow-sm">G</span>
            {googleBusy ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">or use email and password</p>
        </div>
        <form onSubmit={submit}>
          {mode === "signup" ? <label><span>Name</span><Input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} /></label> : null}
          <label><span>Email</span><Input type="email" autoComplete="email" value={email} onChange={(event) => updateEmail(event.target.value)} required /></label>
          <label><span>Password</span><Input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          {message ? <p className="auth-message" role="status">{message}</p> : null}
          <Button size="lg" className="w-full" disabled={busy || googleBusy || resendBusy}>{busy ? "Please wait…" : mode === "signin" ? <>Enter BIS <ArrowRight /></> : <>Create account <ArrowRight /></>}</Button>
          {mode === "signin" ? <Link href="/forgot-password" className="text-sm underline">Forgot your password?</Link> : null}
          {confirmationPending ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy || googleBusy || resendBusy || resendCooldown > 0}
              onClick={() => void resendConfirmation()}
            >
              {resendBusy ? "Requesting…" : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend verification email"}
            </Button>
          ) : null}
        </form>
        <small>Your sign-in keeps your learning and programme access private.</small>
      </section>
    </main>
  );
}
