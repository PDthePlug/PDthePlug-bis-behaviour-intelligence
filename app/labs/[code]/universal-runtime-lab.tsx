"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, FlaskConical, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { LabInvestigationFrame } from "@/app/lab-investigation-frame";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UniversalLabPackage, UniversalLabPrompt } from "@/lib/content-compiler";

type Snapshot = {
  definition: UniversalLabPackage;
  version: string;
  identity: { id: string; displayName: string };
  enrolment: null | {
    id: string;
    status: string;
    currentInvestigation: number;
    completedAt?: string | null;
  };
  responses: Record<string, { value: unknown; status: string; recordedAt: string }>;
};

function valueOf(snapshot: Snapshot, id: string) {
  const value = snapshot.responses[id]?.value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function UniversalPrompt({
  prompt,
  value,
  passed,
  onValue,
  onPass,
}: {
  prompt: UniversalLabPrompt;
  value: string;
  passed: boolean;
  onValue: (value: string) => void;
  onPass: (value: boolean) => void;
}) {
  return (
    <section className={`prompt-section ${passed ? "passed" : ""}`}>
      <div className="prompt-number">{prompt.id.split(".").slice(-1)[0]}</div>
      <div className="prompt-body">
        <h2>{prompt.label}</h2>
        <p>{prompt.prompt}</p>
        {passed ? (
          <p className="passed-note">You chose not to answer this question. You can add an answer before saving if you change your mind.</p>
        ) : (
          <div className="prompt-controls">
            {prompt.type === "INTEGER" ? (
              <Input type="number" value={value} onChange={(event) => onValue(event.target.value)} />
            ) : prompt.type === "BOOLEAN" ? (
              <Select value={value} onValueChange={onValue}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
              </Select>
            ) : prompt.type === "CATEGORICAL" ? (
              <Select value={value} onValueChange={onValue}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{(prompt.options ?? []).map((option) => <SelectItem value={option} key={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Textarea rows={4} value={value} onChange={(event) => onValue(event.target.value)} placeholder={prompt.placeholder ?? "Write what you noticed…"} />
            )}
          </div>
        )}
        <label className="pass-control">
          <Checkbox checked={passed} onCheckedChange={(checked) => onPass(checked === true)} />
          <span>Prefer not to answer</span>
        </label>
      </div>
    </section>
  );
}

export function UniversalRuntimeLab({ labCode }: { labCode: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [passed, setPassed] = useState<Set<string>>(() => new Set());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  async function load() {
    const response = await fetch(`/api/universal-lab?lab=${encodeURIComponent(labCode)}`, { cache: "no-store" });
    const data = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "The Lab could not be opened.");
    setSnapshot(data);
    return data;
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/universal-lab?lab=${encodeURIComponent(labCode)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as Snapshot & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "The Lab could not be opened.");
        if (controller.signal.aborted) return;
        setSnapshot(data);
        const requested = Number(new URLSearchParams(window.location.search).get("step"));
        const max = Math.max(1, data.enrolment?.currentInvestigation ?? 1);
        setStep(Number.isInteger(requested) && requested >= 1 ? Math.min(9, Math.max(1, requested)) : max);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The Lab could not be opened.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [labCode]);

  const investigation = snapshot?.definition.investigations[step - 1];
  useEffect(() => {
    if (!snapshot || !investigation) return;
    setValues(Object.fromEntries(investigation.prompts.map((prompt) => [prompt.id, valueOf(snapshot, prompt.id)])));
    setPassed(new Set(investigation.prompts.filter((prompt) => snapshot.responses[prompt.id]?.status === "PASS").map((prompt) => prompt.id)));
  }, [snapshot, investigation]);

  const ready = useMemo(
    () => investigation?.prompts.every((prompt) => !prompt.required || Boolean(values[prompt.id]?.trim()) || passed.has(prompt.id)) ?? false,
    [investigation, passed, values],
  );

  async function act(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/universal-lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ labCode, ...payload }),
      });
      const data = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The Lab could not save your evidence.");
      setSnapshot(data);
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Lab could not save your evidence.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  function goToStep(next: number) {
    if (!snapshot) return;
    const max = Math.max(1, snapshot.enrolment?.currentInvestigation ?? 1);
    const target = Math.max(1, Math.min(max, next));
    setStep(target);
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(target));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) return <main className="content-studio-gate"><LoaderCircle className="spin" /><h1>Opening Lab…</h1></main>;
  if (!snapshot) return <main className="content-studio-gate"><LockKeyhole /><h1>Lab unavailable</h1><p>{error}</p></main>;

  if (!snapshot.enrolment) {
    return (
      <main className="corelab-welcome fidelity-welcome universal-package-welcome" style={{ "--lab-accent": snapshot.definition.identity.accent } as React.CSSProperties}>
        <section className="fidelity-hero">
          <div>
            <p className="eyebrow">Behaviour Intelligence Series™ · Universal Lab</p>
            <h1>{snapshot.definition.identity.title}</h1>
            <p>{snapshot.definition.identity.focus ?? "A private behavioural investigation."}</p>
            <div className="surface-card canonical-card">
              <FlaskConical />
              <h2>Nine investigations. One evidence trail.</h2>
              <p>This Lab uses the shared BIS investigation system. Your responses remain separate from your learning-module reflections.</p>
            </div>
          </div>
          <div className="surface-card corelab-start-card">
            <ShieldCheck />
            <h2>Begin with private evidence.</h2>
            <p>You may pass any question you are not ready to answer. Corrections remain traceable.</p>
            <label className="consent-row">
              <Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} />
              <span>I understand that my Lab responses will be stored as private behavioural evidence for this investigation.</span>
            </label>
            {error ? <p className="field-error">{error}</p> : null}
            <Button size="lg" disabled={saving || !consent} onClick={() => void act({ action: "openLab", consent: true })}>
              {saving ? "Opening…" : <>Open {snapshot.definition.identity.shortTitle} <ArrowRight /></>}
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (!investigation) return null;
  const maxStep = Math.max(1, snapshot.enrolment.currentInvestigation);

  async function saveInvestigation() {
    const data = await act({
      action: "saveInvestigation",
      investigation: step,
      items: investigation.prompts.map((prompt) => ({
        semanticFieldId: prompt.id,
        value: values[prompt.id] ?? "",
        responseStatus: passed.has(prompt.id) ? "PASS" : "ANSWERED",
      })),
    });
    if (!data) return;
    if (step < 9) {
      const target = Math.min(9, step + 1);
      setStep(target);
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", String(target));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <LabInvestigationFrame
      labTitle={snapshot.definition.identity.shortTitle}
      accent={snapshot.definition.identity.accent}
      investigations={snapshot.definition.investigations}
      step={step}
      maxStep={maxStep}
      onSelect={goToStep}
    >
      <div className="investigation-stack universal-package-lab">
        {investigation.introHtml ? <article className="story-card" dangerouslySetInnerHTML={{ __html: investigation.introHtml }} /> : null}
        {investigation.prompts.map((prompt) => (
          <UniversalPrompt
            key={prompt.id}
            prompt={prompt}
            value={values[prompt.id] ?? ""}
            passed={passed.has(prompt.id)}
            onValue={(value) => {
              setValues((current) => ({ ...current, [prompt.id]: value }));
              setPassed((current) => {
                const next = new Set(current);
                next.delete(prompt.id);
                return next;
              });
            }}
            onPass={(value) => setPassed((current) => {
              const next = new Set(current);
              if (value) next.add(prompt.id); else next.delete(prompt.id);
              return next;
            })}
          />
        ))}
        {error ? <p className="field-error">{error}</p> : null}
        {snapshot.enrolment.status === "COMPLETED" && step === 9 ? (
          <section className="corelab-certificate">
            <Check />
            <p className="eyebrow">Investigation complete</p>
            <h2>{snapshot.definition.identity.title}</h2>
            <p>{snapshot.identity.displayName}, your nine-investigation evidence trail is complete.</p>
            <p>This records completion of an investigation, not a judgment about you.</p>
          </section>
        ) : (
          <div className="step-footer">
            <span><ShieldCheck /> Saved as private, traceable evidence.</span>
            {step === 9 ? (
              <Button size="lg" disabled={saving || !ready} onClick={() => void (async () => {
                const saved = await act({
                  action: "saveInvestigation",
                  investigation: step,
                  items: investigation.prompts.map((prompt) => ({
                    semanticFieldId: prompt.id,
                    value: values[prompt.id] ?? "",
                    responseStatus: passed.has(prompt.id) ? "PASS" : "ANSWERED",
                  })),
                });
                if (saved) await act({ action: "completeLab" });
              })()}>
                {saving ? "Saving…" : <>Complete Lab <Check /></>}
              </Button>
            ) : (
              <Button size="lg" disabled={saving || !ready} onClick={() => void saveInvestigation()}>
                {saving ? "Saving…" : <>Save and continue <ArrowRight /></>}
              </Button>
            )}
          </div>
        )}
      </div>
    </LabInvestigationFrame>
  );
}
