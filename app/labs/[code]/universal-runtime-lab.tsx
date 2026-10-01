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
import { serverUnlockedInvestigation } from "@/lib/lab-lifecycle-contract";
import { evaluateUniversalComputed } from "@/lib/universal-lab-v2.mjs";
import { EditionLanguageScope } from "@/components/learning/school-language-scope";

type Snapshot = {
  definition: UniversalLabPackage;
  version: string;
  identity: { id: string; displayName: string };
  deliveryEdition?: "school" | "emerging_adult" | "workplace";
  enrolment: null | {
    id: string;
    status: string;
    currentInvestigation: number;
    phaseACompletedAt?: string | null;
    experimentStartedAt?: string | null;
    completedAt?: string | null;
  };
  responses: Record<string, { value: unknown; status: string; recordedAt: string }>;
  computed?: Record<string, unknown>;
  experimentTiming?: null | {
    startedAt: string | null;
    availableDay: number;
    totalDays: number;
    today: string;
    reviewReady: boolean;
  };
};

function valueOf(snapshot: Snapshot, id: string) {
  const value = Object.prototype.hasOwnProperty.call(snapshot.computed ?? {}, id)
    ? snapshot.computed?.[id]
    : snapshot.responses[id]?.value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function multiValues(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value ? value.split("|").map((item) => item.trim()).filter(Boolean) : [];
  }
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
  const selected = prompt.type === "MULTI_SELECT" ? new Set(multiValues(value)) : new Set<string>();
  return (
    <section className={`prompt-section ${passed ? "passed" : ""}`} data-group={prompt.group || undefined}>
      <div className="prompt-number">{prompt.group ? prompt.group : prompt.id.split(".").slice(-1)[0]}</div>
      <div className="prompt-body">
        <h2>{prompt.label}</h2>
        {prompt.prompt !== prompt.label ? <p>{prompt.prompt}</p> : null}
        {prompt.readOnly ? (
          <div className="universal-computed-value" aria-live="polite">
            <strong>{value === "" ? "Calculated when the required evidence is available" : value}</strong>
            <small>Calculated by BIS from your recorded evidence.</small>
          </div>
        ) : passed ? (
          <p className="passed-note">You chose not to answer this question. You can add an answer before saving if you change your mind.</p>
        ) : (
          <div className="prompt-controls">
            {prompt.type === "INTEGER" ? (
              <Input
                type="number"
                min={prompt.min}
                max={prompt.max}
                value={value}
                onChange={(event) => onValue(event.target.value)}
              />
            ) : prompt.type === "DATE" ? (
              <Input type="date" value={value} onChange={(event) => onValue(event.target.value)} />
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
            ) : prompt.type === "MULTI_SELECT" ? (
              <div className="universal-multi-select">
                {(prompt.options ?? []).map((option) => (
                  <label key={option}>
                    <Checkbox
                      checked={selected.has(option)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selected);
                        if (checked === true) next.add(option); else next.delete(option);
                        onValue(JSON.stringify([...next]));
                      }}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <Textarea rows={4} value={value} onChange={(event) => onValue(event.target.value)} placeholder={prompt.placeholder ?? "Write what you noticed…"} />
            )}
          </div>
        )}
        {!prompt.readOnly ? (
          <label className="pass-control">
            <Checkbox checked={passed} onCheckedChange={(checked) => onPass(checked === true)} />
            <span>Prefer not to answer</span>
          </label>
        ) : null}
      </div>
    </section>
  );
}

function UniversalInvestigationForm({
  snapshot,
  investigation,
  step,
  saving,
  error,
  act,
  onAdvance,
  previewMode = false,
}: {
  snapshot: Snapshot;
  investigation: UniversalLabPackage["investigations"][number];
  step: number;
  saving: boolean;
  error: string;
  act: (payload: Record<string, unknown>) => Promise<Snapshot | null>;
  onAdvance: (saved: Snapshot, step: number) => void;
  previewMode?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(investigation.prompts.map((prompt) => [prompt.id, valueOf(snapshot, prompt.id)])),
  );
  const [passed, setPassed] = useState<Set<string>>(() =>
    new Set(investigation.prompts.filter((prompt) => snapshot.responses[prompt.id]?.status === "PASS").map((prompt) => prompt.id)),
  );
  const availableExperimentDay = previewMode
    ? (snapshot.definition.experiment?.days ?? 9)
    : (snapshot.experimentTiming?.availableDay ?? 0);
  const visiblePrompts = investigation.prompts.filter((prompt) =>
    !prompt.scheduleDay || prompt.scheduleDay <= availableExperimentDay,
  );
  const ready = useMemo(
    () => visiblePrompts.every((prompt) => {
      if (prompt.readOnly || !prompt.required || passed.has(prompt.id)) return true;
      const value = values[prompt.id] ?? "";
      return prompt.type === "MULTI_SELECT" ? multiValues(value).length > 0 : Boolean(value.trim());
    }),
    [passed, values, visiblePrompts],
  );

  const items = () => visiblePrompts
    .filter((prompt) => !prompt.readOnly)
    .map((prompt) => ({
      semanticFieldId: prompt.id,
      value: values[prompt.id] ?? "",
      responseStatus: passed.has(prompt.id) ? "PASS" : "ANSWERED",
    }));

  const promptById = new Map(investigation.prompts.map((prompt) => [prompt.id, prompt]));
  const blockPromptIds = new Set(
    (investigation.blocks ?? [])
      .filter((block) => block.type === "PROMPT")
      .map((block) => block.type === "PROMPT" ? block.promptId : ""),
  );
  const renderPrompt = (prompt: UniversalLabPrompt) => {
    if (prompt.scheduleDay && prompt.scheduleDay > availableExperimentDay) return null;
    return (
    <UniversalPrompt
      key={prompt.id}
      prompt={prompt}
      value={prompt.readOnly ? valueOf(snapshot, prompt.id) : (values[prompt.id] ?? "")}
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
    );
  };

  return (
    <div className="investigation-stack universal-package-lab">
      {snapshot.definition.runtimeProfile === "UNIVERSAL_V2"
        && step === snapshot.definition.experiment?.investigation
        && snapshot.definition.experiment ? (
        <section className="universal-experiment-status">
          <div>
            <span>Real-world experiment</span>
            <strong>{previewMode ? "Previewing all days" : `Day ${Math.max(1, snapshot.experimentTiming?.availableDay ?? 1)} of ${snapshot.definition.experiment.days}`}</strong>
          </div>
          <p>
            {previewMode
              ? "Preview mode shows the complete experiment structure."
              : snapshot.experimentTiming?.reviewReady
                ? "Your full experiment window is complete. Save the remaining evidence to continue to review."
                : "Only evidence for calendar days that have actually arrived can be recorded."}
          </p>
        </section>
      ) : null}
      {investigation.blocks?.length ? investigation.blocks.map((block, index) => {
        if (block.type === "HTML") {
          return <article key={`content-${index}`} className="story-card imported-lab-content" dangerouslySetInnerHTML={{ __html: block.html }} />;
        }
        const prompt = promptById.get(block.promptId);
        return prompt ? renderPrompt(prompt) : null;
      }) : (
        <>
          {investigation.introHtml ? <article className="story-card" dangerouslySetInnerHTML={{ __html: investigation.introHtml }} /> : null}
          {investigation.prompts.map(renderPrompt)}
        </>
      )}
      {investigation.blocks?.length
        ? investigation.prompts.filter((prompt) => !blockPromptIds.has(prompt.id)).map(renderPrompt)
        : null}
      {error ? <p className="field-error">{error}</p> : null}
      {snapshot.enrolment?.status === "COMPLETED" && step === 9 ? (
        <section className="corelab-certificate">
          <Check />
          <p className="eyebrow">Investigation complete</p>
          <h2>{snapshot.definition.identity.title}</h2>
          <p>{snapshot.identity.displayName}, your nine-investigation evidence trail is complete.</p>
          <p>This records completion of an investigation, not a judgment about you.</p>
        </section>
      ) : (
        <div className="step-footer">
          <span><ShieldCheck /> {previewMode ? "Preview mode · test answers are not saved." : "Saved as private, traceable evidence."}</span>
          {step === 9 ? (
            <Button size="lg" disabled={saving || !ready} onClick={() => void (async () => {
              const saved = await act({ action: "saveInvestigation", investigation: step, items: items() });
              if (saved) await act({ action: "completeLab" });
            })()}>
              {saving ? "Saving…" : <>Complete Lab <Check /></>}
            </Button>
          ) : (
            <Button size="lg" disabled={saving || !ready} onClick={() => void (async () => {
              const saved = await act({ action: "saveInvestigation", investigation: step, items: items() });
              if (!saved) return;
              const next = Math.min(9, step + 1);
              if (saved.enrolment && saved.enrolment.currentInvestigation >= next) onAdvance(saved, next);
            })()}>
              {saving
                ? "Saving…"
                : snapshot.definition.runtimeProfile === "UNIVERSAL_V2" && step === snapshot.definition.experiment?.investigation
                  ? snapshot.experimentTiming?.reviewReady
                    ? <>Save and continue to review <ArrowRight /></>
                    : <>Save today’s evidence <Check /></>
                  : <>Save and continue <ArrowRight /></>}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function UniversalRuntimeLab({
  labCode,
  previewVersionId,
}: {
  labCode: string;
  previewVersionId?: string;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewMode = Boolean(previewVersionId);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        let data: Snapshot & { error?: string };
        if (previewVersionId) {
          const response = await fetch(
            `/api/content-studio/preview?versionId=${encodeURIComponent(previewVersionId)}&artifact=${encodeURIComponent("lab:universal")}`,
            { cache: "no-store", signal: controller.signal },
          );
          const preview = await response.json() as {
            payload?: UniversalLabPackage;
            version?: { version?: string };
            error?: string;
          };
          if (!response.ok || !preview.payload) {
            throw new Error(preview.error ?? "The compiled Lab preview could not be opened.");
          }
          data = {
            definition: preview.payload,
            version: preview.version?.version ?? preview.payload.identity.version,
            identity: { id: "uat-reviewer", displayName: "UAT reviewer" },
            deliveryEdition: undefined,
            enrolment: null,
            responses: {},
            computed: {},
            experimentTiming: preview.payload.runtimeProfile === "UNIVERSAL_V2" && preview.payload.experiment ? {
              startedAt: new Date().toISOString(),
              availableDay: preview.payload.experiment.days,
              totalDays: preview.payload.experiment.days,
              today: new Date().toISOString().slice(0, 10),
              reviewReady: true,
            } : null,
          };
        } else {
          const response = await fetch(`/api/universal-lab?lab=${encodeURIComponent(labCode)}`, { cache: "no-store", signal: controller.signal });
          data = await response.json() as Snapshot & { error?: string };
          if (!response.ok) throw new Error(data.error ?? "The Lab could not be opened.");
        }
        if (controller.signal.aborted) return;
        setSnapshot(data);
        const requested = Number(new URLSearchParams(window.location.search).get("step"));
        const max = previewVersionId ? 9 : Math.max(1, data.enrolment?.currentInvestigation ?? 1);
        setStep(Number.isInteger(requested) && requested >= 1 ? Math.min(9, Math.max(1, requested)) : previewVersionId ? 1 : max);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The Lab could not be opened.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [labCode, previewVersionId]);

  const investigation = snapshot?.definition.investigations[step - 1];

  async function act(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      if (previewMode && snapshot) {
        const action = String(payload.action ?? "");
        let data: Snapshot = snapshot;
        if (action === "openLab") {
          data = {
            ...snapshot,
            enrolment: {
              id: "uat-preview",
              status: "IN_PROGRESS",
              currentInvestigation: 9,
              phaseACompletedAt: new Date().toISOString(),
              experimentStartedAt: new Date().toISOString(),
              completedAt: null,
            },
          };
        } else if (action === "saveInvestigation" && snapshot.enrolment) {
          const now = new Date().toISOString();
          const items = Array.isArray(payload.items) ? payload.items : [];
          const nextResponses = { ...snapshot.responses };
          for (const raw of items) {
            if (!raw || typeof raw !== "object") continue;
            const row = raw as Record<string, unknown>;
            const id = String(row.semanticFieldId ?? "");
            if (!id) continue;
            nextResponses[id] = {
              value: row.value ?? "",
              status: row.responseStatus === "PASS" ? "PASS" : "ANSWERED",
              recordedAt: now,
            };
          }
          data = {
            ...snapshot,
            responses: nextResponses,
            computed: snapshot.definition.runtimeProfile === "UNIVERSAL_V2"
              ? evaluateUniversalComputed(
                  snapshot.definition,
                  Object.fromEntries(Object.entries(nextResponses).map(([id, row]) => [id, row.value])),
                )
              : {},
          };
        } else if (action === "completeLab" && snapshot.enrolment) {
          data = {
            ...snapshot,
            enrolment: {
              ...snapshot.enrolment,
              status: "COMPLETED",
              completedAt: new Date().toISOString(),
            },
          };
        }
        setSnapshot(data);
        return data;
      }

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
    const max = previewMode ? 9 : Math.max(1, snapshot.enrolment?.currentInvestigation ?? 1);
    const target = Math.max(1, Math.min(max, next));
    setStep(target);
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(target));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) return <main className="learning-state"><LoaderCircle className="learning-loader" /><h1>Opening Lab…</h1></main>;
  if (!snapshot) return <main className="learning-state"><LockKeyhole /><h1>Lab unavailable</h1><p>{error}</p></main>;

  if (!snapshot.enrolment) {
    return (
      <EditionLanguageScope edition={snapshot.deliveryEdition}><main className="corelab-welcome fidelity-welcome universal-package-welcome" style={{ "--lab-accent": snapshot.definition.identity.accent } as React.CSSProperties}>
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
      </main></EditionLanguageScope>
    );
  }

  if (!investigation) return null;
  const maxStep = previewMode ? 9 : Math.max(1, snapshot.enrolment.currentInvestigation);

  return (
    <EditionLanguageScope edition={snapshot.deliveryEdition}><LabInvestigationFrame
      labTitle={snapshot.definition.identity.shortTitle}
      accent={snapshot.definition.identity.accent}
      investigations={snapshot.definition.investigations}
      step={step}
      maxStep={maxStep}
      onSelect={goToStep}
    >
      <UniversalInvestigationForm
        key={`${snapshot.version}:${step}:${snapshot.enrolment.status}:${snapshot.responses[investigation.prompts[0]?.id ?? ""]?.recordedAt ?? ""}`}
        snapshot={snapshot}
        investigation={investigation}
        step={step}
        saving={saving}
        error={error}
        act={act}
        previewMode={previewMode}
        onAdvance={(saved, requested) => {
          const target = previewMode
            ? requested
            : serverUnlockedInvestigation(saved.enrolment?.currentInvestigation, requested);
          if (target < requested) {
            setError("Your evidence was saved, but the next investigation is still locked. Please try again.");
            return;
          }
          setStep(target);
          const params = new URLSearchParams(searchParams.toString());
          params.set("step", String(target));
          router.push(`${pathname}?${params.toString()}`, { scroll: false });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </LabInvestigationFrame></EditionLanguageScope>
  );
}
