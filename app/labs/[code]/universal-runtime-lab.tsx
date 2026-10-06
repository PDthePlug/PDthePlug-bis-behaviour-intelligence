"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Eye, LoaderCircle, LockKeyhole, Search, ShieldCheck } from "lucide-react";
import { LabInvestigationFrame } from "@/app/lab-investigation-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UniversalLabPackage, UniversalLabPrompt } from "@/lib/content-compiler";
import { serverUnlockedInvestigation } from "@/lib/lab-lifecycle-contract";
import { evaluateUniversalComputed } from "@/lib/universal-lab-v2.mjs";
import { availableLabPrompts } from "@/lib/lab-interaction-contract.mjs";
import { validPromptResponse } from "@/lib/evidence-validation.mjs";
import { prepareUniversalLabPresentation } from "@/lib/universal-lab-presentation.mjs";
import { EditionLanguageScope } from "@/components/learning/school-language-scope";
import { EvidenceImages } from "@/components/evidence/evidence-images";

type Snapshot = {
  progressCompatibility?: { baselineAccepted: boolean; completedInvestigations: number[] };
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

const investigationEvidenceGuidance: Record<number, string> = {
  1: "Capture your first view before the pattern is explained. You will have evidence to compare later.",
  2: "Use a recent, specific example so you can see the pattern in real life.",
  3: "Describe what changed in your understanding and what evidence caused the shift.",
  4: "Anchor this to one real situation: what happened, what you noticed, and what followed.",
  5: "State the explanation that best fits your evidence. Keep it specific enough to test.",
  6: "Make the commitment observable: describe what you will do and the situation in which you will do it.",
  7: "Record what actually happened in the real-world test, including a valid no-opportunity result where it applies.",
  8: "Compare what you expected with the evidence you actually collected.",
  9: "Use your Lab evidence to describe what you learned and what you will carry forward.",
};

function UniversalPrompt({
  prompt,
  investigationNumber,
  value,
  passed,
  onValue,
  onPass,
}: {
  prompt: UniversalLabPrompt;
  investigationNumber: number;
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
    && !/^(?:investigate|evidence challenge|map your evidence|reflection|respond|think|predict|commit|evidence point|pause reflection|your response)$/i.test(prompt.group.replace(/^[^a-z]+/i, "").trim())
      ? prompt.group
      : null;
  const categorical = prompt.type === "CATEGORICAL" && (prompt.options?.length ?? 0) > 0;
  const booleanChoices = prompt.type === "BOOLEAN";
  const integerMin = Number(prompt.min);
  const integerMax = Number(prompt.max);
  const compactField =
    /^(?:signed|signed name|date|name|(?:my )?witness(?: \(.*\))?|(?:today\x27s|yesterday\x27s) phone time(?: so far)?|unread notifications|unreplied conversations)$/i.test(prompt.label.trim())
    && (prompt.type === "TEXT" || prompt.type === "DATE");

  const ratingScale =
    prompt.type === "INTEGER"
    && Number.isFinite(integerMin)
    && Number.isFinite(integerMax)
    && integerMax > integerMin
    && integerMax - integerMin <= 10
    && (prompt.controlRole === "RATING" || /confidence|control|rating|agency|deliberate|clarity|certainty|awareness|how much|how strongly/i.test(`${prompt.label} ${prompt.prompt}`));

  const titleId = `prompt-title-${prompt.id}`;
  const helpId = `prompt-help-${prompt.id}`;
  const authoredHelp = prompt.prompt !== prompt.label ? prompt.prompt : null;
  const interactionHelp = ratingScale
    ? "Choose the number that best matches your experience right now."
    : prompt.type === "TEXT" && prompt.label.length < 110
      ? investigationEvidenceGuidance[investigationNumber] ?? "Use a short, specific example that will still make sense when you review your evidence later."
      : null;
  const help = authoredHelp ?? interactionHelp;

  if (compactField) {
    return (
      <section data-prompt-id={prompt.id} className={`universal-compact-prompt ${passed ? "passed" : ""}`}>
        <label htmlFor={`compact-${prompt.id}`}>{prompt.label}</label>
        <Input
          id={`compact-${prompt.id}`}
          aria-describedby={help ? helpId : undefined}
          type={prompt.type === "DATE" ? "date" : "text"}
          disabled={passed}
          value={value}
          placeholder={prompt.type === "DATE" ? undefined : prompt.placeholder ?? prompt.label}
          onChange={(event) => onValue(event.target.value)}
        />
        {help ? <p id={helpId} className="universal-compact-help">{help}</p> : null}
        <label className="pass-control">
          <Checkbox checked={passed} onCheckedChange={(checked) => onPass(checked === true)} />
          <span>Prefer not to answer</span>
        </label>
      </section>
    );
  }

  return (
    <section data-prompt-id={prompt.id} className={`prompt-section universal-prompt ${passed ? "passed" : ""}`} data-group={prompt.group || undefined}>
      <div className="prompt-body">
        {group ? <p className="prompt-kicker">{group}</p> : null}
        <h2 id={titleId} className={prompt.label.length > 90 ? "long-prompt-title" : undefined}>{prompt.label}</h2>
        {help ? <p id={helpId}>{help}</p> : null}
        {prompt.readOnly ? (
          <div className="universal-computed-value" aria-live="polite">
            <strong>{value === "" ? "Calculated when the required evidence is available" : value}</strong>
            <small>Calculated by BIS from your recorded evidence.</small>
          </div>
        ) : (
          <>
            <div className={`prompt-controls ${passed ? "is-passed" : ""}`}>
              {ratingScale ? (
                <div className="universal-rating-scale" role="group" aria-label={prompt.label}>
                  <div className="universal-rating-options">
                    {Array.from(
                      { length: integerMax - integerMin + 1 },
                      (_, index) => integerMin + index,
                    ).map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={value === String(option) ? "selected" : ""}
                        aria-pressed={value === String(option)}
                        disabled={passed}
                        onClick={() => onValue(String(option))}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <div className="universal-rating-anchors">
                    <span>{integerMin} · {/confidence|confident/i.test(`${prompt.label} ${prompt.prompt}`) ? "Not confident" : "Lower"}</span>
                    <span>{integerMax} · {/confidence|confident/i.test(`${prompt.label} ${prompt.prompt}`) ? "Very confident" : "Higher"}</span>
                  </div>
                </div>
              ) : prompt.type === "INTEGER" ? (
                <Input
                  aria-labelledby={titleId}
                  aria-describedby={help ? helpId : undefined}
                  step={1}
                  type="number"
                  min={prompt.min}
                  max={prompt.max}
                  disabled={passed}
                  value={value}
                  onChange={(event) => onValue(event.target.value)}
                />
              ) : prompt.type === "DATE" ? (
                <Input aria-labelledby={titleId} aria-describedby={help ? helpId : undefined} type="date" disabled={passed} value={value} onChange={(event) => onValue(event.target.value)} />
              ) : booleanChoices ? (
                <div className="answer-list universal-choice-list" role="group" aria-label={prompt.label}>
                  {(prompt.allowNoOpportunity ? ["Yes", "No", "No opportunity"] : ["Yes", "No"]).map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={value === option ? "selected" : ""}
                      aria-pressed={value === option}
                      disabled={passed}
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
                      aria-pressed={value === option}
                      disabled={passed}
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
                        disabled={passed}
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
                <Textarea aria-labelledby={titleId} aria-describedby={help ? helpId : undefined} rows={3} disabled={passed} value={value} onChange={(event) => onValue(event.target.value)} placeholder={prompt.placeholder ?? "Write your response here…"} />
              )}
            </div>
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


function isScaffoldPrompt(prompt: UniversalLabPrompt) {
  return /\.SCAFFOLD\./.test(String(prompt.id));
}

function isEvidenceEpisodePair(first: UniversalLabPrompt, second: UniversalLabPrompt) {
  const firstLabel = first.label.trim().toLowerCase();
  const secondLabel = second.label.trim().toLowerCase();
  return (
    /^(?:what i said|the question i asked|the question i asked \(or should have asked\)|the question i should have asked)$/.test(firstLabel)
    && /^what happened next$/.test(secondLabel)
  );
}

function UniversalEvidenceEpisode({
  prompts,
  values,
  passed,
  onValue,
  onPass,
}: {
  prompts: [UniversalLabPrompt, UniversalLabPrompt];
  values: Record<string, string>;
  passed: Set<string>;
  onValue: (promptId: string, value: string) => void;
  onPass: (promptId: string, value: boolean) => void;
}) {
  return (
    <section className="universal-evidence-episode">
      {prompts.map((prompt) => {
        const isPassed = passed.has(prompt.id);
        return (
          <div data-prompt-id={prompt.id} className={`universal-evidence-episode-field ${isPassed ? "passed" : ""}`} key={prompt.id}>
            <label htmlFor={`episode-${prompt.id}`}>{prompt.label}</label>
            <Textarea
              id={`episode-${prompt.id}`}
              rows={3}
              disabled={isPassed}
              value={values[prompt.id] ?? ""}
              placeholder={prompt.placeholder ?? "Write your response…"}
              onChange={(event) => onValue(prompt.id, event.target.value)}
            />
            <label className="universal-collection-pass">
              <Checkbox checked={isPassed} onCheckedChange={(checked) => onPass(prompt.id, checked === true)} />
              <span>Prefer not to answer</span>
            </label>
          </div>
        );
      })}
    </section>
  );
}

function UniversalPromptCollection({
  prompts,
  values,
  passed,
  onValue,
  onPass,
  relatedLabels,
}: {
  prompts: UniversalLabPrompt[];
  values: Record<string, string>;
  passed: Set<string>;
  onValue: (promptId: string, value: string) => void;
  onPass: (promptId: string, value: boolean) => void;
  relatedLabels?: string[];
}) {
  const heading = prompts[0]?.group || prompts[0]?.prompt || "Your responses";
  return (
    <section className="universal-prompt-collection">
      <h2>{heading}</h2>
      <p className="universal-collection-guidance">Use your own words. Keep each answer specific enough that you can recognise it when you review your evidence later.</p>
      <div className="universal-collection-fields">
        {prompts.map((prompt, index) => {
          const isPassed = passed.has(prompt.id);
          const related = relatedLabels?.[index]?.trim();
          return (
            <div data-prompt-id={prompt.id} data-contextual={Boolean(related)} className={`universal-collection-row ${isPassed ? "passed" : ""}`} key={prompt.id}>
              <label htmlFor={`collection-${prompt.id}`}>
                <strong>{index + 1}.</strong>
                {related ? <span>{related}</span> : null}
              </label>
              <Input
                id={`collection-${prompt.id}`}
                aria-label={`${heading} — ${related || `Response ${index + 1}`}`}
                disabled={isPassed}
                value={values[prompt.id] ?? ""}
                onChange={(event) => onValue(prompt.id, event.target.value)}
                placeholder={related ? "How do you lead there?" : prompt.placeholder ?? "Write your response…"}
              />
              <label className="universal-collection-pass">
                <Checkbox checked={isPassed} onCheckedChange={(checked) => onPass(prompt.id, checked === true)} />
                <span>Prefer not to answer</span>
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UniversalInlineResponse({
  block,
  promptById,
  values,
  passed,
  onValue,
  onPass,
}: {
  block: Extract<NonNullable<UniversalLabPackage["investigations"][number]["blocks"]>[number], { type: "INLINE" }>;
  promptById: Map<string, UniversalLabPrompt>;
  values: Record<string, string>;
  passed: Set<string>;
  onValue: (promptId: string, value: string) => void;
  onPass: (promptId: string, value: boolean) => void;
}) {
  const inlinePrompts = block.segments
    .filter((segment) => segment.kind === "PROMPT")
    .map((segment) => promptById.get(segment.promptId))
    .filter((prompt): prompt is UniversalLabPrompt => Boolean(prompt));

  return (
    <section className="universal-inline-response">
      {block.instruction ? <p className="universal-activity-instruction">{block.instruction}</p> : null}
      <p className="universal-inline-sentence">
        {block.segments.map((segment, index) => {
          if (segment.kind === "TEXT") return <span key={`text-${index}`}>{segment.text}</span>;
          const prompt = promptById.get(segment.promptId);
          if (!prompt) return null;
          const isPassed = passed.has(prompt.id);
          const inputType = prompt.type === "DATE" ? "date" : prompt.type === "INTEGER" ? "number" : "text";
          return (
            <Input
              key={prompt.id}
              data-prompt-id={prompt.id}
              type={inputType}
              min={prompt.min}
              max={prompt.max}
              disabled={isPassed}
              aria-label={prompt.label}
              title={prompt.label}
              className={`universal-inline-input ${prompt.type === "DATE" ? "date" : ""}`}
              value={values[prompt.id] ?? ""}
              placeholder={isPassed ? "Passed" : prompt.placeholder ?? prompt.label}
              onChange={(event) => onValue(prompt.id, event.target.value)}
            />
          );
        })}
      </p>
      <div className="universal-inline-pass-list">
        {inlinePrompts.map((prompt) => (
          <label key={prompt.id}>
            <Checkbox
              checked={passed.has(prompt.id)}
              onCheckedChange={(checked) => onPass(prompt.id, checked === true)}
            />
            <span>Prefer not to answer · {prompt.label}</span>
          </label>
        ))}
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
  previewMode = false,
}: {
  block: Extract<NonNullable<UniversalLabPackage["investigations"][number]["blocks"]>[number], { type: "TABLE" }>;
  promptById: Map<string, UniversalLabPrompt>;
  values: Record<string, string>;
  passed: Set<string>;
  onValue: (promptId: string, value: string) => void;
  onPass: (promptId: string, value: boolean) => void;
  activeExperimentDay?: number | null;
  previewMode?: boolean;
}) {
  const visibleRows = block.rows.filter((row) => {
    const responseCells = row.filter((cell) => cell.kind === "PROMPT" || cell.kind === "CHOICE");
    return previewMode || !responseCells.length || responseCells.some((cell) => "promptId" in cell && promptById.has(cell.promptId));
  });

  return (
    <section className="universal-evidence-table" aria-label={block.caption || "Evidence table"}>
      {block.instruction ? <p className="universal-activity-instruction">{block.instruction}</p> : null}
      {block.caption ? <h2>{block.caption}</h2> : null}
      <div className="universal-evidence-table-scroll">
        <table>
          <thead>
            <tr>
              {block.headers.map((header, index) => <th scope="col" key={`${header}-${index}`}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
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
                          data-prompt-id={prompt.id}
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
                    ? (prompt.allowNoOpportunity ? ["Yes", "No", "No opportunity"] : ["Yes", "No"])
                    : prompt.type === "CATEGORICAL"
                      ? (prompt.options ?? [])
                      : [];
                  return (
                    <td data-prompt-id={prompt.id} key={columnIndex} data-label={header} className={`universal-table-response ${isPassed ? "passed" : ""}`}>
                      <label className="universal-table-field">
                        <span>{header}</span>
                        {prompt.readOnly ? (
                          <span className="universal-computed-value">{values[prompt.id] || "Waiting for the source evidence"}</span>
                        ) : isPassed ? (
                          <small>Passed</small>
                        ) : prompt.type === "DATE" ? (
                          <Input
                            type="date"
                            value={values[prompt.id] ?? ""}
                            onChange={(event) => onValue(prompt.id, event.target.value)}
                            aria-label={prompt.prompt}
                          />
                        ) : prompt.type === "INTEGER" && prompt.controlRole === "RATING" ? (
                          <span className="universal-rating-options" role="group" aria-label={prompt.prompt}>
                            {Array.from({ length: Number(prompt.max) - Number(prompt.min) + 1 }, (_, index) => Number(prompt.min) + index).map((option) => (
                              <button type="button" key={option} aria-pressed={values[prompt.id] === String(option)} className={values[prompt.id] === String(option) ? "selected" : ""} onClick={() => onValue(prompt.id, String(option))}>{option}</button>
                            ))}
                          </span>
                        ) : prompt.type === "INTEGER" ? (
                          <Input type="number" min={prompt.min} max={prompt.max} step={1} value={values[prompt.id] ?? ""} onChange={(event) => onValue(prompt.id, event.target.value)} aria-label={prompt.prompt} />
                        ) : categoricalOptions.length ? (
                          <Select disabled={isPassed} value={values[prompt.id] ?? ""} onValueChange={(value) => onValue(prompt.id, value)}>
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
                      {!prompt.readOnly ? <label className="universal-table-pass">
                        <Checkbox checked={isPassed} onCheckedChange={(checked) => onPass(prompt.id, checked === true)} />
                        <span>Prefer not to answer</span>
                      </label> : null}
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
  if (snapshot.progressCompatibility?.baselineAccepted) return true;
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
  const savedMetricValue = metric ? valueOf(snapshot, metric.id) : "";
  const initialMetric = savedMetricValue === "" ? null : Number(savedMetricValue);
  const [metricValue, setMetricValue] = useState<number | null>(
    initialMetric !== null && Number.isFinite(initialMetric) ? initialMetric : null,
  );
  const [metricPassed, setMetricPassed] = useState(Boolean(metric && snapshot.responses[metric.id]?.status === "PASS"));
  const complete = baseline.items.every((prompt) => Boolean(values[prompt.id]))
    && (!metric || metricPassed || metricValue !== null);

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
                <h2>Your current behaviours</h2>
              </div>
              <Badge>{baseline.items.length} items</Badge>
            </div>

            <div className="baseline-items">
              {baseline.items.map((prompt, index) => (
                <div key={prompt.id}>
                  <span className="baseline-index">{String(index + 1).padStart(2, "0")}</span>
                  <label id={`baseline-${prompt.id}`}>{prompt.prompt || prompt.label}</label>
                  <Select
                    value={values[prompt.id] ?? ""}
                    onValueChange={(value) => setValues((current) => ({ ...current, [prompt.id]: value }))}
                  >
                    <SelectTrigger aria-labelledby={`baseline-${prompt.id}`} className="baseline-select"><SelectValue placeholder="Choose" /></SelectTrigger>
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
                <strong>
                  {metricPassed
                    ? "Passed"
                    : metricValue === null
                      ? <>—<span>/{metric.max ?? 10}</span></>
                      : <>{metricValue}<span>/{metric.max ?? 10}</span></>}
                </strong>
                {!metricPassed ? (
                  <div className="universal-rating-scale" role="group" aria-label={metric.prompt}>
                    <div className="universal-rating-options">
                      {Array.from(
                        { length: (metric.max ?? 10) - (metric.min ?? 1) + 1 },
                        (_, index) => (metric.min ?? 1) + index,
                      ).map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={metricValue === option ? "selected" : ""}
                          aria-pressed={metricValue === option}
                          onClick={() => setMetricValue(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="universal-rating-anchors">
                      <span>{metric.min ?? 1} · lower</span>
                      <span>{metric.max ?? 10} · higher</span>
                    </div>
                  </div>
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
                    value: metricValue === null ? "" : String(metricValue),
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
  returnToProgramme = false,
}: {
  snapshot: Snapshot;
  investigation: UniversalLabPackage["investigations"][number];
  step: number;
  saving: boolean;
  error: string;
  act: (payload: Record<string, unknown>) => Promise<Snapshot | null>;
  onAdvance: (saved: Snapshot, step: number) => void;
  previewMode?: boolean;
  returnToProgramme?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(investigation.prompts.map((prompt) => [prompt.id, valueOf(snapshot, prompt.id)])),
  );
  const [passed, setPassed] = useState<Set<string>>(() =>
    new Set(investigation.prompts.filter((prompt) => snapshot.responses[prompt.id]?.status === "PASS").map((prompt) => prompt.id)),
  );
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [attachmentBlocked, setAttachmentBlocked] = useState(false);
  const isExperimentInvestigation =
    snapshot.definition.runtimeProfile === "UNIVERSAL_V2"
    && step === snapshot.definition.experiment?.investigation;
  const availableExperimentDay = previewMode
    ? (snapshot.definition.experiment?.days ?? 9)
    : (snapshot.experimentTiming?.availableDay ?? 0);
  const experimentWindowClosed = !previewMode && isExperimentInvestigation
    && availableExperimentDay > (snapshot.definition.experiment?.days ?? 0);
  const activeExperimentDay = previewMode || !isExperimentInvestigation
    ? null
    : availableExperimentDay;
  const visiblePrompts = availableLabPrompts(snapshot.definition, step, availableExperimentDay, previewMode);
  const previouslyCompleted = snapshot.progressCompatibility?.completedInvestigations.includes(step) ?? false;
  const ready = useMemo(
    () => visiblePrompts.every((prompt) => {
      if (previouslyCompleted || prompt.readOnly || !prompt.required || passed.has(prompt.id)) return true;
      const value = values[prompt.id] ?? "";
      return validPromptResponse(prompt, value, "ANSWERED");
    }),
    [passed, values, visiblePrompts, previouslyCompleted],
  );

  const items = () => visiblePrompts
    .filter((prompt) => !prompt.readOnly)
    .filter((prompt) => !previouslyCompleted || passed.has(prompt.id) || Boolean((values[prompt.id] ?? "").trim()))
    .map((prompt) => ({
      semanticFieldId: prompt.id,
      value: values[prompt.id] ?? "",
      responseStatus: passed.has(prompt.id) ? "PASS" : "ANSWERED",
    }));

  const missingRequiredPrompts = visiblePrompts.filter((prompt) => {
    if (previouslyCompleted || prompt.readOnly || !prompt.required || passed.has(prompt.id)) return false;
    const current = values[prompt.id] ?? "";
    return !validPromptResponse(prompt, current, "ANSWERED");
  });
  const missingRequiredCount = missingRequiredPrompts.length;

  const guardSave = () => {
    if (ready) {
      setAttemptedSubmit(false);
      return true;
    }
    setAttemptedSubmit(true);
    requestAnimationFrame(() => {
      const firstMissing = missingRequiredPrompts[0];
      if (!firstMissing) return;
      const field = document.querySelector<HTMLElement>(`[data-prompt-id="${CSS.escape(firstMissing.id)}"]`);
      field?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      const control = field?.matches("input, textarea, button, [role='combobox']")
        ? field : field?.querySelector<HTMLElement>("input:not([type='hidden']), textarea, button, [role='combobox']");
      control?.focus({ preventScroll: true });
    });
    return false;
  };

  const promptById = new Map(visiblePrompts.map((prompt) => [prompt.id, prompt]));
  const blockPromptIds = new Set(
    (investigation.blocks ?? []).flatMap((block) => {
      if (block.type === "PROMPT") return [block.promptId];
      if (block.type === "INLINE") {
        return block.segments.flatMap((segment) => segment.kind === "PROMPT" ? [segment.promptId] : []);
      }
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
    if (!promptById.has(prompt.id)) return null;
    return (
      <UniversalPrompt
        key={prompt.id}
        prompt={prompt}
        investigationNumber={investigation.number}
        value={prompt.readOnly ? valueOf(snapshot, prompt.id) : (values[prompt.id] ?? "")}
        passed={passed.has(prompt.id)}
        onValue={(value) => updatePromptValue(prompt.id, value)}
        onPass={(value) => updatePromptPass(prompt.id, value)}
      />
    );
  };

  const renderedBlocks = (() => {
    const nodes: React.ReactNode[] = [];
    const blocks = investigation.blocks ?? [];
    if (isExperimentInvestigation && !previewMode) {
      return [
        ...blocks.flatMap((block, index) => block.type === "HTML" && block.visibility !== "AFTER_EXPERIMENT" ? [(
          <article key={`instructions-${index}`} className="imported-lab-content" dangerouslySetInnerHTML={{ __html: block.html }} />
        )] : []),
        <section key="daily-entry" className="universal-daily-entry" aria-label="Current experiment evidence">
          <h2>Record one real moment</h2>
          <p>Describe what happened, record your action, and add what you noticed.</p>
          {visiblePrompts.filter((prompt) => !prompt.readOnly).map((prompt) => renderPrompt({ ...prompt, label: prompt.prompt || prompt.label, prompt: prompt.prompt || prompt.label }))}
        </section>,
      ];
    }
    let previousCollection: UniversalLabPrompt[] | null = null;

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];

      if (block.type === "HTML") {
        if (
          block.visibility === "AFTER_EXPERIMENT"
          && !previewMode
          && !snapshot.experimentTiming?.reviewReady
        ) {
          continue;
        }
        nodes.push(
          <article
            key={`content-${index}`}
            className="imported-lab-content"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />,
        );
        continue;
      }

      if (block.type === "TABLE") {
        nodes.push(
          <UniversalEvidenceTable
            key={block.id || `table-${index}`}
            block={block}
            promptById={promptById}
            values={{ ...values, ...Object.fromEntries(visiblePrompts.filter((prompt) => prompt.readOnly).map((prompt) => [prompt.id, valueOf(snapshot, prompt.id)])) }}
            passed={passed}
            onValue={updatePromptValue}
            onPass={updatePromptPass}
            activeExperimentDay={activeExperimentDay}
            previewMode={previewMode}
          />,
        );
        continue;
      }

      if (block.type === "INLINE") {
        nodes.push(
          <UniversalInlineResponse
            key={block.id || `inline-${index}`}
            block={block}
            promptById={promptById}
            values={values}
            passed={passed}
            onValue={updatePromptValue}
            onPass={updatePromptPass}
          />,
        );
        continue;
      }

      const prompt = promptById.get(block.promptId);
      if (!prompt) continue;

      const nextPromptBlock = blocks[index + 1];
      const nextPrompt =
        nextPromptBlock?.type === "PROMPT"
          ? promptById.get(nextPromptBlock.promptId)
          : undefined;
      if (nextPrompt && isEvidenceEpisodePair(prompt, nextPrompt)) {
        nodes.push(
          <UniversalEvidenceEpisode
            key={`evidence-episode-${index}`}
            prompts={[prompt, nextPrompt]}
            values={values}
            passed={passed}
            onValue={updatePromptValue}
            onPass={updatePromptPass}
          />,
        );
        index += 1;
        continue;
      }

      if (isScaffoldPrompt(prompt)) {
        const group = prompt.group || "";
        const collection: UniversalLabPrompt[] = [prompt];
        let cursor = index + 1;
        while (cursor < blocks.length) {
          const candidateBlock = blocks[cursor];
          if (candidateBlock.type !== "PROMPT") break;
          const candidate = promptById.get(candidateBlock.promptId);
          if (!candidate || !isScaffoldPrompt(candidate) || (candidate.group || "") !== group) break;
          collection.push(candidate);
          cursor += 1;
        }
        const relatedLabels =
          previousCollection
          && (/^for each\b/i.test(group) || /^how i lead\b/i.test(group))
            ? previousCollection.map((item) => values[item.id] ?? "")
            : undefined;
        nodes.push(
          <UniversalPromptCollection
            key={`collection-${group}-${index}`}
            prompts={collection}
            values={values}
            passed={passed}
            onValue={updatePromptValue}
            onPass={updatePromptPass}
            relatedLabels={relatedLabels}
          />,
        );
        previousCollection = collection;
        index = cursor - 1;
        continue;
      }

      const node = renderPrompt(prompt);
      if (node) nodes.push(node);
    }

    return nodes;
  })();

  return (
    <div className="investigation-stack universal-package-lab">
      {snapshot.definition.runtimeProfile === "UNIVERSAL_V2"
        && step === snapshot.definition.experiment?.investigation
        && snapshot.definition.experiment ? (
        <section className="universal-experiment-status">
          <div>
            <span>Real-world experiment</span>
            <strong>{previewMode ? "Previewing all days" : experimentWindowClosed ? "Evidence window finished" : snapshot.definition.experiment.cadence === "WEEKLY" ? `${visiblePrompts.find((prompt) => prompt.scheduleEndDay)?.group ?? "Weekly evidence"} · ${snapshot.definition.experiment.days}-day experiment` : `Day ${Math.max(1, snapshot.experimentTiming?.availableDay ?? 1)} of ${snapshot.definition.experiment.days}`}</strong>
          </div>
          <p>
            {previewMode
              ? "Preview mode shows the complete experiment structure."
              : experimentWindowClosed
                ? "Continue to review the evidence you recorded. Missed days remain missing."
                : snapshot.experimentTiming?.reviewReady
                ? "This is the final experiment day. Record today’s evidence to continue to review."
                : snapshot.definition.experiment.cadence === "WEEKLY"
                  ? "Record one action in the current weekly window. The next week opens on its calendar date."
                  : "Only today’s evidence is open. Tomorrow’s evidence unlocks when tomorrow arrives."}
          </p>
        </section>
      ) : null}
      {investigation.blocks?.length ? renderedBlocks : (
        <>
          {investigation.introHtml ? <article className="story-card" dangerouslySetInnerHTML={{ __html: investigation.introHtml }} /> : null}
          {investigation.prompts.map(renderPrompt)}
        </>
      )}
      {investigation.blocks?.length
        ? investigation.prompts.filter((prompt) => !blockPromptIds.has(prompt.id)).map(renderPrompt)
        : null}
      {isExperimentInvestigation && !previewMode && snapshot.enrolment ? <EvidenceImages key={`${snapshot.enrolment.id}:${step}`} enrollmentId={snapshot.enrolment.id} labCode={snapshot.definition.identity.code} investigation={step} evidenceFieldId={`${snapshot.definition.identity.code}.I${step}.OBSERVATION.IMAGE`} onBlockedChange={setAttachmentBlocked} /> : null}
      {error ? <p className="field-error">{error}</p> : null}
      {attemptedSubmit && !ready ? (
        <div className="universal-validation-note" role="alert">
          <strong>
            {missingRequiredCount === 1
              ? "One response still needs an answer or “Prefer not to answer”."
              : `${missingRequiredCount} responses still need an answer or “Prefer not to answer”.`}
          </strong>
          <span>{missingRequiredPrompts.slice(0, 4).map((prompt) => prompt.label).join(" · ")}</span>
        </div>
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
            <Button size="lg" disabled={saving || attachmentBlocked} onClick={() => void (async () => {
              if (experimentWindowClosed) {
                onAdvance(snapshot, snapshot.definition.experiment?.reviewInvestigation ?? 8);
                return;
              }
              if (!guardSave()) return;
              const saved = await act({ action: "saveInvestigation", investigation: step, items: items() });
              if (saved) await act({ action: "completeLab" });
            })()}>
              {saving ? "Saving…" : <>Complete Lab <Check /></>}
            </Button>
          ) : (
            <Button size="lg" disabled={saving || attachmentBlocked} onClick={() => void (async () => {
              if (experimentWindowClosed) {
                onAdvance(snapshot, snapshot.definition.experiment?.reviewInvestigation ?? 8);
                return;
              }
              if (!guardSave()) return;
              const saved = await act({ action: "saveInvestigation", investigation: step, items: items() });
              if (!saved) return;
              const next = Math.min(9, step + 1);
              const experimentStep =
                snapshot.definition.runtimeProfile === "UNIVERSAL_V2"
                && step === snapshot.definition.experiment?.investigation;
              if (experimentStep || (saved.enrolment && saved.enrolment.currentInvestigation >= next)) {
                onAdvance(saved, next);
              }
            })()}>
              {saving
                ? "Saving…"
                : experimentWindowClosed
                  ? <>Continue to evidence review <ArrowRight /></>
                  : snapshot.definition.runtimeProfile === "UNIVERSAL_V2" && step === snapshot.definition.experiment?.investigation
                  ? returnToProgramme
                    ? <>Save today’s evidence & return <ArrowRight /></>
                    : snapshot.experimentTiming?.reviewReady
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewMode = Boolean(previewVersionId);
  const programmeReturnTo = (() => {
    const value = searchParams.get("returnTo");
    return value?.startsWith("/") && !value.startsWith("//") ? value : null;
  })();

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
          setUnavailable(response.status === 404);
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
  }, [labCode, previewVersionId, loadAttempt]);

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
      if (
        String(payload.action ?? "") === "completeLab"
        && data.enrolment?.status === "COMPLETED"
        && programmeReturnTo
      ) {
        router.replace(programmeReturnTo);
      }
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
  if (!snapshot) return <main className="learning-state"><LockKeyhole /><h1>Lab unavailable</h1><p role="alert">{error}</p><div className="learning-state-actions">{!unavailable ? <Button onClick={() => { setLoading(true); setError(""); setLoadAttempt(attempt => attempt + 1); }}>Try again</Button> : null}<Button asChild variant="outline"><Link href="/labs">Back to the Lab library</Link></Button></div></main>;

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
              <h2>Before you begin</h2>
              <p>You can choose “Prefer not to answer” for any question.</p>
              <label className="consent-row">
                <Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} />
                <span>I agree to use my private responses to build my evidence record for this Lab.</span>
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
        key={`${snapshot.enrolment.id}:${snapshot.version}:${step}:${snapshot.enrolment.status}:${snapshot.responses[investigation.prompts[0]?.id ?? ""]?.recordedAt ?? ""}`}
        snapshot={snapshot}
        investigation={investigation}
        step={step}
        saving={saving}
        error={error}
        act={act}
        previewMode={previewMode}
        returnToProgramme={Boolean(programmeReturnTo)}
        onAdvance={(saved, requested) => {
          const experimentStep =
            snapshot.definition.runtimeProfile === "UNIVERSAL_V2"
            && step === snapshot.definition.experiment?.investigation;
          if (!previewMode && experimentStep && programmeReturnTo
            && (saved.experimentTiming?.availableDay ?? 0) <= (snapshot.definition.experiment?.days ?? 0)) {
            router.replace(programmeReturnTo);
            return;
          }

          const target = previewMode
            ? requested
            : serverUnlockedInvestigation(saved.enrolment?.currentInvestigation, requested);
          if (target < requested) {
            if (experimentStep) return;
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
