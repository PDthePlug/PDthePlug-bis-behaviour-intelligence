"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Eye, FlaskConical, LoaderCircle, LockKeyhole, Search, ShieldCheck } from "lucide-react";
import { LabInvestigationFrame } from "@/app/lab-investigation-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { UniversalLabPackage, UniversalLabPrompt } from "@/lib/content-compiler";
import { serverUnlockedInvestigation } from "@/lib/lab-lifecycle-contract";
import { evaluateUniversalComputed } from "@/lib/universal-lab-v2.mjs";
import { prepareUniversalLabPresentation } from "@/lib/universal-lab-presentation.mjs";
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
  index,
  value,
  passed,
  onValue,
  onPass,
}: {
  prompt: UniversalLabPrompt;
  index: number;
  value: string;
  passed: boolean;
  onValue: (value: string) => void;
  onPass: (value: boolean) => void;
}) {
  const selected = prompt.type === "MULTI_SELECT" ? new Set(multiValues(value)) : new Set<string>();
  const group = prompt.group
    && prompt.group !== "BIS Laboratory Standard"
    && !/^(?:BEI|TEI)-\d{2}\b/i.test(prompt.group)
    && !/\bbaseline\b/i.test(prompt.group)
    && !/^(?:investigate|evidence challenge|map your evidence|reflection|respond)$/i.test(prompt.group.trim())
      ? prompt.group
      : null;
  const categorical = prompt.type === "CATEGORICAL" && (prompt.options?.length ?? 0) > 0;
  const booleanChoices = prompt.type === "BOOLEAN";

  return (
    <section className={`prompt-section universal-prompt ${passed ? "passed" : ""}`} data-group={prompt.group || undefined}>
      <div className="prompt-number">{String(index).padStart(2, "0")}</div>
      <div className="prompt-body">
        {group ? <p className="prompt-kicker">{group}</p> : null}
        <h2 className={prompt.label.length > 90 ? "long-prompt-title" : undefined}>{prompt.label}</h2>
        {prompt.prompt !== prompt.label ? <p>{prompt.prompt}</p> : null}
        {prompt.readOnly ? (
          <div className="universal-computed-value" aria-live="polite">
            <strong>{value === "" ? "Calculated when the required evidence is available" : value}</strong>
            <small>Calculated by BIS from your recorded evidence.</small>
          </div>
        ) : (
          <>
            <div className={`prompt-controls ${passed ? "is-passed" : ""}`}>
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
              ) : booleanChoices ? (
                <div className="answer-list universal-choice-list" role="group" aria-label={prompt.label}>
                  {["Yes", "No"].map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={value === option ? "selected" : ""}
                      onClick={() => onValue(option)}
                    >
                      <span>{value === option ? <Check /> : null}</span>
                      {option}
                    </button>
                  ))}
                </div>
              ) : categorical ? (
                <div className="answer-list universal-choice-list" role="group" aria-label={prompt.label}>
                  {(prompt.options ?? []).map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={value === option ? "selected" : ""}
                      onClick={() => onValue(option)}
                    >
                      <span>{value === option ? <Check /> : null}</span>
                      {option}
                    </button>
                  ))}
                </div>
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
                <Textarea rows={4} value={value} onChange={(event) => onValue(event.target.value)} placeholder={prompt.placeholder ?? "Write your response here…"} />
              )}
            </div>
            {passed ? <p className="passed-note">Skipped for now. Start typing or choose an answer to respond.</p> : null}
          </>
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

function UniversalEvidenceTable({
  block,
  promptById,
  values,
  passed,
  onValue,
  onPass,
}: {
  block: Extract<NonNullable<UniversalLabPackage["investigations"][number]["blocks"]>[number], { type: "TABLE" }>;
  promptById: Map<string, UniversalLabPrompt>;
  values: Record<string, string>;
  passed: Set<string>;
  onValue: (promptId: string, value: string) => void;
  onPass: (promptId: string, value: boolean) => void;
}) {
  return (
    <section className="universal-evidence-table" aria-label={block.caption || "Evidence table"}>
      {block.caption ? <h2>{block.caption}</h2> : null}
      <div className="universal-evidence-table-scroll">
        <table>
          <thead>
            <tr>
              {block.headers.map((header, index) => <th scope="col" key={`${header}-${index}`}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => {
                  const header = block.headers[columnIndex] || `Column ${columnIndex + 1}`;
                  if (cell.kind === "TEXT") {
                    return <td key={columnIndex} data-label={header}><span className="universal-table-static">{cell.text}</span></td>;
                  }
                  const prompt = promptById.get(cell.promptId);
                  if (!prompt) return <td key={columnIndex} data-label={header} />;

                  if (cell.kind === "CHOICE") {
                    const selected = values[prompt.id] === cell.value;
                    return (
                      <td key={columnIndex} data-label={header} className="universal-table-choice">
                        <button
                          type="button"
                          className={selected ? "selected" : ""}
                          role="radio"
                          aria-checked={selected}
                          aria-label={`${prompt.prompt}: ${cell.value}`}
                          onClick={() => onValue(prompt.id, cell.value)}
                        >
                          <span aria-hidden="true">{selected ? "●" : "○"}</span>
                          <span className="universal-table-choice-label">{cell.value}</span>
                        </button>
                      </td>
                    );
                  }

                  const isPassed = passed.has(prompt.id);
                  const categoricalOptions = prompt.type === "BOOLEAN"
                    ? ["Yes", "No"]
                    : prompt.type === "CATEGORICAL"
                      ? (prompt.options ?? [])
                      : [];
                  return (
                    <td key={columnIndex} data-label={header} className={`universal-table-response ${isPassed ? "passed" : ""}`}>
                      <label className="universal-table-field">
                        <span>{header}</span>
                        {isPassed ? (
                          <small>Passed</small>
                        ) : prompt.type === "DATE" ? (
                          <Input
                            type="date"
                            value={values[prompt.id] ?? ""}
                            onChange={(event) => onValue(prompt.id, event.target.value)}
                            aria-label={prompt.prompt}
                          />
                        ) : categoricalOptions.length ? (
                          <Select value={values[prompt.id] ?? ""} onValueChange={(value) => onValue(prompt.id, value)}>
                            <SelectTrigger aria-label={prompt.prompt}><SelectValue placeholder="Choose" /></SelectTrigger>
                            <SelectContent>
                              {categoricalOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Textarea
                            rows={2}
                            value={values[prompt.id] ?? ""}
                            onChange={(event) => onValue(prompt.id, event.target.value)}
                            placeholder={prompt.placeholder ?? "Type your response…"}
                            aria-label={prompt.prompt}
                          />
                        )}
                      </label>
                      <label className="universal-table-pass">
                        <Checkbox checked={isPassed} onCheckedChange={(checked) => onPass(prompt.id, checked === true)} />
                        <span>Prefer not to answer</span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function baselinePrompts(definition: UniversalLabPackage) {
  return [
    ...(definition.presentationBaseline?.items ?? []),
    ...(definition.presentationBaseline?.metric ? [definition.presentationBaseline.metric] : []),
  ];
}

function baselineComplete(snapshot: Snapshot) {
  const required = baselinePrompts(snapshot.definition).filter((prompt) => prompt.required !== false && prompt.readOnly !== true);
  return required.length === 0 || required.every((prompt) => Boolean(snapshot.responses[prompt.id]));
}

function UniversalBaseline({
  snapshot,
  saving,
  error,
  act,
}: {
  snapshot: Snapshot;
  saving: boolean;
  error: string;
  act: (payload: Record<string, unknown>) => Promise<Snapshot | null>;
}) {
  const baseline = snapshot.definition.presentationBaseline!;

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      baseline.items.map((prompt) => [
        prompt.id,
        snapshot.responses[prompt.id]?.status === "PASS" ? "__PASS__" : valueOf(snapshot, prompt.id),
      ]),
    ),
  );
  const metric = baseline.metric ?? null;
  const initialMetric = metric ? Number(valueOf(snapshot, metric.id) || metric.min || 1) : 0;
  const [metricValue, setMetricValue] = useState(Number.isFinite(initialMetric) ? initialMetric : 1);
  const [metricPassed, setMetricPassed] = useState(Boolean(metric && snapshot.responses[metric.id]?.status === "PASS"));
  const complete = baseline.items.every((prompt) => Boolean(values[prompt.id]))
    && (!metric || metricPassed || Number.isFinite(metricValue));

  return (
    <EditionLanguageScope edition={snapshot.deliveryEdition}>
      <main
        className="baseline-shell corelab-baseline universal-baseline"
        style={{ "--lab-accent": snapshot.definition.identity.accent } as React.CSSProperties}
      >
        <section className="baseline-layout">
          <div className="baseline-copy">
            <Badge variant="outline">Starting point</Badge>
            <p className="eyebrow">Before Investigation 1</p>
            <h1>Create your starting point.</h1>
            <p>{baseline.introduction}</p>
            <div className="baseline-principles">
              <div><ShieldCheck /><span><strong>Private</strong>Your responses stay tied to this Lab.</span></div>
              <div><Eye /><span><strong>Editable</strong>You can correct an answer later.</span></div>
              <div><Search /><span><strong>Descriptive</strong>This records a starting pattern, not who you are.</span></div>
            </div>
          </div>

          <div className="surface-card baseline-card">
            <div className="section-title">
              <div>
                <p className="eyebrow">{baseline.title}</p>
                <h2>How often do you…</h2>
              </div>
              <Badge>{baseline.items.length} items</Badge>
            </div>

            <div className="baseline-items">
              {baseline.items.map((prompt, index) => (
                <div key={prompt.id}>
                  <span className="baseline-index">{String(index + 1).padStart(2, "0")}</span>
                  <label>{prompt.label}</label>
                  <Select
                    value={values[prompt.id] ?? ""}
                    onValueChange={(value) => setValues((current) => ({ ...current, [prompt.id]: value }))}
                  >
                    <SelectTrigger className="baseline-select"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>
                      {(prompt.options ?? ["Never", "Rarely", "Sometimes", "Often", "Always"]).map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                      <SelectItem value="__PASS__">Prefer not to answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {metric ? (
              <div className={`control-rating ${metricPassed ? "passed" : ""}`}>
                <div>
                  <p className="eyebrow">{metric.label}</p>
                  <h3>{metric.prompt === metric.label ? "How would you rate your starting point?" : metric.prompt}</h3>
                  <p>{metric.min ?? 1} = lower · {metric.max ?? 10} = higher</p>
                </div>
                <strong>{metricPassed ? "Passed" : <>{metricValue}<span>/{metric.max ?? 10}</span></>}</strong>
                {!metricPassed ? (
                  <Slider
                    value={[metricValue]}
                    min={metric.min ?? 1}
                    max={metric.max ?? 10}
                    step={1}
                    onValueChange={([value]) => setMetricValue(value)}
                  />
                ) : null}
                <label className="pass-control">
                  <Checkbox checked={metricPassed} onCheckedChange={(checked) => setMetricPassed(checked === true)} />
                  <span>Prefer not to answer</span>
                </label>
              </div>
            ) : null}

            {error ? <p className="field-error">{error}</p> : null}
            <Button
              className="w-full"
              size="lg"
              disabled={saving || !complete}
              onClick={() => void act({
                action: "saveInvestigation",
                investigation: 0,
                items: [
                  ...baseline.items.map((prompt) => ({
                    semanticFieldId: prompt.id,
                    value: values[prompt.id] === "__PASS__" ? "" : values[prompt.id],
                    responseStatus: values[prompt.id] === "__PASS__" ? "PASS" : "ANSWERED",
                  })),
                  ...(metric ? [{
                    semanticFieldId: metric.id,
                    value: metricValue,
                    responseStatus: metricPassed ? "PASS" : "ANSWERED",
                  }] : []),
                ],
              })}
            >
              {saving ? "Saving your starting point…" : <>Enter {snapshot.definition.identity.shortTitle} <ArrowRight /></>}
            </Button>
          </div>
        </section>
      </main>
    </EditionLanguageScope>
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
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
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

  const missingRequiredCount = visiblePrompts.filter((prompt) => {
    if (prompt.readOnly || !prompt.required || passed.has(prompt.id)) return false;
    const current = values[prompt.id] ?? "";
    return prompt.type === "MULTI_SELECT" ? multiValues(current).length === 0 : !current.trim();
  }).length;

  const guardSave = () => {
    if (ready) {
      setAttemptedSubmit(false);
      return true;
    }
    setAttemptedSubmit(true);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".universal-prompt:not(.passed)")?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });
    return false;
  };

  const promptById = new Map(investigation.prompts.map((prompt) => [prompt.id, prompt]));
  const promptOrder = new Map(visiblePrompts.map((prompt, index) => [prompt.id, index + 1]));
  const blockPromptIds = new Set(
    (investigation.blocks ?? []).flatMap((block) => {
      if (block.type === "PROMPT") return [block.promptId];
      if (block.type === "TABLE") {
        return block.rows.flatMap((row) =>
          row.flatMap((cell) => cell.kind === "PROMPT" || cell.kind === "CHOICE" ? [cell.promptId] : []),
        );
      }
      return [];
    }),
  );
  const updatePromptValue = (promptId: string, value: string) => {
    setValues((current) => ({ ...current, [promptId]: value }));
    setPassed((current) => {
      const next = new Set(current);
      next.delete(promptId);
      return next;
    });
  };
  const updatePromptPass = (promptId: string, value: boolean) => setPassed((current) => {
    const next = new Set(current);
    if (value) next.add(promptId); else next.delete(promptId);
    return next;
  });
  const renderPrompt = (prompt: UniversalLabPrompt) => {
    if (prompt.scheduleDay && prompt.scheduleDay > availableExperimentDay) return null;
    return (
      <UniversalPrompt
        key={prompt.id}
        prompt={prompt}
        index={promptOrder.get(prompt.id) ?? 1}
        value={prompt.readOnly ? valueOf(snapshot, prompt.id) : (values[prompt.id] ?? "")}
        passed={passed.has(prompt.id)}
        onValue={(value) => updatePromptValue(prompt.id, value)}
        onPass={(value) => updatePromptPass(prompt.id, value)}
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
          return <article key={`content-${index}`} className="imported-lab-content" dangerouslySetInnerHTML={{ __html: block.html }} />;
        }
        if (block.type === "TABLE") {
          return (
            <UniversalEvidenceTable
              key={block.id || `table-${index}`}
              block={block}
              promptById={promptById}
              values={values}
              passed={passed}
              onValue={updatePromptValue}
              onPass={updatePromptPass}
            />
          );
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
      {attemptedSubmit && !ready ? (
        <p className="universal-validation-note" role="alert">
          {missingRequiredCount === 1
            ? "One response still needs an answer or “Prefer not to answer”."
            : `${missingRequiredCount} responses still need an answer or “Prefer not to answer”.`}
        </p>
      ) : null}
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
          <span><ShieldCheck /> {previewMode ? "Preview mode · test answers are not saved." : "Your responses save privately to this Lab."}</span>
          {step === 9 ? (
            <Button size="lg" disabled={saving} onClick={() => void (async () => {
              if (!guardSave()) return;
              const saved = await act({ action: "saveInvestigation", investigation: step, items: items() });
              if (saved) await act({ action: "completeLab" });
            })()}>
              {saving ? "Saving…" : <>Complete Lab <Check /></>}
            </Button>
          ) : (
            <Button size="lg" disabled={saving} onClick={() => void (async () => {
              if (!guardSave()) return;
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
        data = {
          ...data,
          definition: prepareUniversalLabPresentation(data.definition) as UniversalLabPackage,
        };
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
      let data = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The Lab could not save your evidence.");
      data = {
        ...data,
        definition: prepareUniversalLabPresentation(data.definition) as UniversalLabPackage,
      };
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
    requestAnimationFrame(() => {
      document.getElementById("lab-investigation-start")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  if (loading) return <main className="learning-state"><LoaderCircle className="learning-loader" /><h1>Opening Lab…</h1></main>;
  if (!snapshot) return <main className="learning-state"><LockKeyhole /><h1>Lab unavailable</h1><p>{error}</p></main>;

  if (!snapshot.enrolment) {
    return (
      <EditionLanguageScope edition={snapshot.deliveryEdition}>
        <main
          className="corelab-welcome fidelity-welcome universal-package-welcome"
          style={{ "--lab-accent": snapshot.definition.identity.accent } as React.CSSProperties}
        >
          <section className="fidelity-hero universal-welcome-grid">
            <div className="universal-welcome-copy">
              <p className="eyebrow">Applied Commerce® · Behaviour Intelligence Series™</p>
              <h1>{snapshot.definition.identity.title}</h1>
              <p>{
                snapshot.definition.identity.focus
                  && !/source workbook|private behavioural investigation/i.test(snapshot.definition.identity.focus)
                  ? snapshot.definition.identity.focus
                  : "Investigate a real pattern, test what you think is happening, and build evidence from your own life."
              }</p>
              <div className="universal-welcome-meta">
                <span><strong>9</strong> investigations</span>
                <span><strong>1</strong> evidence trail</span>
                <span><strong>Private</strong> learner responses</span>
              </div>
            </div>
            <div className="surface-card corelab-start-card universal-start-card">
              <FlaskConical />
              <p className="eyebrow">Before you begin</p>
              <h2>Start with private evidence.</h2>
              <p>You will move through nine investigations: notice a pattern, form a working explanation, test it in real life, and review what the evidence actually shows. You may pass any question you are not ready to answer.</p>
              <label className="consent-row">
                <Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} />
                <span>I understand that my responses are private and will be used to build my evidence record for this Lab.</span>
              </label>
              {error ? <p className="field-error">{error}</p> : null}
              <Button size="lg" disabled={saving || !consent} onClick={() => void act({ action: "openLab", consent: true })}>
                {saving ? "Opening…" : <>Open {snapshot.definition.identity.shortTitle} <ArrowRight /></>}
              </Button>
            </div>
          </section>
        </main>
      </EditionLanguageScope>
    );
  }

  if (!previewMode && snapshot.definition.presentationBaseline && !baselineComplete(snapshot)) {
    return <UniversalBaseline snapshot={snapshot} saving={saving} error={error} act={act} />;
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
          requestAnimationFrame(() => {
            document.getElementById("lab-investigation-start")?.scrollIntoView({ block: "start", behavior: "smooth" });
          });
        }}
      />
    </LabInvestigationFrame></EditionLanguageScope>
  );
}
