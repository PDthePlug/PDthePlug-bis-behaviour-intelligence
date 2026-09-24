"use client";

import { BisMark } from "@/components/brand/bis-mark";

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
      <span className="brand-symbol"><BisMark /></span>
      <div><strong>BIS</strong><small>Behaviour Intelligence</small></div>
    </div>
  );
}

function ProgrammeChoice({ active, title, detail, onClick }: { active: boolean; title: string; detail: string; onClick: () => void }) {
  return <button type="button" className={`choice-button ${active ? "selected" : ""}`} onClick={onClick}><span>{active ? <Check /> : null}</span><strong>{title}</strong><small>{detail}</small></button>;
}

export function ProgrammeEntry({
  moduleCode = "HAB",
  initialIdentity,
  initialSection = "today",
  initialLearnMode = "library",
}: {
  moduleCode?: string;
  initialIdentity: { email: string; displayName: string };
  initialSection?: InitialSection;
  initialLearnMode?: "library" | "reader";
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
      if (!response.ok) throw new Error(data.error || "That change could not be saved.");
      setSnapshot(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
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
    return <main className="learning-state"><span className="learning-loader"/><h1>Opening BIS…</h1><p>Getting your programme ready.</p></main>;
  }

  if (!snapshot) {
    return <main className="learning-state"><ShieldCheck/><h1>Your learning environment could not open</h1><p>{error || "Please try again."}</p><Button onClick={() => void load()}>Try again</Button></main>;
  }

  if (snapshot.profile && snapshot.consent?.status === "GRANTED") {
    return (
      <ProgrammePlayer
        key={`${moduleCode}:${initialSection}:${initialLearnMode}`}
        moduleCode={moduleCode}
        initialSection={initialSection}
        initialLearnMode={initialLearnMode}
      />
    );
  }

  if (snapshot.profile && snapshot.consent?.status === "WITHDRAWN") {
    return <main className="privacy-paused"><div className="surface-card privacy-paused-card"><div className="card-icon teal"><LockKeyhole /></div><p className="eyebrow">Programme paused</p><h1>Your consent choice is active.</h1><p>Your progress is saved. Restore consent whenever you want to continue.</p>{error && <p className="field-error">{error}</p>}<Button size="lg" disabled={saving} onClick={() => void act({ action: "restoreConsent" })}>{saving ? "Restoring…" : "Restore consent and continue"}</Button></div></main>;
  }

  const hasStaffAccess = snapshot.roles.some((role) => ["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER"].includes(role));

  return (
    <main className="onboarding-shell">
      <div className="onboarding-header"><Brand /><Badge variant="outline">Learner setup</Badge></div>
      <section className="onboarding-intro">
        <div>
          <p className="eyebrow">Your BIS journey starts here</p>
          <h1>Tell BIS a little about how you are learning.</h1>
          <p className="lede">Your age band helps us show the right learning material.</p>
          <div className="journey-line" aria-label="BIS learning journey">
            {["Learn", "Investigate", "Experiment", "Review"].map((label, index) => <div key={label}><span>{index + 1}</span><strong>{label}</strong></div>)}
          </div>
        </div>
        <div className="surface-card onboarding-card">
          <div className="privacy-heading"><LockKeyhole /><div><h2>Set up your learner profile</h2><p>Choose how you are taking BIS and your age band.</p></div></div>
          <label className="field-label">How are you taking BIS?</label>
          <div className="choice-grid two">
            <ProgrammeChoice active={mode === "INDEPENDENT"} title="On my own" detail="Independent learning journey" onClick={() => setMode("INDEPENDENT")} />
            <ProgrammeChoice active={mode === "FACILITATED"} title="With a facilitator" detail="Part of a guided programme" onClick={() => setMode("FACILITATED")} />
          </div>
          <label className="field-label" htmlFor="programme-age-band">Age band</label>
          <Select value={ageBand} onValueChange={setAgeBand}>
            <SelectTrigger id="programme-age-band" className="w-full"><SelectValue placeholder="Choose an age band" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="14-17">14–17</SelectItem>
              <SelectItem value="18-21">18–21</SelectItem>
              <SelectItem value="22-25">22–25</SelectItem>
              <SelectItem value="26+">26 or older</SelectItem>
            </SelectContent>
          </Select>
          <div className="privacy-copy"><ShieldCheck /><p><strong>Private by design:</strong> your learning answers, Lab work and experiment entries are kept separate. Facilitators only see what their role allows.</p></div>
          <label className="consent-row"><Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><span>I understand what BIS collects, why it is used, who may see it in my selected mode, and that safeguarding or legal duties may limit confidentiality.</span></label>
          {error && <p className="field-error">{error}</p>}
          <Button className="w-full" size="lg" disabled={saving || !ageBand || !consent} onClick={() => void act({ action: "setup", ageBand, mode, consent })}>{saving ? "Preparing BIS…" : <>Start BIS <ArrowRight /></>}</Button>
          <p className="signed-in-note">Signed in as {snapshot.identity?.email ?? initialIdentity.email}</p>
          {hasStaffAccess && <p className="signed-in-note"><Link href="/workspace">Open staff workspace</Link></p>}
        </div>
      </section>
    </main>
  );
}

