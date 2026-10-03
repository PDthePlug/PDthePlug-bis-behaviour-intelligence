"use client";

import { BisMark } from "@/components/brand/bis-mark";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Eye,
  FlaskConical,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { CoreLabDefinition, LabField } from "@/lib/core-labs";
import { serverUnlockedInvestigation } from "@/lib/lab-lifecycle-contract";
import { LabInvestigationFrame } from "./lab-investigation-frame";
import { EditionLanguageScope } from "@/components/learning/school-language-scope";
import { EvidenceImages } from "@/components/evidence/evidence-images";
import type { LearnerEdition } from "@/lib/school-language";

type Snapshot = {
  lab: { code: string; slug: string; version: string; title: string };
  identity: { id: string; email: string; displayName: string };
  profile: null | { displayName: string; timezone: string; deliveryEdition: "school" | "emerging_adult" | "workplace" };
  consent: null | { status: string };
  enrolment: null | { id: string; status: string; currentInvestigation: number };
  responses: Record<string, { value: unknown; status: string; responseId: string; recordedAt: string }>;
  hypothesis: null | { id: string; statement: string; falsificationStatement: string; learnerConfidence: number };
  experiment: null | {
    id: string;
    status: string;
    targetPattern: string;
    targetCondition: string;
    alternativeBehaviour: string;
    minimumVersion: string;
    predictedValue: number;
    startDate: string;
    plannedEndDate: string;
    impactDomains: string[];
  };
  events: Array<{
    id: string;
    dayNumber: number;
    eligibleOpportunity: boolean;
    alternativeUsed: boolean | null;
    details: Record<string, unknown> | null;
  }>;
  checkpoints: Array<{ id: string; dayNumber: number }>;
  measurements: Record<string, { value: unknown; status: string; evidenceStrength: string }>;
  timing: null | { calendarDay: number; totalDays: number; today: string };
  serverToday: string;
};

const scale = ["Never", "Rarely", "Sometimes", "Often", "Always"];
const domains = ["Health", "Money", "Relationships", "School", "Work", "Mental wellbeing"];

function valueOf(state: Snapshot, id: string, fallback = "") {
  const value = state.responses[id]?.value;
  return value === undefined || value === null ? fallback : String(value);
}

function numberOf(state: Snapshot, id: string, fallback = 5) {
  const value = Number(state.responses[id]?.value);
  return Number.isFinite(value) ? value : fallback;
}

function displayOf(state: Snapshot, id: string, fallback = "Not recorded") {
  const response = state.responses[id];
  if (!response) return fallback;
  if (response.status === "PASS") return "Passed by learner";
  return response.value === undefined || response.value === null || String(response.value).trim() === "" ? fallback : String(response.value);
}

function Brand() {
  return <Link className="brand" href="/"><span className="brand-symbol"><BisMark /></span><div><strong>BIS</strong><small>Behaviour Intelligence</small></div></Link>;
}

export function CoreLabExperience({ definition }: { definition: CoreLabDefinition }) {
  const [state, setState] = useState<Snapshot | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [privateVisible, setPrivateVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo =
    requestedReturnTo && requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/labs";

  // The selected Lab code is fixed for the lifetime of this route.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!privateVisible) return;
    let timeout = window.setTimeout(() => setPrivateVisible(false), 120_000);
    const reset = () => { window.clearTimeout(timeout); timeout = window.setTimeout(() => setPrivateVisible(false), 120_000); };
    const background = () => { if (document.visibilityState === "hidden") setPrivateVisible(false); };
    document.addEventListener("visibilitychange", background);
    for (const event of ["pointerdown", "keydown", "touchstart"] as const) window.addEventListener(event, reset, { passive: true });
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", background);
      for (const event of ["pointerdown", "keydown", "touchstart"] as const) window.removeEventListener(event, reset);
    };
  }, [privateVisible]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/labs?lab=${definition.code}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "This Lab could not open.");
      setState(result);
      setStep(Math.max(1, Math.min(9, result.enrolment?.currentInvestigation || 1)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This Lab could not open.");
    } finally {
      setLoading(false);
    }
  }

  async function act(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/labs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, labCode: definition.code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "That evidence could not be saved.");
      setState(result);
      return result as Snapshot;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That evidence could not be saved.");
      throw cause;
    } finally {
      setSaving(false);
    }
  }

  const edition = state?.profile?.deliveryEdition ?? null;

  if (loading) return <main className="corelab-loading"><Brand /><div /><div /></main>;
  if (!state) return <main className="corelab-empty"><Brand /><div className="surface-card"><LockKeyhole /><h1>This Lab could not open.</h1><p>{error}</p><Button onClick={() => void load()}>Try again</Button></div></main>;
  if (!state.profile || state.consent?.status !== "GRANTED") return <EditionLanguageScope edition={edition}><Prerequisite definition={definition} /></EditionLanguageScope>;
  if (!state.enrolment) return <EditionLanguageScope edition={edition}><LabWelcome definition={definition} saving={saving} error={error} onOpen={act} returnTo={returnTo} edition={edition} /></EditionLanguageScope>;

  const baselineComplete = Boolean(state.responses[definition.preMetric.id]) && definition.baselineItems.every(([id]) => Boolean(state.responses[id]));
  if (!baselineComplete) return <EditionLanguageScope edition={edition}><><div className={privateVisible ? "" : "privacy-obscured"} aria-hidden={!privateVisible}><Baseline definition={definition} state={state} saving={saving} error={error} act={act} /></div>{!privateVisible && <PrivacyCover definition={definition} state={state} onReveal={() => setPrivateVisible(true)} />}</></EditionLanguageScope>;

  const maxStep = Math.max(1, state.enrolment?.currentInvestigation ?? 1, step);
  const requestedStep = Number(searchParams.get("step"));
  const activeStep = Number.isInteger(requestedStep) && requestedStep >= 1
    ? Math.min(maxStep, requestedStep)
    : step;

  function navigateToStep(target: number) {
    setStep(target);
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(target));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToStep(next: number) {
    navigateToStep(Math.max(1, Math.min(maxStep, next)));
  }

  function goToSavedStep(saved: Snapshot, requested: number) {
    const target = serverUnlockedInvestigation(saved.enrolment?.currentInvestigation, requested);
    if (target < requested) {
      setError("Your evidence was saved, but the next investigation is still locked. Please try again.");
      return;
    }
    navigateToStep(target);
  }

  return <EditionLanguageScope edition={edition}><>
    <div className={`corelab-shell universal-corelab ${privateVisible ? "" : "privacy-obscured"}`} aria-hidden={!privateVisible} style={{ "--lab-accent": definition.accent } as React.CSSProperties}>
      {error && <div className="error-banner corelab-error"><span>{error}</span></div>}
      <LabInvestigationFrame
        labTitle={definition.shortTitle}
        accent={definition.accent}
        investigations={definition.investigations}
        step={activeStep}
        maxStep={maxStep}
        onSelect={goToStep}
      >
        {activeStep === 1 && <StoryOne definition={definition} state={state} saving={saving} act={act} next={(saved) => goToSavedStep(saved, 2)} />}
        {activeStep === 2 && <FieldsStep fields={definition.sections[2]} pauseQuestion={definition.pauses[2]} state={state} saving={saving} act={act} next={(saved) => goToSavedStep(saved, 3)} />}
        {activeStep === 3 && <StoryTwo definition={definition} state={state} saving={saving} act={act} next={(saved) => goToSavedStep(saved, 4)} />}
        {activeStep === 4 && <FieldsStep fields={definition.sections[4]} pauseQuestion={definition.pauses[4]} state={state} saving={saving} act={act} next={(saved) => goToSavedStep(saved, 5)} />}
        {activeStep === 5 && <EquationStep definition={definition} state={state} saving={saving} act={act} next={(saved) => goToSavedStep(saved, 6)} />}
        {activeStep === 6 && <ContractStep definition={definition} state={state} saving={saving} act={act} next={(saved) => goToSavedStep(saved, 7)} />}
        {activeStep === 7 && <CanonicalExperimentStep definition={definition} state={state} saving={saving} act={act} next={(saved) => goToSavedStep(saved, 8)} onDailySaved={() => router.replace(returnTo)} />}
        {activeStep === 8 && <ReviewStep definition={definition} state={state} saving={saving} act={act} next={(saved) => goToSavedStep(saved, 9)} />}
        {activeStep === 9 && <CanonicalFinalStep definition={definition} state={state} saving={saving} act={act} returnTo={returnTo} />}
      </LabInvestigationFrame>
    </div>
    {!privateVisible && <PrivacyCover definition={definition} state={state} onReveal={() => setPrivateVisible(true)} />}
  </></EditionLanguageScope>;
}

function Prerequisite({ definition }: { definition: CoreLabDefinition }) {
  return <main className="corelab-empty"><Brand /><div className="surface-card"><ShieldCheck /><p className="eyebrow">One private profile</p><h1>Set up BIS before opening {definition.shortTitle}.</h1><p>Your age band, mode and product consent are created once and then shared safely across your Labs. Lab evidence stays separate.</p><Link className="corelab-primary-link" href="/">Complete BIS setup <ArrowRight /></Link></div></main>;
}

function LabWelcome({
  definition,
  saving,
  error,
  onOpen,
  returnTo,
  edition,
}: {
  definition: CoreLabDefinition;
  saving: boolean;
  error: string;
  onOpen: (payload: Record<string, unknown>) => Promise<Snapshot>;
  returnTo: string;
  edition: LearnerEdition | null;
}) {
  const [consent, setConsent] = useState(false);
  const editionMeta = edition === "school"
    ? {
        badge: "School Edition",
        time: "About 90 minutes, then a 7-day real-world test",
        audience: "Ages 14–18 · No prior knowledge needed",
      }
    : edition === "emerging_adult"
      ? {
          badge: "Emerging Adult Edition",
          time: "About 90 minutes, then a 7-day real-world test",
          audience: "Ages 18–25 · Independent or facilitated",
        }
      : {
          badge: "Workplace Edition",
          time: "About 90 minutes, then a 7-day field test",
          audience: "Workplace participants · No prior BIS knowledge needed",
        };
  return <main className="corelab-welcome fidelity-welcome" style={{ "--lab-accent": definition.accent } as React.CSSProperties}>
    <header><Brand /><Link href={returnTo}>{returnTo === "/labs" ? "Back to Labs" : "Back to learning"}</Link></header>
    <section className="fidelity-hero">
      <div><Badge variant="outline">{editionMeta.badge}</Badge><p className="eyebrow">Applied Commerce® · Behaviour Intelligence Series™ · Volume 1</p><h1>{definition.title}</h1><p>{definition.focus}</p><dl><div><dt>Time</dt><dd>{editionMeta.time}</dd></div><div><dt>For</dt><dd>{editionMeta.audience}</dd></div></dl></div>
      <div className="surface-card corelab-start-card"><FlaskConical /><h2>Begin with a private baseline.</h2><p>This creates a separate {definition.shortTitle} enrolment with its own responses, equation, experiment and profile. Evidence from your other Labs remains unchanged.</p><label className="consent-row"><Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} /><span>I understand how my private {definition.shortTitle} responses, daily observations and calculated BEIs will be stored. I may skip a question I am not ready to answer and may pause product consent from Settings.</span></label>{error && <p className="field-error">{error}</p>}<Button size="lg" disabled={saving || !consent} onClick={() => void onOpen({ action: "openLab", consent: true })}>{saving ? "Opening…" : <>Open {definition.shortTitle} <ArrowRight /></>}</Button></div>
    </section>
    <section className="fidelity-reference">
      <article className="surface-card canonical-card"><p className="eyebrow">What this Lab is (and isn&apos;t)</p>{definition.scope.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<h3>This Lab does not investigate:</h3><ul>{definition.scope.exclusions.map((item) => <li key={item}>{item}</li>)}</ul>{definition.scope.closing && <p>{definition.scope.closing}</p>}</article>
      <article className="surface-card canonical-card"><p className="eyebrow">Facilitation time architecture</p><ul><li>Core workbook time: ~50–55 minutes</li><li>Facilitated discussion/debrief: ~20 minutes</li><li>Transitions/recovery/pair work: ~10 minutes</li><li>Setup/closing: ~10 minutes</li><li>Total session envelope: 90 minutes</li></ul><p className="eyebrow">Investigation tools</p><p>📖 Read · 🤔 Predict · ⏸ Pause · 🔍 Investigate · ✍️ Write · ⚖️ Decide · 🤝 Commit · 📊 Track · 🌱 Reflect · ⭐ Evidence Point · 🔎 Evidence Challenge · 👁️ Observer Question · 🧠 Think</p><p className="eyebrow">Behavioural difficulty indicator</p><ul><li>🟢 Observe — Low cognitive load: information gathering</li><li>🟡 Analyse — Medium cognitive load: pattern recognition</li><li>🟠 Challenge Yourself — High cognitive load: personal confrontation</li><li>🔴 Deep Integration — Highest cognitive load: integrating evidence into self-understanding</li></ul></article>
      <article className="surface-card canonical-card canonical-wide"><p className="eyebrow">How BIS tracks progress</p><p>BIS gives each key measure a BEI code so the same result can be tracked consistently from start to finish.</p><div className="canonical-table-wrap"><table><thead><tr><th>Code</th><th>Behaviour Evidence Indicator</th><th>Location</th></tr></thead><tbody>{definition.beis.map(([code, label, location]) => <tr key={code}><td>{code}</td><td>{label}</td><td>{location}</td></tr>)}</tbody></table></div><h3>Derived measures</h3><ul>{definition.derivedMeasures.map((item) => <li key={item}>{item}</li>)}</ul><p><strong>BEI-03:</strong> Predicted {definition.code === "DEC" ? "Decision" : "Spending"} Pause Rate is recorded in Investigation 6 and scored in Investigation 7.</p></article>
      <article className="surface-card canonical-card canonical-wide"><p className="eyebrow">Privacy and consent</p><p>This workbook is yours. It contains your personal behavioural evidence.</p><h3>What you write here:</h3><ul>{definition.privacy.uses.map((item) => <li key={item}>{item}</li>)}</ul><h3>Your facilitator will explain:</h3><ul>{definition.privacy.facilitator.map((item) => <li key={item}>{item}</li>)}</ul><h3>You have the right to:</h3><ul>{definition.privacy.rights.map((item) => <li key={item}>{item}</li>)}</ul><p>Your digital acknowledgement above replaces the handwritten learner signature. If you are under 18, a parent or guardian should also consent where required.</p></article>
    </section>
  </main>;
}

function PrivacyCover({ definition, state, onReveal }: { definition: CoreLabDefinition; state: Snapshot; onReveal: () => void }) {
  const progress = Math.max(0, Math.min(9, state.enrolment?.currentInvestigation ?? 0));
  return <main className="privacy-screen" role="dialog" aria-modal="true"><div className="privacy-screen-card"><Brand /><div className="privacy-screen-icon"><LockKeyhole /></div><p className="eyebrow">Privacy screen active</p><h1>Your {definition.shortTitle} evidence is hidden.</h1><p>Your answers, equation and daily observations stay covered until you choose to continue.</p><div className="privacy-safe-progress"><span>{definition.shortTitle} progress</span><strong>{progress} / 9</strong><Progress value={(progress / 9) * 100} /></div><div className="privacy-screen-actions"><Button size="lg" onClick={onReveal}><Eye /> Reveal this session</Button><a href="/auth/signout" target="_top"><LockKeyhole /> Lock and sign out</a></div><small>The screen covers itself after two minutes or when this tab is hidden.</small></div></main>;
}

function Baseline({ definition, state, saving, error, act }: { definition: CoreLabDefinition; state: Snapshot; saving: boolean; error: string; act: (payload: Record<string, unknown>) => Promise<Snapshot> }) {
  const [ratings, setRatings] = useState<Record<string, string>>(() => Object.fromEntries(definition.baselineItems.map(([id]) => [id, state.responses[id]?.status === "PASS" ? "__PASS__" : valueOf(state, id)])));
  const [metric, setMetric] = useState(numberOf(state, definition.preMetric.id));
  const [metricPass, setMetricPass] = useState(state.responses[definition.preMetric.id]?.status === "PASS");
  const complete = definition.baselineItems.every(([id]) => ratings[id]);
  return <main className="baseline-shell corelab-baseline" style={{ "--lab-accent": definition.accent } as React.CSSProperties}><div className="baseline-top"><Brand /><div><Badge variant="outline">Starting point</Badge><strong>{definition.shortTitle}</strong></div></div><section className="baseline-layout"><div className="baseline-copy"><p className="eyebrow">{definition.code === "DEC" ? "Decision" : "Spending Behaviour"} Baseline — Pre</p><h1>Create your starting point.</h1><p>Before you begin, complete this starting check-in. Be honest. This is information to help you notice your starting point, not a judgment. The only thing being tested is the pattern, not you.</p><div className="baseline-principles"><div><ShieldCheck /><span><strong>Private</strong>Separate from your other Labs</span></div><div><Eye /><span><strong>Editable</strong>You can correct an answer later</span></div><div><Search /><span><strong>Descriptive</strong>No overall personality score</span></div></div></div><div className="surface-card baseline-card"><div className="section-title"><div><p className="eyebrow">BEI-02 · {definition.code === "DEC" ? "Decision Baseline Profile" : "Spending Behaviour Baseline Profile"}</p><h2>{definition.code === "DEC" ? "When you face a decision that matters to you, how often do you…" : "When you have a spending moment, how often do you…"}</h2></div><Badge>10 items</Badge></div><div className="baseline-items">{definition.baselineItems.map(([id, label], index) => <div key={id}><span className="baseline-index">{String(index + 1).padStart(2, "0")}</span><label>{label}</label><Select value={ratings[id]} onValueChange={(value) => setRatings({ ...ratings, [id]: value })}><SelectTrigger className="baseline-select"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{scale.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}<SelectItem value="__PASS__">Prefer not to answer</SelectItem></SelectContent></Select></div>)}</div><div className={`control-rating ${metricPass ? "passed" : ""}`}><div><p className="eyebrow">{definition.preMetric.label}</p><h3>{definition.preMetric.prompt}</h3><p>1 = {definition.preMetric.low} · 10 = {definition.preMetric.high}</p></div><strong>{metricPass ? "Passed" : <>{metric}<span>/10</span></>}</strong>{!metricPass && <Slider value={[metric]} min={1} max={10} step={1} onValueChange={([value]) => setMetric(value)} />}<PassControl passed={metricPass} onChange={setMetricPass} /></div>{error && <p className="field-error">{error}</p>}<Button className="w-full" size="lg" disabled={saving || !complete} onClick={() => void act({ action: "saveResponses", items: [...definition.baselineItems.map(([semanticFieldId]) => ({ semanticFieldId, value: ratings[semanticFieldId], responseStatus: ratings[semanticFieldId] === "__PASS__" ? "PASS" : "ANSWERED" })), { semanticFieldId: definition.preMetric.id, value: metric, responseStatus: metricPass ? "PASS" : "ANSWERED" }] })}>{saving ? "Saving…" : <>Enter {definition.shortTitle} <ArrowRight /></>}</Button></div></section></main>;
}

function StoryOne({ definition, state, saving, act, next }: StepProps & { definition: CoreLabDefinition }) {
  const field = definition.storyOne.prediction;
  const [prediction, setPrediction] = useState(valueOf(state, field.id));
  const [passed, setPassed] = useState(state.responses[field.id]?.status === "PASS");
  return <div className="investigation-stack"><article className="story-card"><div className="story-heading"><BookOpen /><div><small>Episode 1</small><h2>{definition.storyOne.title}</h2></div></div>{definition.storyOne.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article><article className="prompt-card"><p className="prompt-kicker"><Search /> Predict</p><h3>{field.prompt}</h3><div className="answer-list">{definition.storyOne.choices.map((choice) => <button key={choice} className={prediction === choice ? "selected" : ""} onClick={() => { setPrediction(choice); setPassed(false); }}><span>{prediction === choice ? <Check /> : null}</span>{choice}</button>)}</div><p className="method-note">({definition.storyOne.note})</p><PassControl passed={passed} onChange={(nextPassed) => { setPassed(nextPassed); if (nextPassed) setPrediction(""); }} /></article><PauseCard question={definition.pauses[1]} /><SaveFooter saving={saving} disabled={!prediction && !passed} onSave={async () => { const saved = await act({ action: "saveResponses", items: [{ semanticFieldId: field.id, value: prediction, responseStatus: passed ? "PASS" : "ANSWERED" }] }); next(saved); }} /></div>;
}

type StepProps = { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<Snapshot>; next: (saved: Snapshot) => void };

function StoryTwo({ definition, state, saving, act, next }: StepProps & { definition: CoreLabDefinition }) {
  const field = definition.storyTwo.reflection;
  const [reflection, setReflection] = useState(valueOf(state, field.id));
  const correctField = definition.storyTwo.correctField;
  const [correct, setCorrect] = useState(valueOf(state, correctField.id));
  const [passed, setPassed] = useState(() => new Set([correctField.id, field.id].filter((id) => state.responses[id]?.status === "PASS")));
  const togglePass = (id: string, nextPassed: boolean) => setPassed((current) => { const next = new Set(current); if (nextPassed) next.add(id); else next.delete(id); return next; });
  return <div className="investigation-stack"><article className="story-card revelation"><div className="story-heading"><Sparkles /><div><small>Episode 2</small><h2>{definition.storyTwo.title}</h2></div></div>{definition.storyTwo.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article><div className="observer-card"><Eye /><div><strong>The Observer</strong><p>{definition.storyTwo.observer}</p></div></div><section className="prompt-section"><div className="prompt-number">03</div><div className="prompt-body"><h2>Were You Correct?</h2><p>Look back at your prediction. {correctField.prompt}</p><div className="corelab-choice-row"><Button variant={correct === "Yes" ? "default" : "outline"} onClick={() => { setCorrect("Yes"); togglePass(correctField.id, false); }}>Yes</Button><Button variant={correct === "No" ? "default" : "outline"} onClick={() => { setCorrect("No"); togglePass(correctField.id, false); }}>No</Button></div><PassControl passed={passed.has(correctField.id)} onChange={(nextPassed) => { togglePass(correctField.id, nextPassed); if (nextPassed) setCorrect(""); }} /></div></section><Prompt field={field} value={reflection} onChange={setReflection} passed={passed.has(field.id)} onPass={(nextPassed) => { togglePass(field.id, nextPassed); if (nextPassed) setReflection(""); }} /><SaveFooter saving={saving} disabled={(!correct && !passed.has(correctField.id)) || (!reflection.trim() && !passed.has(field.id))} onSave={async () => { const saved = await act({ action: "saveResponses", items: [{ semanticFieldId: correctField.id, value: correct, responseStatus: passed.has(correctField.id) ? "PASS" : "ANSWERED" }, { semanticFieldId: field.id, value: reflection, responseStatus: passed.has(field.id) ? "PASS" : "ANSWERED" }] }); next(saved); }} /></div>;
}

function FieldsStep({ fields, pauseQuestion, state, saving, act, next }: StepProps & { fields: LabField[]; pauseQuestion?: string }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.id, valueOf(state, field.id)])));
  const [passed, setPassed] = useState(() => new Set(fields.filter((field) => state.responses[field.id]?.status === "PASS").map((field) => field.id)));
  const ready = fields.every((field) => values[field.id]?.trim() || passed.has(field.id));
  return <div className="investigation-stack">{fields.map((field) => <Prompt key={field.id} field={field} value={values[field.id]} onChange={(value) => { setValues({ ...values, [field.id]: value }); setPassed((current) => { const next = new Set(current); next.delete(field.id); return next; }); }} passed={passed.has(field.id)} onPass={(nextPassed) => setPassed((current) => { const next = new Set(current); if (nextPassed) next.add(field.id); else next.delete(field.id); return next; })} />)}{pauseQuestion && <PauseCard question={pauseQuestion} />}<SaveFooter saving={saving} disabled={!ready} onSave={async () => { const saved = await act({ action: "saveResponses", items: fields.map((field) => ({ semanticFieldId: field.id, value: field.type === "INTEGER" ? Number(values[field.id]) : values[field.id], responseStatus: passed.has(field.id) ? "PASS" : "ANSWERED" })) }); next(saved); }} /></div>;
}

function EquationStep({ definition, state, saving, act, next }: StepProps & { definition: CoreLabDefinition }) {
  const [statement, setStatement] = useState(valueOf(state, `${definition.prefix}.EQUATION.TEXT`));
  const [falsification, setFalsification] = useState(valueOf(state, `${definition.prefix}.FALSIFICATION.TEXT`));
  const [confidence, setConfidence] = useState(numberOf(state, definition.confidencePre));
  const extraFields = [
    { id: `${definition.prefix}.FALSIFICATION.EVIDENCE`, label: "What would change my view", prompt: "What evidence would convince you that you've misunderstood this pattern?", investigation: 5 },
    { id: `${definition.prefix}.I5.OBSERVER.TEXT`, label: "Observer Question", prompt: definition.code === "DEC" ? "If someone who knows you well looked at this equation, what would they agree with? What would they challenge?" : "If someone who knows you well looked at this equation, what would they agree with? What would they challenge?", investigation: 5 },
    { id: `${definition.prefix}.I5.INSIGHT.TEXT`, label: "Today's Insight", prompt: "If this week were evidence about what you can influence, what would it suggest?", investigation: 5 },
  ];
  const [extraValues, setExtraValues] = useState<Record<string, string>>(() => Object.fromEntries(extraFields.map((field) => [field.id, valueOf(state, field.id)])));
  const [passed, setPassed] = useState(() => new Set(extraFields.filter((field) => state.responses[field.id]?.status === "PASS").map((field) => field.id)));
  const [corePassed, setCorePassed] = useState([`${definition.prefix}.EQUATION.TEXT`, `${definition.prefix}.FALSIFICATION.TEXT`, definition.confidencePre].every((id) => state.responses[id]?.status === "PASS"));
  const extrasReady = extraFields.every((field) => extraValues[field.id]?.trim() || passed.has(field.id));
  return <div className="investigation-stack"><article className={`equation-card ${corePassed ? "passed" : ""}`}><p className="eyebrow">Your current {definition.shortTitle.replace(" Lab", "")} Equation</p><h2>Write your current explanation of {definition.code === "DEC" ? "how you make decisions" : "how you relate to spending"}.</h2><p>Use this form:</p><p><strong>{definition.equation.template}</strong></p><p>This isn&apos;t a verdict. It&apos;s a working explanation that the next seven days will test.</p>{!corePassed && <Textarea rows={6} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Write your working equation…" />}<PassControl passed={corePassed} onChange={(nextPassed) => { setCorePassed(nextPassed); if (nextPassed) { setStatement(""); setFalsification(""); } }} label="Skip the explanation, change-my-mind and confidence questions" /></article><section className="surface-card equation-examples"><div className="section-title"><div><p className="eyebrow">Example Working Equations</p><h3>Use the structure, not somebody else&apos;s answer.</h3></div></div><div>{definition.equation.examples.map(([label, example]) => <article key={label}><strong>{label}</strong><span>{example}</span></article>)}</div></section>{!corePassed && <><Prompt field={{ id: "falsification", label: "What would change my mind?", prompt: `If I'm wrong about this ${definition.code === "DEC" ? "decision" : "spending"} pattern, what would I see?`, investigation: 5 }} value={falsification} onChange={setFalsification} /><div className="canonical-note"><strong>Examples:</strong><ul>{definition.code === "DEC" ? <><li>If I&apos;m wrong, pausing before choosing would not change the options I see.</li><li>If I&apos;m wrong, I would still feel rushed even when I have time to pause.</li><li>If I&apos;m wrong, looking harder would not reveal any options that actually address what matters to me.</li></> : <><li>If I&apos;m wrong, the trigger would not actually appear before the spending moment.</li><li>If I&apos;m wrong, pausing would not change what I notice or choose.</li><li>If I&apos;m wrong, the purchase would actually give me exactly what I expected it would.</li></>}</ul></div><ScaleField label={`BEI-04 · ${definition.code === "DEC" ? "Decision" : "Money"} Equation Confidence (Pre) — How confident are you that this equation explains the ${definition.code === "DEC" ? "decision" : "spending"} pattern you investigated?`} value={confidence} onChange={setConfidence} /></>}{extraFields.map((field) => <Prompt key={field.id} field={field} value={extraValues[field.id]} onChange={(value) => { setExtraValues({ ...extraValues, [field.id]: value }); setPassed((current) => { const nextSet = new Set(current); nextSet.delete(field.id); return nextSet; }); }} passed={passed.has(field.id)} onPass={(nextPassed) => setPassed((current) => { const nextSet = new Set(current); if (nextPassed) nextSet.add(field.id); else nextSet.delete(field.id); return nextSet; })} />)}<SaveFooter saving={saving} disabled={(!corePassed && (!statement.trim() || !falsification.trim())) || !extrasReady} onSave={async () => { await act({ action: "saveResponses", items: extraFields.map((field) => ({ semanticFieldId: field.id, value: extraValues[field.id], responseStatus: passed.has(field.id) ? "PASS" : "ANSWERED" })) }); const saved = await act({ action: "saveHypothesis", statement, falsificationStatement: falsification, learnerConfidence: confidence, passCore: corePassed }); next(saved); }} /></div>;
}

function ContractStep({ definition, state, saving, act, next }: StepProps & { definition: CoreLabDefinition }) {
  const defaultPattern = valueOf(state, `${definition.prefix}.PATTERN.TARGET`);
  const [form, setForm] = useState({ targetPattern: defaultPattern, targetCondition: "", pause: definition.experiment.fullPause, minimumPause: definition.experiment.minimumPause, expectedValue: "", witness: "", restartPlan: "", failureSignal: "", startDate: state.serverToday });
  const [prediction, setPrediction] = useState(70);
  const [impact, setImpact] = useState<string[]>([]);
  const [signature, setSignature] = useState(valueOf(state, `${definition.prefix}.CONTRACT.SIGNATURE`));
  const [insight, setInsight] = useState(valueOf(state, `${definition.prefix}.CONTRACT.INSIGHT`));
  const [insightPassed, setInsightPassed] = useState(state.responses[`${definition.prefix}.CONTRACT.INSIGHT`]?.status === "PASS");
  const ready = [form.targetPattern, form.targetCondition, form.pause, form.minimumPause, form.restartPlan, form.failureSignal, form.startDate, signature].every((value) => value.trim()) && (insight.trim() || insightPassed);
  if (state.experiment) return <div className="corelab-waiting surface-card"><CalendarDays /><p className="eyebrow">Your seven-day test has already started</p><h2>Your seven-day test follows its own calendar.</h2><p>Continue to Investigation 7. Your original plan and observations are still saved.</p><Button onClick={() => next(state)}>Open seven-day test <ArrowRight /></Button></div>;
  const endDate = new Date(`${form.startDate}T00:00:00Z`); endDate.setUTCDate(endDate.getUTCDate() + 6);
  return <div className="investigation-stack"><div className="contract-intro"><ShieldCheck /><div><p className="eyebrow">Your seven-day plan</p><h2>Decide what you will count before you begin.</h2><p>Your minimum Pause still counts. If the matching situation never comes up, record that honestly—it is not a failure.</p></div></div><div className="contract-grid"><Prompt field={{ id: "pattern", label: definition.experiment.patternLabel, prompt: "Name the specific pattern you will track.", investigation: 6 }} value={form.targetPattern} onChange={(targetPattern) => setForm({ ...form, targetPattern })} /><Prompt field={{ id: "condition", label: "My target condition", prompt: definition.code === "DEC" ? "The decision situation I am watching for (time, place, feeling, type of choice):" : "The spending situation I am watching for (time, place, feeling, type of purchase):", investigation: 6 }} value={form.targetCondition} onChange={(targetCondition) => setForm({ ...form, targetCondition })} /><Prompt field={{ id: "pause", label: `My ${definition.experiment.pauseName}`, prompt: definition.code === "DEC" ? "What I will do when I notice a matching decision situation:" : "What I will do when I notice a matching spending situation:", investigation: 6 }} value={form.pause} onChange={(pause) => setForm({ ...form, pause })} /><Prompt field={{ id: "minimum", label: definition.code === "DEC" ? "My minimum version" : "My minimum Pause", prompt: definition.code === "DEC" ? "The smallest pause I can do on my worst day:" : "The smallest version that still counts as pausing:", investigation: 6 }} value={form.minimumPause} onChange={(minimumPause) => setForm({ ...form, minimumPause })} /><Prompt field={{ id: "witness", label: "My witness", prompt: "Who will hold me accountable? This may be left blank.", investigation: 6 }} value={form.witness} onChange={(witness) => setForm({ ...form, witness })} /><Prompt field={{ id: "restart", label: "My restart plan", prompt: "What will I do if I forget to pause?", investigation: 6 }} value={form.restartPlan} onChange={(restartPlan) => setForm({ ...form, restartPlan })} /><Prompt field={{ id: "failure", label: "My failure signal", prompt: "How will I know if this experiment is not working?", investigation: 6 }} value={form.failureSignal} onChange={(failureSignal) => setForm({ ...form, failureSignal })} /></div><section className="prompt-section"><div className="prompt-number">05</div><div className="prompt-body"><h2>BEI-05 · Where this affects my life · {definition.code === "DEC" ? "Decision" : "Spending"} Impact Profile</h2><p>{definition.code === "DEC" ? "My decisions most affect:" : "My spending most affects:"}</p><div className="domain-grid">{domains.map((domain) => <label key={domain}><Checkbox checked={impact.includes(domain)} onCheckedChange={(checked) => setImpact(checked ? [...impact, domain] : impact.filter((item) => item !== domain))} />{domain}</label>)}</div><p>Domains affected: {impact.length} / 6</p></div></section><section className="prompt-section"><div className="prompt-number">06</div><div className="prompt-body"><h2>BEI-03 · What I expect · {definition.code === "DEC" ? "Decision" : "Spending"} Pause Rate</h2><p>{definition.code === "DEC" ? "When a decision matching your target situation comes up, how often do you think you will complete your Decision Pause before choosing?" : "When a spending situation matching your target comes up, how often do you think you will complete at least your minimum Pause before choosing?"}</p><div className="prompt-controls"><strong className="prediction-value">{prediction}<span>%</span></strong><Slider value={[prediction]} min={0} max={100} step={5} onValueChange={([value]) => setPrediction(value)} /><label className="date-field">Seven-day test starts<Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label></div></div></section><section className="surface-card commitment-card"><p className="eyebrow">My Commitment Statement</p><blockquote>“I, {signature || "________________"}, {definition.experiment.commitment.replace(/^I /, "") } Starting on {form.startDate || "__________"} and ending on {Number.isNaN(endDate.getTime()) ? "__________" : endDate.toISOString().slice(0, 10)}.”</blockquote><label>Signed<Input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="Type your name" /></label><p>Date: {state.serverToday}</p></section><Prompt field={{ id: `${definition.prefix}.CONTRACT.INSIGHT`, label: "Today's Insight", prompt: definition.experiment.insightPrompt, investigation: 6 }} value={insight} onChange={setInsight} passed={insightPassed} onPass={(nextPassed) => { setInsightPassed(nextPassed); if (nextPassed) setInsight(""); }} /><SaveFooter saving={saving} disabled={!ready} onSave={async () => { await act({ action: "saveResponses", items: [{ semanticFieldId: `${definition.prefix}.CONTRACT.SIGNATURE`, value: signature }, { semanticFieldId: `${definition.prefix}.CONTRACT.INSIGHT`, value: insight, responseStatus: insightPassed ? "PASS" : "ANSWERED" }] }); const saved = await act({ action: "startExperiment", ...form, expectedValue: definition.code === "DEC" ? "What changes when I pause" : "What the purchase actually gives me", predictedValue: prediction, impactDomains: impact }); next(saved); }} label="Start seven-day test" /></div>;
}

/* Legacy generic renderer retained only to protect rollback compatibility. */
/* eslint-disable @typescript-eslint/no-unused-vars */
function ExperimentStep({ definition, state, saving, act, next }: StepProps & { definition: CoreLabDefinition }) {
  const experiment = state.experiment;
  const calendarDayRaw = state.timing?.calendarDay ?? 0;
  const unlocked = Math.max(0, Math.min(7, calendarDayRaw));
  const todayDay = calendarDayRaw >= 1 && calendarDayRaw <= 7 ? calendarDayRaw : null;
  const [day, setDay] = useState(Math.max(1, Math.min(7, todayDay ?? 1)));
  const recorded = state.events.find((event) => event.dayNumber === day);
  const [opportunity, setOpportunity] = useState(recorded?.eligibleOpportunity ?? true);
  const [pauseCompleted, setPauseCompleted] = useState(recorded?.alternativeUsed ?? false);
  const [pauseType, setPauseType] = useState(String(recorded?.details?.pauseType ?? "Full"));
  const [outcomeCategory, setOutcomeCategory] = useState(String(recorded?.details?.outcomeCategory ?? "Bought as originally intended"));
  const [extraOption, setExtraOption] = useState(recorded?.details?.extraOption === true);
  const [details, setDetails] = useState<Record<string, string>>(() => Object.fromEntries(definition.experiment.eventFields.map(([key]) => [key, String(recorded?.details?.[key] ?? "")])));
  const adherence = state.measurements[`${definition.prefix}.BEI06`]?.value;
  const accuracy = state.measurements[`${definition.prefix}.BEI03`]?.value;
  const predictionFieldId = `${definition.prefix}.I7.PREDICTION_REFLECTION`;
  const [predictionReflection, setPredictionReflection] = useState(valueOf(state, predictionFieldId));
  const [predictionPassed, setPredictionPassed] = useState(state.responses[predictionFieldId]?.status === "PASS");

  function selectDay(nextDay: number) {
    const event = state.events.find((item) => item.dayNumber === nextDay);
    setDay(nextDay);
    setOpportunity(event?.eligibleOpportunity ?? true);
    setPauseCompleted(event?.alternativeUsed ?? false);
    setPauseType(String(event?.details?.pauseType ?? "Full"));
    setOutcomeCategory(String(event?.details?.outcomeCategory ?? "Bought as originally intended"));
    setExtraOption(event?.details?.extraOption === true);
    setDetails(Object.fromEntries(definition.experiment.eventFields.map(([key]) => [key, String(event?.details?.[key] ?? "")])));
  }

  if (!experiment) return <div className="corelab-waiting surface-card"><CalendarDays /><h2>Your experiment has not started.</h2><p>Complete Investigation 6 to define what counts and choose the start date.</p></div>;
  if (experiment.status !== "ACTIVE") return <div className="corelab-waiting surface-card"><Check /><p className="eyebrow">Seven days reviewed</p><h2>Your seven-day record is complete.</h2><p>Your daily entries remain unchanged. Continue to compare pre and post ratings and review the working equation.</p><Button onClick={() => next(state)}>Open review <ArrowRight /></Button></div>;

  return <div className="investigation-stack"><div className="experiment-hero"><div><p className="eyebrow">Target condition</p><h2>{experiment.targetCondition}</h2></div><div className="alternative-chip"><span>{definition.experiment.pauseName}</span><strong>{experiment.alternativeBehaviour}</strong></div></div><div className="corelab-day-grid"><section className="surface-card days-card"><div className="section-title"><div><p className="eyebrow">Your seven days</p><h3>One observation day opens at a time</h3><p>Past days stay as recorded—or remain missing. Future days unlock only on their calendar day.</p></div><CalendarDays /></div><div className="day-list">{Array.from({ length: 7 }, (_, index) => index + 1).map((number) => { const event = state.events.find((item) => item.dayNumber === number); const isToday = number === todayDay; const locked = !isToday; const status = isToday ? event ? event.eligibleOpportunity ? "Matching situation recorded" : "No matching situation" : "Ready today" : event ? "Recorded" : number < calendarDayRaw ? "Not recorded" : "Not available yet"; return <button key={number} disabled={locked} className={`${isToday ? "selected" : ""} ${event ? "recorded" : ""}`} onClick={() => selectDay(number)}><span>{event ? <Check /> : number}</span><div><strong>Day {number}</strong><small>{status}</small></div>{locked && <LockKeyhole />}</button>; })}</div></section><section className="surface-card checkin-card"><p className="eyebrow">Day {day} observation</p>{unlocked < 1 ? <><h3>Day 1 opens on {new Date(`${experiment.startDate}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}.</h3><p>Nothing needs to be recorded early. Future days stay locked until they have been experienced.</p></> : <><h3>Did a situation matching your target come up?</h3><div className="corelab-choice-row"><Button variant={opportunity ? "default" : "outline"} onClick={() => setOpportunity(true)}>Yes</Button><Button variant={!opportunity ? "default" : "outline"} onClick={() => setOpportunity(false)}>No matching situation</Button></div>{opportunity && <><label className="preference-row master"><Checkbox checked={pauseCompleted} onCheckedChange={(checked) => setPauseCompleted(checked === true)} /><span><strong>I completed at least my minimum {definition.experiment.pauseName}</strong><small>Record the process, not whether the outcome looks good.</small></span></label>{pauseCompleted && (definition.code === "DEC" || definition.code === "MON") && <label className="corelab-select-label">{definition.code === "DEC" ? "Full or Minimum Decision Pause?" : "Which Pause did you complete?"}<Select value={pauseType} onValueChange={setPauseType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Full">Full Pause</SelectItem><SelectItem value="Minimum">Minimum Pause</SelectItem></SelectContent></Select></label>}{definition.code === "DEC" && pauseCompleted && pauseType === "Full" && <label className="preference-row"><Checkbox checked={extraOption} onCheckedChange={(checked) => setExtraOption(checked === true)} /><span><strong>At least one additional workable option appeared</strong><small>This feeds the descriptive Option Expansion Rate.</small></span></label>}<div className="corelab-event-fields">{definition.experiment.eventFields.map(([key, label, prompt]) => <label key={key}><span>{label}</span><small>{prompt}</small><Textarea rows={2} value={details[key]} onChange={(event) => setDetails({ ...details, [key]: event.target.value })} /></label>)}</div></>}<Button disabled={saving || day !== todayDay || (opportunity && definition.experiment.eventFields.some(([key]) => !details[key]?.trim()))} onClick={() => void act({ action: "saveEvent", experimentId: experiment.id, dayNumber: day, opportunity, pauseCompleted, details: { ...details, pauseType: definition.code === "DEC" || definition.code === "MON" ? pauseType : undefined, extraOption: definition.code === "DEC" && pauseType === "Full" ? extraOption : undefined } })}>{saving ? "Saving…" : recorded ? "Update today’s evidence" : "Save today’s evidence"}</Button></>}</section></div><div className="measurement-strip"><div><span>Days recorded</span><strong>{state.events.length}/7</strong></div><div><span>Matching situations</span><strong>{String(state.measurements[`${definition.prefix}.EXPERIMENT.OPPORTUNITY_COUNT`]?.value ?? 0)}</strong></div><div><span>{definition.experiment.outcomeLabel}</span><strong>{adherence === null || adherence === undefined ? "N/A" : `${adherence}%`}</strong></div><div><span>Expectation accuracy · BEI-03</span><strong>{accuracy === null || accuracy === undefined ? "N/A" : `${accuracy}/100`}</strong></div></div>{unlocked >= 3 && !state.checkpoints.some((item) => item.dayNumber === 3) && <Checkpoint definition={definition} state={state} saving={saving} act={act} />}{unlocked >= 7 && state.events.length === 7 && <div className="completion-note"><ShieldCheck /><div><strong>All seven experienced days are recorded.</strong><p>Finish the seven-day record to open your review. Your daily entries will stay unchanged.</p></div><Button disabled={saving} onClick={() => void act({ action: "completeExperiment", experimentId: experiment.id })}>Finish seven-day test</Button></div>}</div>;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

function CanonicalExperimentStep({
  definition,
  state,
  saving,
  act,
  next,
  onDailySaved,
}: StepProps & { definition: CoreLabDefinition; onDailySaved: () => void }) {
  const experiment = state.experiment;
  const [attachmentBlocked, setAttachmentBlocked] = useState(false);
  const calendarDayRaw = state.timing?.calendarDay ?? 0;
  const unlocked = Math.max(0, Math.min(7, calendarDayRaw));
  const todayDay = calendarDayRaw >= 1 && calendarDayRaw <= 7 ? calendarDayRaw : null;
  const [day, setDay] = useState(Math.max(1, Math.min(7, todayDay ?? 1)));
  const recorded = state.events.find((event) => event.dayNumber === day);
  const [opportunity, setOpportunity] = useState(recorded?.eligibleOpportunity ?? true);
  const [pauseCompleted, setPauseCompleted] = useState(recorded?.alternativeUsed ?? false);
  const [pauseType, setPauseType] = useState(String(recorded?.details?.pauseType ?? "Full"));
  const [outcomeCategory, setOutcomeCategory] = useState(String(recorded?.details?.outcomeCategory ?? "Bought as originally intended"));
  const [extraOption, setExtraOption] = useState(recorded?.details?.extraOption === true);
  const [details, setDetails] = useState<Record<string, string>>(() => Object.fromEntries(definition.experiment.eventFields.map(([key]) => [key, String(recorded?.details?.[key] ?? "")])));
  const predictionFieldId = `${definition.prefix}.I7.PREDICTION_REFLECTION`;
  const [predictionReflection, setPredictionReflection] = useState(valueOf(state, predictionFieldId));
  const [predictionPassed, setPredictionPassed] = useState(state.responses[predictionFieldId]?.status === "PASS");

  function selectDay(nextDay: number) {
    const event = state.events.find((item) => item.dayNumber === nextDay);
    setDay(nextDay);
    setOpportunity(event?.eligibleOpportunity ?? true);
    setPauseCompleted(event?.alternativeUsed ?? false);
    setPauseType(String(event?.details?.pauseType ?? "Full"));
    setOutcomeCategory(String(event?.details?.outcomeCategory ?? "Bought as originally intended"));
    setExtraOption(event?.details?.extraOption === true);
    setDetails(Object.fromEntries(definition.experiment.eventFields.map(([key]) => [key, String(event?.details?.[key] ?? "")])));
  }

  if (!experiment) return <div className="corelab-waiting surface-card"><CalendarDays /><h2>Your experiment has not started.</h2><p>Complete Investigation 6 to define what counts and choose the start date.</p></div>;
  if (experiment.status !== "ACTIVE") return <div className="corelab-waiting surface-card"><Check /><p className="eyebrow">Seven days reviewed</p><h2>Your seven-day record is complete.</h2><p>Your daily entries remain unchanged. Continue to compare pre and post ratings and review the working equation.</p><Button onClick={() => next(state)}>Open review <ArrowRight /></Button></div>;

  const adherence = state.measurements[`${definition.prefix}.BEI06`]?.value;
  const accuracy = state.measurements[`${definition.prefix}.BEI03`]?.value;
  const pauseCount = state.measurements[`${definition.prefix}.EXPERIMENT.PAUSE_COUNT`]?.value;
  const selectedDate = new Date(`${experiment.startDate}T12:00:00Z`);
  selectedDate.setUTCDate(selectedDate.getUTCDate() + day - 1);
  const moneyOutcomes = [
    ["Bought as originally intended", "OUTCOME_BOUGHT"],
    ["Changed purchase", "OUTCOME_CHANGED"],
    ["Delayed purchase", "OUTCOME_DELAYED"],
    ["Did not purchase", "OUTCOME_NOT_PURCHASED"],
    ["No useful alternative found", "OUTCOME_NO_ALTERNATIVE"],
  ] as const;

  return <div className="investigation-stack">
    <section className="surface-card canonical-card experiment-rules">
      <p className="eyebrow">BEI-06 · {definition.experiment.outcomeLabel}</p>
      <p>For the next seven days, notice the first {definition.code === "DEC" ? "decision" : "spending"} opportunity each day that matches the target condition you identified in Investigation 6.</p>
      <h3>A matching {definition.code === "DEC" ? "decision" : "spending"} opportunity is:</h3>
      <ul>{definition.experiment.eligibleRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      {definition.experiment.fullPauseCriteria && <><h3>What counts as completing a Full Pause:</h3><ol>{definition.experiment.fullPauseCriteria.map((rule) => <li key={rule}>{rule}</li>)}</ol></>}
      {definition.experiment.minimumPauseCriteria && <><h3>What counts as completing a Minimum Pause:</h3><ol>{definition.experiment.minimumPauseCriteria.map((rule) => <li key={rule}>{rule}</li>)}</ol><p>BEI-06 counts both Full Pause and Minimum Pause as “Pause completed.”</p></>}
      {definition.code === "DEC" && <p>When an eligible decision opportunity occurs, apply your Decision Pause: {definition.experiment.fullPause}.</p>}
    </section>
    <div className="experiment-hero"><div><p className="eyebrow">Target condition</p><h2>{experiment.targetCondition}</h2></div><div className="alternative-chip"><span>{definition.experiment.pauseName}</span><strong>{experiment.alternativeBehaviour}</strong></div></div>
    <div className="corelab-day-grid">
      <section className="surface-card days-card"><div className="section-title"><div><p className="eyebrow">Your seven days</p><h3>Record each day as it happens</h3></div><CalendarDays /></div><div className="day-list">{Array.from({ length: 7 }, (_, index) => index + 1).map((number) => { const event = state.events.find((item) => item.dayNumber === number); const locked = number > unlocked; return <button key={number} disabled={locked} className={`${day === number ? "selected" : ""} ${event ? "recorded" : ""}`} onClick={() => selectDay(number)}><span>{event ? <Check /> : number}</span><div><strong>Day {number}</strong><small>{locked ? "Not experienced yet" : event ? event.eligibleOpportunity ? "Matching situation recorded" : "No matching situation" : "Ready to record"}</small></div>{locked && <LockKeyhole />}</button>; })}</div></section>
      <section className="surface-card checkin-card"><p className="eyebrow">{todayDay ? `Day ${todayDay} · ${selectedDate.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}` : calendarDayRaw < 1 ? "Experiment not started" : "Seven-day window complete"}</p>{todayDay === null ? calendarDayRaw < 1 ? <><h3>Day 1 opens on {new Date(`${experiment.startDate}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}.</h3><p>Nothing needs to be recorded early. Future days stay locked until their calendar day.</p></> : <><h3>The seven-day evidence window is complete.</h3><p>Earlier unrecorded days remain missing evidence rather than being filled in later.</p></> : <><h3>Did a {definition.code === "DEC" ? "decision" : "spending"} opportunity matching your target condition occur?</h3><div className="corelab-choice-row"><Button variant={opportunity ? "default" : "outline"} onClick={() => setOpportunity(true)}>Yes</Button><Button variant={!opportunity ? "default" : "outline"} onClick={() => setOpportunity(false)}>No matching situation</Button></div>{opportunity && <><label className="preference-row master"><Checkbox checked={pauseCompleted} onCheckedChange={(checked) => setPauseCompleted(checked === true)} /><span><strong>I completed my {definition.experiment.pauseName}</strong><small>Record the process, not whether the outcome looks good.</small></span></label>{pauseCompleted && (definition.code === "DEC" || definition.code === "MON") && <label className="corelab-select-label">{definition.code === "DEC" ? "Full or Minimum Decision Pause?" : "Full or Minimum Pause?"}<Select value={pauseType} onValueChange={setPauseType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Full">Full Pause</SelectItem><SelectItem value="Minimum">Minimum Pause</SelectItem></SelectContent></Select></label>}{definition.code === "DEC" && pauseCompleted && pauseType === "Full" && <label className="preference-row"><Checkbox checked={extraOption} onCheckedChange={(checked) => setExtraOption(checked === true)} /><span><strong>At least one additional workable option appeared</strong><small>This feeds the descriptive Option Expansion Rate.</small></span></label>}<div className="corelab-event-fields">{definition.experiment.eventFields.map(([key, label, prompt]) => <label key={key}><span>{label}</span><small>{prompt}</small><Textarea rows={2} value={details[key]} onChange={(event) => setDetails({ ...details, [key]: event.target.value })} /></label>)}</div>{definition.code === "MON" && <label className="corelab-select-label">Spending Pause outcome<Select value={outcomeCategory} onValueChange={setOutcomeCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{moneyOutcomes.map(([label]) => <SelectItem key={label} value={label}>{label}</SelectItem>)}</SelectContent></Select></label>}</>}<Button disabled={saving || attachmentBlocked || day !== todayDay || (opportunity && definition.experiment.eventFields.some(([key]) => !details[key]?.trim()))} onClick={() => void (async () => { await act({ action: "saveEvent", experimentId: experiment.id, dayNumber: day, opportunity, pauseCompleted, details: { ...details, pauseType: definition.code === "DEC" || definition.code === "MON" ? pauseType : undefined, outcomeCategory: definition.code === "MON" ? outcomeCategory : undefined, extraOption: definition.code === "DEC" && pauseType === "Full" ? extraOption : undefined } }); onDailySaved(); })()}>{saving ? "Saving…" : recorded ? "Update today’s evidence" : "Save today’s evidence & return"}</Button></>}</section>
    </div>
    <EvidenceImages enrollmentId={state.enrolment!.id} labCode={definition.code} investigation={7} evidenceFieldId={`${definition.prefix}.I7.OBSERVATION.IMAGE`} onBlockedChange={setAttachmentBlocked} /><div className="measurement-strip"><div><span>Days recorded</span><strong>{state.events.length}/7</strong></div><div><span>Matching situations</span><strong>{String(state.measurements[`${definition.prefix}.EXPERIMENT.OPPORTUNITY_COUNT`]?.value ?? 0)}/7</strong></div><div><span>Pauses completed</span><strong>{String(pauseCount ?? 0)}</strong></div><div><span>{definition.experiment.outcomeLabel}</span><strong>{adherence == null ? "N/A" : `${adherence}%`}</strong></div><div><span>Expectation accuracy · BEI-03</span><strong>{accuracy == null ? "N/A" : `${accuracy}/100`}</strong></div></div>
    {definition.code === "DEC" ? <section className="surface-card outcome-profile"><h3>Secondary evidence</h3><p>Option Expansion Rate: {String(state.measurements["DEC.OPTION_EXPANSION_COUNT"]?.value ?? 0)} / {String(pauseCount ?? 0)} paused decisions where at least one additional workable option appeared.</p></section> : <section className="surface-card outcome-profile"><h3>Secondary evidence · Spending Pause Outcome Profile</h3><p>Full Pauses: {String(state.measurements["MON.FULL_PAUSE_COUNT"]?.value ?? 0)} · Minimum Pauses: {String(state.measurements["MON.MINIMUM_PAUSE_COUNT"]?.value ?? 0)}</p><dl>{moneyOutcomes.map(([label, code]) => <div key={code}><dt>{label}</dt><dd>{String(state.measurements[`MON.${code}`]?.value ?? 0)}</dd></div>)}</dl><p>None of these outcomes is automatically better than another. The profile shows what happened, not how “good” you were.</p></section>}
    <section className="canonical-note"><p>If no matching opportunities occur during the seven days, BEI-03 and BEI-06 are recorded as N/A rather than 0. Extend or repeat the experiment when the target condition is more likely to appear.</p><p><strong>How much can you conclude?</strong> If fewer than 3 matching situations occur, keep the results but avoid strong conclusions. You may want to extend the test.</p></section>
    {unlocked >= 3 && !state.checkpoints.some((item) => item.dayNumber === 3) && <Checkpoint definition={definition} state={state} saving={saving} act={act} />}
    {(calendarDayRaw > 7 || (calendarDayRaw === 7 && state.events.some((event) => event.dayNumber === 7))) && <section className="surface-card completion-note canonical-completion"><ShieldCheck /><div><strong>BEI-03 · {definition.code === "DEC" ? "Decision Process" : "Spending Pause"} Prediction Accuracy Score</strong><p>Formula: 100 − |Predicted Pause Rate % − Actual Pause Rate %|</p><p>Predicted: {experiment.predictedValue}% · Actual: {adherence == null ? "N/A" : `${adherence}%`} · Score: {accuracy == null ? "N/A" : `${accuracy}/100`}</p>{state.checkpoints.length > 0 && <p><strong>You changed the plan during the week.</strong> Compare your prediction and result with care because the plan changed during the week.</p>}<Prompt field={{ id: predictionFieldId, label: "Prediction reflection", prompt: definition.code === "DEC" ? "What does this tell you about how accurately you predict your own decision behaviour?" : "What does this tell you about how accurately you predict your own spending behaviour?", investigation: 7 }} value={predictionReflection} onChange={setPredictionReflection} passed={predictionPassed} onPass={(nextPassed) => { setPredictionPassed(nextPassed); if (nextPassed) setPredictionReflection(""); }} /></div><Button disabled={saving || (!predictionReflection.trim() && !predictionPassed)} onClick={() => void (async () => { await act({ action: "saveResponses", items: [{ semanticFieldId: predictionFieldId, value: predictionReflection, responseStatus: predictionPassed ? "PASS" : "ANSWERED" }] }); const saved = await act({ action: "completeExperiment", experimentId: experiment.id }); next(saved); })()}>Finish seven-day test</Button></section>}
  </div>;
}

function Checkpoint({ definition, state, saving, act }: { definition: CoreLabDefinition; state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<Snapshot> }) {
  const [form, setForm] = useState({ surprise: "", observability: "", targetFrequency: "", evidence: "", observer: valueOf(state, `${definition.prefix}.I7.OBSERVER.TEXT`), targetCondition: state.experiment?.targetCondition ?? "", pause: state.experiment?.alternativeBehaviour ?? "" });
  const [adjust, setAdjust] = useState(false);
  const ready = [form.surprise, form.observability, form.targetFrequency, form.evidence, form.observer].every((value) => value.trim());
  return <section className="surface-card corelab-checkpoint"><p className="eyebrow">Day 3 Checkpoint</p><h2>Three days in. Don&apos;t skip this.</h2><div className="corelab-event-fields"><label><span>What has surprised you in the first three days?</span><Textarea value={form.surprise} onChange={(event) => setForm({ ...form, surprise: event.target.value })} /></label><label><span>Has your {definition.experiment.pauseName} been easier or harder to apply than you expected?</span><Textarea value={form.observability} onChange={(event) => setForm({ ...form, observability: event.target.value })} /></label><label><span>Has your target condition been appearing often enough? If not, do you need to adjust it?</span><Textarea value={form.targetFrequency} onChange={(event) => setForm({ ...form, targetFrequency: event.target.value })} /></label><label><span>What evidence have you collected that supports or challenges your working equation?</span><Textarea value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /></label><label><span>{definition.code === "DEC" ? "What pattern did you notice about your decisions that you didn't predict?" : "What pattern did you notice about your spending that you didn't predict?"}</span><Textarea value={form.observer} onChange={(event) => setForm({ ...form, observer: event.target.value })} /></label></div><p>This is not failure. You are learning what needs to change. Adjusting the plan after seeing what happened is part of the process.</p><div className="version-tracking"><h3>Changes to your plan</h3><div><strong>Original target condition</strong><p>{state.experiment?.targetCondition}</p></div><div><strong>Original {definition.experiment.pauseName}</strong><p>{state.experiment?.alternativeBehaviour}</p></div><label className="preference-row"><Checkbox checked={adjust} onCheckedChange={(checked) => setAdjust(checked === true)} /><span><strong>Change the plan from Day 3 onward</strong><small>The original target condition and {definition.experiment.pauseName} stay in your record.</small></span></label>{adjust && <><Prompt field={{ id: "condition", label: "Revised target condition, if any", prompt: "Effective from Day: 3", investigation: 7 }} value={form.targetCondition} onChange={(targetCondition) => setForm({ ...form, targetCondition })} /><Prompt field={{ id: "pause", label: `Revised ${definition.experiment.pauseName}, if any`, prompt: "Effective from Day: 3", investigation: 7 }} value={form.pause} onChange={(pause) => setForm({ ...form, pause })} /></>}</div><Button disabled={saving || !ready} onClick={() => void (async () => { await act({ action: "saveResponses", items: [{ semanticFieldId: `${definition.prefix}.I7.OBSERVER.TEXT`, value: form.observer }] }); await act({ action: "saveCheckpoint", experimentId: state.experiment?.id, surprise: form.surprise, observability: `${form.observability}\n\nTarget frequency: ${form.targetFrequency}`, evidenceSupport: form.evidence, evidenceChallenge: form.evidence, targetCondition: form.targetCondition, pause: form.pause, adjust }); })()}>Save Day 3 checkpoint</Button></section>;
}

function ReviewStep({ definition, state, saving, act, next }: StepProps & { definition: CoreLabDefinition }) {
  const [post, setPost] = useState(numberOf(state, definition.postMetric.id));
  const [confidence, setConfidence] = useState(numberOf(state, definition.confidencePost));
  const [postPassed, setPostPassed] = useState(state.responses[definition.postMetric.id]?.status === "PASS");
  const [confidencePassed, setConfidencePassed] = useState(state.responses[definition.confidencePost]?.status === "PASS");
  const fields = definition.sections[8];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.id, valueOf(state, field.id)])));
  const [passed, setPassed] = useState(() => new Set(fields.filter((field) => state.responses[field.id]?.status === "PASS").map((field) => field.id)));
  if (state.experiment?.status === "ACTIVE") return <div className="corelab-waiting surface-card"><LockKeyhole /><h2>The evidence review is not open yet.</h2><p>Complete all seven experienced days in Investigation 7 first.</p></div>;
  const ready = fields.every((field) => values[field.id]?.trim() || passed.has(field.id));
  const pre = numberOf(state, definition.preMetric.id);
  const confPre = numberOf(state, definition.confidencePre);
  return <div className="investigation-stack"><div className="review-grid"><section className={`surface-card corelab-shift ${postPassed ? "passed" : ""}`}><p className="eyebrow">{definition.postMetric.label}</p><h2>{definition.postMetric.prompt}</h2><p>1 = {definition.preMetric.low}. 10 = {definition.preMetric.high}.</p>{!postPassed && <><strong>{post}<span>/10</span></strong><Slider value={[post]} min={1} max={10} step={1} onValueChange={([value]) => setPost(value)} /><p>{definition.code === "DEC" ? "Decision Deliberateness" : "Money Awareness"} Shift: <b>{post - pre > 0 ? "+" : ""}{post - pre} points</b></p><p>Formula: BEI-07 − BEI-01. Positive = more {definition.code === "DEC" ? "deliberate" : "aware"}; negative = less; zero = no change.</p></>}<PassControl passed={postPassed} onChange={setPostPassed} /></section><section className={`surface-card corelab-shift ${confidencePassed ? "passed" : ""}`}><p className="eyebrow">BEI-08 · {definition.code === "DEC" ? "Decision" : "Money"} Equation Confidence (Post)</p><h2>How confident are you now that your equation explains the {definition.code === "DEC" ? "decision" : "spending"} pattern you investigated?</h2>{!confidencePassed && <><strong>{confidence}<span>/10</span></strong><Slider value={[confidence]} min={1} max={10} step={1} onValueChange={([value]) => setConfidence(value)} /><p>Equation Confidence Shift: <b>{confidence - confPre > 0 ? "+" : ""}{confidence - confPre} points</b></p><p>Formula: BEI-08 − BEI-04.</p></>}<PassControl passed={confidencePassed} onChange={setConfidencePassed} /></section></div>{fields.map((field) => <Prompt key={field.id} field={field} value={values[field.id]} onChange={(value) => { setValues({ ...values, [field.id]: value }); setPassed((current) => { const nextSet = new Set(current); nextSet.delete(field.id); return nextSet; }); }} passed={passed.has(field.id)} onPass={(nextPassed) => setPassed((current) => { const nextSet = new Set(current); if (nextPassed) nextSet.add(field.id); else nextSet.delete(field.id); return nextSet; })} />)}<SaveFooter saving={saving} disabled={!ready} onSave={async () => { const saved = await act({ action: "saveResponses", items: [{ semanticFieldId: definition.postMetric.id, value: post, responseStatus: postPassed ? "PASS" : "ANSWERED" }, { semanticFieldId: definition.confidencePost, value: confidence, responseStatus: confidencePassed ? "PASS" : "ANSWERED" }, ...fields.map((field) => ({ semanticFieldId: field.id, value: values[field.id], responseStatus: passed.has(field.id) ? "PASS" : "ANSWERED" }))] }); next(saved); }} /></div>;
}

function CanonicalFinalStep({
  definition,
  state,
  saving,
  act,
  returnTo,
}: Omit<StepProps, "next"> & { definition: CoreLabDefinition; returnTo: string }) {
  const fields = definition.sections[9];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.id, valueOf(state, field.id)])));
  const [passed, setPassed] = useState(() => new Set(fields.filter((field) => state.responses[field.id]?.status === "PASS").map((field) => field.id)));
  const ready = fields.every((field) => values[field.id]?.trim() || passed.has(field.id));
  const completed = state.enrolment?.status === "COMPLETED";
  const prefix = definition.prefix;
  const opportunityCount = String(state.measurements[`${prefix}.EXPERIMENT.OPPORTUNITY_COUNT`]?.value ?? "N/A");
  const pauseCount = String(state.measurements[`${prefix}.EXPERIMENT.PAUSE_COUNT`]?.value ?? "N/A");
  const profileRows = definition.code === "DEC" ? [
    ["Decision Pattern Investigated", displayOf(state, "DEC.PATTERN.TARGET")],
    ["Situation That Triggered It", displayOf(state, "DEC.SITUATION.TEXT")],
    ["Options I Saw First", displayOf(state, "DEC.OPTIONS_BEFORE.TEXT")],
    ["State/Pressure Before Deciding", displayOf(state, "DEC.STATE_PRESSURE.TEXT")],
    ["What Mattered", displayOf(state, "DEC.MATTERED.TEXT")],
    ["Other Workable Options, If Any", displayOf(state, "DEC.OPTIONS_AFTER.TEXT")],
    ["Emotion Before Deciding", displayOf(state, "DEC.EMOTION.TEXT")],
    ["Environment", displayOf(state, "DEC.ENVIRONMENT.TEXT")],
    ["Person/Influence Present", displayOf(state, "DEC.INFLUENCE.TEXT")],
    ["Impact Domains /6", `${state.experiment?.impactDomains.length ?? 0} / 6`],
    ["Working Equation", state.hypothesis?.statement || displayOf(state, "DEC.EQUATION.TEXT")],
    ["What would change my mind?", state.hypothesis?.falsificationStatement || displayOf(state, "DEC.FALSIFICATION.TEXT")],
    ["Equation Confidence (Pre → Post)", `${displayOf(state, definition.confidencePre)} → ${displayOf(state, definition.confidencePost)}`],
    ["Decision Deliberateness Rating (Pre → Post)", `${displayOf(state, definition.preMetric.id)} → ${displayOf(state, definition.postMetric.id)}`],
    ["Decision Deliberateness Shift points", `${String(state.measurements["DEC.DELIBERATENESS_SHIFT"]?.value ?? "N/A")} points`],
    ["Equation Confidence Shift points", `${String(state.measurements["DEC.EQUATION_CONFIDENCE_SHIFT"]?.value ?? "N/A")} points`],
    ["Decision Process Prediction Accuracy Score /100", `${String(state.measurements["DEC.BEI03"]?.value ?? "N/A")} / 100`],
    ["Matching Situations Observed /7", `${opportunityCount} / 7`],
    ["Decision Pauses Completed / ___ opportunities", `${pauseCount} / ${opportunityCount} opportunities`],
    ["Decision Process Adherence Rate %", `${String(state.measurements["DEC.BEI06"]?.value ?? "N/A")}%`],
    ["Option Expansion Rate / ___ paused decisions", `${String(state.measurements["DEC.OPTION_EXPANSION_COUNT"]?.value ?? "N/A")} / ${pauseCount} paused decisions`],
    ["Next Decision Pattern to Investigate", displayOf(state, "DEC.NEXT_PATTERN.TEXT")],
  ] : [
    ["Spending Pattern Investigated", displayOf(state, "MON.PATTERN.TARGET")],
    ["Trigger", displayOf(state, "MON.TRIGGER.TEXT")],
    ["Feeling/State Before Spending", displayOf(state, "MON.FEELING.TEXT")],
    ["Expected Value", displayOf(state, "MON.EXPECTED_VALUE.TEXT")],
    ["What My Choice Actually Gave Me or Changed", displayOf(state, "MON.OUTCOME.INITIAL")],
    ["Outcome/Trade-off", displayOf(state, "MON.OUTCOME_TRADEOFF.TEXT")],
    ["Emotion Before Spending", displayOf(state, "MON.EMOTION.TEXT")],
    ["Environment", displayOf(state, "MON.ENVIRONMENT.TEXT")],
    ["Person/Influence Present", displayOf(state, "MON.INFLUENCE.TEXT")],
    ["Impact Domains /6", `${state.experiment?.impactDomains.length ?? 0} / 6`],
    ["Working Equation", state.hypothesis?.statement || displayOf(state, "MON.EQUATION.TEXT")],
    ["What would change my mind?", state.hypothesis?.falsificationStatement || displayOf(state, "MON.FALSIFICATION.TEXT")],
    ["Equation Confidence (Pre → Post)", `${displayOf(state, definition.confidencePre)} → ${displayOf(state, definition.confidencePost)}`],
    ["Money Awareness Rating (Pre → Post)", `${displayOf(state, definition.preMetric.id)} → ${displayOf(state, definition.postMetric.id)}`],
    ["Money Awareness Shift points", `${String(state.measurements["MON.AWARENESS_SHIFT"]?.value ?? "N/A")} points`],
    ["Equation Confidence Shift points", `${String(state.measurements["MON.EQUATION_CONFIDENCE_SHIFT"]?.value ?? "N/A")} points`],
    ["Spending Pause Prediction Accuracy Score /100", `${String(state.measurements["MON.BEI03"]?.value ?? "N/A")} / 100`],
    ["Matching Situations Observed /7", `${opportunityCount} / 7`],
    ["Spending Pauses Completed (Full or Minimum) / ___ opportunities", `${pauseCount} / ${opportunityCount} opportunities`],
    ["Spending Pause Adherence Rate %", `${String(state.measurements["MON.BEI06"]?.value ?? "N/A")}%`],
    ["Full Pauses", String(state.measurements["MON.FULL_PAUSE_COUNT"]?.value ?? 0)],
    ["Minimum Pauses", String(state.measurements["MON.MINIMUM_PAUSE_COUNT"]?.value ?? 0)],
    ["Spending Pause Outcome Profile", `Bought ${String(state.measurements["MON.OUTCOME_BOUGHT"]?.value ?? 0)} · Changed ${String(state.measurements["MON.OUTCOME_CHANGED"]?.value ?? 0)} · Delayed ${String(state.measurements["MON.OUTCOME_DELAYED"]?.value ?? 0)} · Did not purchase ${String(state.measurements["MON.OUTCOME_NOT_PURCHASED"]?.value ?? 0)} · No useful alternative ${String(state.measurements["MON.OUTCOME_NO_ALTERNATIVE"]?.value ?? 0)}`],
    ["Next Spending Pattern to Investigate", displayOf(state, "MON.NEXT_PATTERN.TEXT")],
  ];
  return <div className="investigation-stack"><section className="surface-card corelab-profile"><div className="section-title"><div><p className="eyebrow">BEI-10 · Behaviour Profile Summary</p><h2>Your results in one view.</h2></div><Badge variant="outline">{definition.shortTitle}</Badge></div><dl>{profileRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>{fields.map((field) => <Prompt key={field.id} field={field} value={values[field.id]} onChange={(value) => { setValues({ ...values, [field.id]: value }); setPassed((current) => { const nextSet = new Set(current); nextSet.delete(field.id); return nextSet; }); }} passed={passed.has(field.id)} onPass={(nextPassed) => setPassed((current) => { const nextSet = new Set(current); if (nextPassed) nextSet.add(field.id); else nextSet.delete(field.id); return nextSet; })} />)}{completed ? <section className="corelab-certificate"><Check /><p className="eyebrow">{definition.code === "DEC" ? "Decision" : "Spending"} Investigation Complete</p><h2>{definition.certificate.title}</h2><p>This certifies that</p><h3>{state.profile?.displayName || "Learner"}</h3><p>{definition.certificate.completion}</p><div><strong>What was discovered:</strong><ul>{definition.certificate.discoveries.map((item) => <li key={item}>{item}</li>)}</ul></div><p><strong>The most important thing learned:</strong> {displayOf(state, `${prefix}.CERTIFICATE.INSIGHT`)}</p><p>This is not a certificate of perfection. It confirms that you completed and reviewed the investigation.</p><p>Facilitator: ____________________ · Date: {new Date().toLocaleDateString("en-ZA")} · Workbook ID: {definition.workbookId}</p><p>Applied Commerce® · Behaviour Comes Before Results</p><Link href={returnTo}>{returnTo === "/labs" ? "Continue with another available Behaviour Intelligence Lab™" : "Return to your learning module"} <ArrowRight /></Link></section> : <SaveFooter saving={saving} disabled={!ready} label="Complete investigation" onSave={async () => { await act({ action: "saveResponses", items: fields.map((field) => ({ semanticFieldId: field.id, value: values[field.id], responseStatus: passed.has(field.id) ? "PASS" : "ANSWERED" })) }); await act({ action: "completeLab" }); }} />}</div>;
}

/* Legacy generic renderer retained only to protect rollback compatibility. */
/* eslint-disable @typescript-eslint/no-unused-vars */
function FinalStep({ definition, state, saving, act }: Omit<StepProps, "next"> & { definition: CoreLabDefinition }) {
  const fields = definition.sections[9];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.id, valueOf(state, field.id)])));
  const ready = fields.every((field) => values[field.id]?.trim());
  const completed = state.enrolment?.status === "COMPLETED";
  const profileRows = useMemo(() => [
    ["Pattern investigated", valueOf(state, `${definition.prefix}.PATTERN.TARGET`, "Not recorded")],
    ["Working equation", state.hypothesis?.statement ?? "Not recorded"],
    ["Impact domains", `${state.experiment?.impactDomains.length ?? 0}/6`],
    ["Matching situations", String(state.measurements[`${definition.prefix}.EXPERIMENT.OPPORTUNITY_COUNT`]?.value ?? "N/A")],
    [definition.experiment.outcomeLabel, state.measurements[`${definition.prefix}.BEI06`]?.value == null ? "N/A" : `${state.measurements[`${definition.prefix}.BEI06`].value}%`],
    ["Prediction accuracy", state.measurements[`${definition.prefix}.BEI03`]?.value == null ? "N/A" : `${state.measurements[`${definition.prefix}.BEI03`].value}/100`],
    [definition.code === "DEC" ? "Decision Deliberateness Shift" : "Money Awareness Shift", `${String(state.measurements[`${definition.prefix}.${definition.code === "DEC" ? "DELIBERATENESS" : "AWARENESS"}_SHIFT`]?.value ?? "N/A")} points`],
    ["Equation Confidence Shift", `${String(state.measurements[`${definition.prefix}.EQUATION_CONFIDENCE_SHIFT`]?.value ?? "N/A")} points`],
    ...(definition.code === "DEC"
      ? [["Option Expansion Rate", state.measurements[`${definition.prefix}.OPTION_EXPANSION_RATE`]?.value == null ? "N/A" : `${state.measurements[`${definition.prefix}.OPTION_EXPANSION_RATE`].value}%`]]
      : [["Full Pauses", String(state.measurements[`${definition.prefix}.FULL_PAUSE_COUNT`]?.value ?? 0)], ["Minimum Pauses", String(state.measurements[`${definition.prefix}.MINIMUM_PAUSE_COUNT`]?.value ?? 0)]]),
  ], [definition, state]);
  return <div className="investigation-stack"><section className="surface-card corelab-profile"><div className="section-title"><div><p className="eyebrow">BEI-10 · Behaviour Profile Summary</p><h2>Your results in one view.</h2></div><Badge variant="outline">{definition.shortTitle}</Badge></div><dl>{profileRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>{fields.map((field) => <Prompt key={field.id} field={field} value={values[field.id]} onChange={(value) => setValues({ ...values, [field.id]: value })} />)}{completed ? <div className="corelab-certificate"><Check /><p className="eyebrow">Investigation complete</p><h2>{definition.title} completion certificate</h2><p>This is not a certificate of perfection. It confirms that you completed and reviewed the seven-day investigation.</p><Link href="/">Return to all Labs <ArrowRight /></Link></div> : <SaveFooter saving={saving} disabled={!ready} label="Complete investigation" onSave={async () => { await act({ action: "saveResponses", items: fields.map((field) => ({ semanticFieldId: field.id, value: values[field.id] })) }); await act({ action: "completeLab" }); }} />}</div>;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

function Prompt({ field, value, onChange, passed = false, onPass }: { field: LabField; value: string; onChange: (value: string) => void; passed?: boolean; onPass?: (passed: boolean) => void }) {
  return <section className={`prompt-section ${passed ? "passed" : ""}`}><div className="prompt-number">{String(field.investigation).padStart(2, "0")}</div><div className="prompt-body"><h2>{field.label}</h2><p>{field.prompt}</p>{passed ? <p className="passed-note">You chose to pass this question. You can answer it instead before saving.</p> : <div className="prompt-controls">{field.type === "INTEGER" ? <Input type="number" min={field.id.includes("THOROUGHNESS") ? 1 : 0} max={field.id.includes("THOROUGHNESS") ? 5 : undefined} value={value} onChange={(event) => onChange(event.target.value)} /> : <Textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder ?? "Write what you actually noticed…"} />}</div>}{onPass && <PassControl passed={passed} onChange={onPass} />}</div></section>;
}

function PassControl({ passed, onChange, label = "Pass this question" }: { passed: boolean; onChange: (passed: boolean) => void; label?: string }) {
  return <label className="pass-control"><Checkbox checked={passed} onCheckedChange={(checked) => onChange(checked === true)} /><span>{label}</span></label>;
}

function ScaleField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="scale-field"><div><span>{label}</span><strong>{value} / 10</strong></div><Slider value={[value]} min={1} max={10} step={1} onValueChange={([next]) => onChange(next)} /></div>;
}

function PauseCard({ question }: { question: string }) {
  return <div className="pause-card"><span>Pause</span><div><strong>Close the workbook. Take 30 seconds. Ask yourself:</strong><p>{question}</p><small>Then continue.</small></div></div>;
}

function SaveFooter({ saving, disabled, onSave, label = "Save and continue" }: { saving: boolean; disabled: boolean; onSave: () => Promise<void>; label?: string }) {
  return <div className="step-footer"><span><ShieldCheck /> Saved as private, traceable evidence.</span><Button size="lg" disabled={saving || disabled} onClick={() => void onSave()}>{saving ? "Saving…" : label} {!saving && <ArrowRight />}</Button></div>;
}

