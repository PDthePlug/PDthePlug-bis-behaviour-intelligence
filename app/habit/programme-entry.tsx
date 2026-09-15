"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProgrammePlayer } from "../learning/programme-player";

type EntrySnapshot = {
  identity: { id: string; email: string; displayName: string };
  roles: string[];
  profile: null | {
    displayName: string;
    ageBand: string;
    mode: string;
    deliveryEdition?: "school" | "emerging_adult" | "workplace";
  };
  consent: null | { status: string; policyVersion: string };
};

type InitialSection = "today" | "learn";

function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">B</span>
      <div><strong>BIS</strong><small>Behaviour Intelligence</small></div>
    </div>
  );
}

function ProgrammeChoice({ active, title, detail, onClick }: { active: boolean; title: string; detail: string; onClick: () => void }) {
  return <button type="button" className={`choice-button ${active ? "selected" : ""}`} onClick={onClick}><span>{active ? <Check /> : null}</span><strong>{title}</strong><small>{detail}</small></button>;
}

export function ProgrammeEntry({
  initialIdentity,
  initialSection = "today",
}: {
  initialIdentity: { email: string; displayName: string };
  initialSection?: InitialSection;
}) {
  const [snapshot, setSnapshot] = useState<EntrySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [mode, setMode] = useState("INDEPENDENT");
  const [consent, setConsent] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bis", { cache: "no-store" });
      const data = await response.json() as EntrySnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error || "Your BIS learning environment could not be opened.");
      setSnapshot(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your BIS learning environment could not be opened.");
    } finally {
      setLoading(false);
    }
  }

  async function act(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as EntrySnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error || "That programme change could not be saved.");
      setSnapshot(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That programme change could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/bis", { cache: "no-store", signal: controller.signal });
        const data = await response.json() as EntrySnapshot & { error?: string };
        if (!response.ok) throw new Error(data.error || "Your BIS learning environment could not be opened.");
        if (!controller.signal.aborted) setSnapshot(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your BIS learning environment could not be opened.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  if (loading) {
    return <main className="learning-state"><span className="learning-loader"/><h1>Opening BIS…</h1><p>Loading your learner profile and current programme position.</p></main>;
  }

  if (!snapshot) {
    return <main className="learning-state"><ShieldCheck/><h1>Your learning environment could not open</h1><p>{error || "Please try again."}</p><Button onClick={() => void load()}>Try again</Button></main>;
  }

  if (snapshot.profile && snapshot.consent?.status === "GRANTED") {
    return <ProgrammePlayer initialSection={initialSection} />;
  }

  if (snapshot.profile && snapshot.consent?.status === "WITHDRAWN") {
    return <main className="privacy-paused"><div className="surface-card privacy-paused-card"><div className="card-icon teal"><LockKeyhole /></div><p className="eyebrow">Programme paused</p><h1>Your consent choice is active.</h1><p>Your authored programme place and existing evidence are preserved. Restore product consent when you want to continue.</p>{error && <p className="field-error">{error}</p>}<Button size="lg" disabled={saving} onClick={() => void act({ action: "restoreConsent" })}>{saving ? "Restoring…" : "Restore consent and return to BIS"}</Button></div></main>;
  }

  const hasStaffAccess = snapshot.roles.some((role) => ["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER"].includes(role));

  return (
    <main className="onboarding-shell">
      <div className="onboarding-header"><Brand /><Badge variant="outline">BIS learner profile</Badge></div>
      <section className="onboarding-intro">
        <div>
          <p className="eyebrow">Your learning profile starts here</p>
          <h1>One profile determines the right handbook edition across BIS.</h1>
          <p className="lede">Your classification is stored once. Every handbook inherits it, while each Lab keeps its formal evidence separate from your learning responses.</p>
          <div className="journey-line" aria-label="BIS learning journey">
            {["Learn", "Investigate", "Experiment", "Review"].map((label, index) => <div key={label}><span>{index + 1}</span><strong>{label}</strong></div>)}
          </div>
        </div>
        <div className="surface-card onboarding-card">
          <div className="privacy-heading"><LockKeyhole /><div><h2>Set up your learner profile</h2><p>Your age band resolves the correct authored delivery edition.</p></div></div>
          <label className="field-label">How are you taking BIS?</label>
          <div className="choice-grid two">
            <ProgrammeChoice active={mode === "INDEPENDENT"} title="On my own" detail="Independent learning journey" onClick={() => setMode("INDEPENDENT")} />
            <ProgrammeChoice active={mode === "FACILITATED"} title="With a facilitator" detail="Part of a guided programme" onClick={() => setMode("FACILITATED")} />
          </div>
          <label className="field-label" htmlFor="programme-age-band">Age band</label>
          <Select value={ageBand} onValueChange={setAgeBand}>
            <SelectTrigger id="programme-age-band" className="w-full"><SelectValue placeholder="Choose an age band" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="14-17">14–17 · School Edition</SelectItem>
              <SelectItem value="18-21">18–21 · Emerging Adult Edition</SelectItem>
              <SelectItem value="22-25">22–25 · Emerging Adult Edition</SelectItem>
              <SelectItem value="26+">26 or older · Workplace Edition</SelectItem>
            </SelectContent>
          </Select>
          <div className="privacy-copy"><ShieldCheck /><p><strong>Private by design:</strong> workbook responses, formal Lab inputs and field-experiment evidence remain distinct records. Facilitators only receive the visibility their role permits.</p></div>
          <label className="consent-row"><Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><span>I understand what BIS collects, why it is used, who may see it in my selected mode, and that safeguarding or legal duties may limit confidentiality.</span></label>
          {error && <p className="field-error">{error}</p>}
          <Button className="w-full" size="lg" disabled={saving || !ageBand || !consent} onClick={() => void act({ action: "setup", ageBand, mode, consent })}>{saving ? "Preparing BIS…" : <>Enter BIS <ArrowRight /></>}</Button>
          <p className="signed-in-note">Signed in as {snapshot.identity?.email ?? initialIdentity.email}</p>
          {hasStaffAccess && <p className="signed-in-note"><Link href="/workspace">Open role-restricted staff workspace</Link></p>}
        </div>
      </section>
    </main>
  );
}
