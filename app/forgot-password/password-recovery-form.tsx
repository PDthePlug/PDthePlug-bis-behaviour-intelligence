"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { applicationOrigin, recoveryRedirectUrl } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordRecoveryForm({ mode }: { mode: "request" | "reset" }) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const origin = applicationOrigin(window.location.origin);
    if (origin !== window.location.origin) {
      window.location.replace(new URL(mode === "request" ? "/forgot-password" : "/reset-password", origin).toString());
      return;
    }
    if (mode === "reset" && password !== confirmation) {
      setError("The passwords do not match. Please enter them again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "request") {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: recoveryRedirectUrl(window.location.origin),
        });
        if (requestError) throw requestError;
      } else {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        setPassword("");
        setConfirmation("");
      }
      setComplete(true);
    } catch {
      setError(mode === "request"
        ? "BIS could not request a reset link right now. Wait a minute and try again."
        : "BIS could not update your password. Try a different password, or request a new reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story auth-story-simplified">
        <div className="brand"><span className="brand-symbol">B</span><div><strong>BIS</strong><small>Behaviour Intelligence</small></div></div>
        <div><p className="eyebrow">Your BIS account</p><h1>Continue your journey.</h1></div>
      </section>
      <section className="auth-card surface-card">
        <h2>{mode === "request" ? "Reset your password." : "Choose a new password."}</h2>
        {complete ? (
          <p role="status">{mode === "request"
            ? "If this email is linked to a BIS account, a reset link has been requested. Check your inbox and spam folder, and open it in this browser."
            : "Your password has been updated. Sign in with your new password."}</p>
        ) : (
          <form onSubmit={submit}>
            {mode === "request" ? (
              <label><span>Email</span><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            ) : (
              <>
                <label><span>New password</span><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
                <label><span>Confirm new password</span><Input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} /></label>
              </>
            )}
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <Button size="lg" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "request" ? "Send reset link" : "Update password"}</Button>
          </form>
        )}
        <Link href="/sign-in" className="text-sm underline">Back to sign in</Link>
        {mode === "reset" && !complete ? <Link href="/forgot-password" className="text-sm underline">Request a new reset link</Link> : null}
      </section>
    </main>
  );
}
