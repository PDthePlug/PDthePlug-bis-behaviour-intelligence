"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Home,
  Lightbulb,
  LifeBuoy,
  LockKeyhole,
  Menu,
  MessageCircleQuestion,
  NotebookTabs,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  baselineItems,
  fieldLabels,
  investigations,
  LAB_VERSION,
  responseScale,
  storyEpisodeOne,
  storyEpisodeTwo,
} from "@/lib/habit-lab";
import { getExperimentTiming } from "@/lib/experiment-timing.mjs";
import { OperationsView } from "./operations-view";

type Snapshot = {
  identity: { id: string; email: string; displayName: string };
  experienceVersion: string;
  roles: string[];
  profile: null | { displayName: string; ageBand: string; mode: string };
  consent: null | { status: string; policyVersion: string };
  enrolment: null | { id: string; currentInvestigation: number; status: string; labVersion: string };
  responses: Record<string, { value: unknown; status: string; responseId: string; recordedAt: string }>;
  hypothesis: null | {
    id: string;
    statement: string;
    falsificationStatement: string;
    learnerConfidence: number;
    status: string;
  };
  experiment: null | {
    id: string;
    status: string;
    targetPattern: string;
    targetCondition: string;
    alternativeBehaviour: string;
    expectedReward: string;
    witness: string | null;
    restartPlan: string;
    minimumVersion: string;
    failureSignal: string;
    impactDomains: string[];
    predictedValue: number;
    startDate: string;
    plannedEndDate: string;
    actualEndDate: string | null;
    minimumEvidenceThreshold: number;
    parameterVersion: number;
  };
  events: Array<{
    id: string;
    dayNumber: number;
    occurredAt: string;
    targetConditionOccurred: boolean;
    eligibleOpportunity: boolean;
    alternativeUsed: boolean | null;
    notes: string | null;
  }>;
  checkpoints: Array<{
    id: string;
    dayNumber: number;
    surprise: string;
    observability: string;
    evidenceSupport: string;
    evidenceChallenge: string;
    decision: string;
    adjustmentSummary: string | null;
  }>;
  parameterVersions: Array<{
    id: string;
    version: number;
    effectiveFrom: string;
    targetCondition: string;
    alternativeBehaviour: string;
    changeReason: string;
  }>;
  measurements: Record<string, {
    value: unknown;
    status: string;
    evidenceStrength: string;
    formulaVersion: string;
    calculatedAt: string;
    sources: Array<{
      sourceObjectType: string;
      sourceObjectId: string;
      inputRole: string;
      inputValue: unknown;
    }>;
  }>;
  notificationPreference: {
    enabled: boolean;
    experimentStarted: boolean;
    dailyObservation: boolean;
    dayThreeCheckpoint: boolean;
    experimentEnding: boolean;
    reviewReady: boolean;
    reminderTime: string;
    timezone: string;
  };
  reminders: Array<{ id: string; title: string; detail: string; priority: string }>;
  memories: Array<{
    id: string;
    statement: string;
    memoryType: string;
    confirmationLevel: string;
    status: string;
    sourceType: string;
  }>;
  companionTurns: Array<{
    id: string;
    role: string;
    content: string;
    mode: string;
    evidenceRefs: string;
  }>;
  supportRequests: Array<{
    id: string;
    category: string;
    status: string;
    severity: string;
    openedAt: string;
    acknowledgedAt: string | null;
    resolvedAt: string | null;
  }>;
};

type View = "home" | "lab" | "experiment" | "evidence" | "companion" | "memory" | "settings" | "operations";

const nav = [
  { id: "home" as const, label: "Home", icon: Home },
  { id: "lab" as const, label: "Habit Lab", icon: FlaskConical },
  { id: "experiment" as const, label: "Experiment", icon: CalendarDays },
  { id: "evidence" as const, label: "Evidence", icon: Archive },
  { id: "companion" as const, label: "Companion", icon: Bot },
];

function valueOf(state: Snapshot, field: string, fallback = "") {
  const value = state.responses[field]?.value;
  return value === null || value === undefined ? fallback : String(value);
}

function numberOf(state: Snapshot, field: string, fallback = 1) {
  const value = Number(state.responses[field]?.value);
  return Number.isFinite(value) ? value : fallback;
}

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function todayInTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-ZA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function BISApp({ initialIdentity }: { initialIdentity: { email: string; displayName: string } | null }) {
  const [state, setState] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>("home");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [privateVisible, setPrivateVisible] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!privateVisible) return;
    let timeout = window.setTimeout(() => setPrivateVisible(false), 120_000);
    const reset = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setPrivateVisible(false), 120_000);
    };
    const hideWhenBackgrounded = () => {
      if (document.visibilityState === "hidden") setPrivateVisible(false);
    };
    document.addEventListener("visibilitychange", hideWhenBackgrounded);
    for (const event of ["pointerdown", "keydown", "touchstart"] as const) {
      window.addEventListener(event, reset, { passive: true });
    }
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", hideWhenBackgrounded);
      for (const event of ["pointerdown", "keydown", "touchstart"] as const) {
        window.removeEventListener(event, reset);
      }
    };
  }, [privateVisible]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bis", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to open your investigation.");
      setState(data);
      setStep(Math.max(1, Math.min(9, data.enrolment?.currentInvestigation || 1)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open your investigation.");
    } finally {
      setLoading(false);
    }
  }

  async function act(payload: Record<string, unknown>, replaceSnapshot = true) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "That change could not be saved.");
      if (replaceSnapshot) setState(data);
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
      throw cause;
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="surface-card max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto size-10 text-[var(--teal)]" />
          <h1 className="mt-5 text-2xl font-semibold">Your private investigation could not open</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{error || "Please sign in and try again."}</p>
          <Button className="mt-6" onClick={() => void load()}>Try again</Button>
        </div>
      </div>
    );
  }

  const staffRoles = state.roles.filter((role) => ["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER"].includes(role));
  const hasStaffAccess = staffRoles.length > 0;
  const baselineComplete = Boolean(state.responses["HAB.CONTROL.PRE"]) && baselineItems.every(([field]) => Boolean(state.responses[field]));

  if (hasStaffAccess && (!state.profile || state.consent?.status !== "GRANTED" || !baselineComplete)) {
    return <StaffOnlyShell state={state} staffRoles={staffRoles} saving={saving} error={error} act={act} privateVisible={privateVisible} onReveal={() => setPrivateVisible(true)} onLock={() => setPrivateVisible(false)} />;
  }

  if (state.profile && state.consent?.status === "WITHDRAWN") {
    return <PrivacyPaused state={state} saving={saving} error={error} onRestore={act} />;
  }

  if (!state.profile || state.consent?.status !== "GRANTED") {
    return <Onboarding identity={initialIdentity ?? state.identity} saving={saving} error={error} onSubmit={act} />;
  }

  if (!baselineComplete) {
    return <BaselineScreen state={state} saving={saving} error={error} act={act} />;
  }

  const current = Math.max(1, state.enrolment?.currentInvestigation || 1);
  const displayName = state.profile.displayName.split(" ")[0] || "Investigator";

  return (
    <>
    <div className={`min-h-screen bg-background text-foreground ${privateVisible ? "" : "privacy-obscured"}`} aria-hidden={!privateVisible}>
      <header className="mobile-header">
        <button className="icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu /></button>
        <Brand compact />
        <div className="mobile-actions"><button className="icon-button" aria-label="Hide private content" onClick={() => setPrivateVisible(false)}><EyeOff /></button><button className="avatar-button" aria-label="Open memory" onClick={() => setView("memory")}>{displayName.slice(0, 1).toUpperCase()}</button></div>
      </header>

      {menuOpen && <div className="mobile-scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X /></button>
        </div>
        <div className="lab-pill">
          <div className="lab-mark"><FlaskConical /></div>
          <div><span>Current Lab</span><strong>Habit Lab</strong></div>
          <Badge variant="outline">{LAB_VERSION}</Badge>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {nav.map((item) => {
            const Icon = item.icon;
            const disabled = item.id === "experiment" && !state.experiment;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                disabled={disabled}
                onClick={() => { setView(item.id); setMenuOpen(false); }}
              >
                <Icon /> <span>{item.label}</span>
                {item.id === "lab" && <small>{current}/9</small>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <button className="memory-link" onClick={() => { setPrivateVisible(false); setMenuOpen(false); }}>
          <EyeOff /> <span>Hide private content</span>
        </button>
        {hasStaffAccess && <button className={`memory-link ${view === "operations" ? "active" : ""}`} onClick={() => { setView("operations"); setMenuOpen(false); }}>
          <BriefcaseBusiness /> <span>Restricted operations</span>
        </button>}
        <button className={`memory-link ${view === "memory" ? "active" : ""}`} onClick={() => { setView("memory"); setMenuOpen(false); }}>
          <Brain /> <span>What BIS remembers</span>
        </button>
        <button className={`memory-link ${view === "settings" ? "active" : ""}`} onClick={() => { setView("settings"); setMenuOpen(false); }}>
          <Settings2 /> <span>Settings & privacy</span>
        </button>
        <div className="profile-chip">
          <span className="profile-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
          <div><strong>{state.profile.displayName}</strong><small>{state.profile.mode === "FACILITATED" ? "Facilitated mode" : "Independent mode"}</small></div>
        </div>
      </aside>

      <main className="app-main">
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div>}
        {view === "home" && <HomeView state={state} name={displayName} onView={setView} onContinue={() => { setStep(current); setView("lab"); }} />}
        {view === "lab" && <LabRunner state={state} step={step} setStep={setStep} saving={saving} act={act} onView={setView} />}
        {view === "experiment" && <ExperimentView state={state} saving={saving} act={act} onView={setView} />}
        {view === "evidence" && <EvidenceView state={state} onView={setView} />}
        {view === "companion" && <CompanionView state={state} saving={saving} act={act} />}
        {view === "memory" && <MemoryView state={state} saving={saving} act={act} />}
        {view === "settings" && <SettingsView state={state} saving={saving} act={act} onLock={() => setPrivateVisible(false)} />}
        {view === "operations" && <OperationsView initialRoles={staffRoles} />}
      </main>
    </div>
    {!privateVisible && <PrivacyScreen state={state} onReveal={() => setPrivateVisible(true)} />}
    </>
  );
}

function StaffOnlyShell({ state, staffRoles, saving, error, act, privateVisible, onReveal, onLock }: { state: Snapshot; staffRoles: string[]; saving: boolean; error: string; act: (payload: Record<string, unknown>) => Promise<unknown>; privateVisible: boolean; onReveal: () => void; onLock: () => void }) {
  return <><div className={`staff-only-shell ${privateVisible ? "" : "privacy-obscured"}`} aria-hidden={!privateVisible}><header><Brand /><div><Badge variant="outline"><LockKeyhole /> Restricted workspace</Badge><span>{state.identity.email}</span><button className="staff-lock" onClick={onLock}><EyeOff /> Hide</button></div></header>{state.profile && state.consent?.status === "WITHDRAWN" && <div className="staff-consent-note"><div><strong>Your learner investigation is paused.</strong><p>Your staff role remains available and does not override that consent choice.</p></div><Button variant="outline" disabled={saving} onClick={() => void act({ action: "restoreConsent" })}>Restore learner consent</Button></div>}{error && <div className="error-banner"><span>{error}</span></div>}<OperationsView initialRoles={staffRoles} /></div>{!privateVisible && <PrivacyScreen state={state} staff onReveal={onReveal} />}</>;
}

function PrivacyScreen({ state, staff = false, onReveal }: { state: Snapshot; staff?: boolean; onReveal: () => void }) {
  const progress = Math.max(0, Math.min(9, state.enrolment?.currentInvestigation ?? 0));
  return <main className="privacy-screen" role="dialog" aria-modal="true" aria-labelledby="privacy-screen-title"><div className="privacy-screen-card"><Brand /><div className="privacy-screen-icon"><LockKeyhole /></div><p className="eyebrow">Privacy screen active</p><h1 id="privacy-screen-title">{staff ? "Restricted workspace hidden." : "Your investigation is hidden."}</h1><p>{staff ? "Learner identities and operational records are covered while this screen is active." : "Your answers, experiment, evidence and Companion conversations are covered until you choose to continue."}</p>{!staff && <div className="privacy-safe-progress"><span>Habit Lab progress</span><strong>{progress} / 9</strong><Progress value={(progress / 9) * 100} /></div>}<div className="privacy-screen-actions"><Button size="lg" onClick={onReveal}><Eye /> Reveal this session</Button><a href="/signout-with-chatgpt?return_to=/" target="_top"><LockKeyhole /> Lock and sign out</a></div><small>This screen prevents casual viewing and returns automatically after two minutes or when the tab is hidden. On a shared device, signing out provides the strongest protection.</small></div></main>;
}

function PrivacyPaused({ state, saving, error, onRestore }: { state: Snapshot; saving: boolean; error: string; onRestore: (payload: Record<string, unknown>) => Promise<unknown> }) {
  return <main className="privacy-paused"><div className="surface-card privacy-paused-card"><div className="card-icon teal"><LockKeyhole /></div><p className="eyebrow">Investigation paused</p><h1>Your consent choice is active.</h1><p>BIS has stopped accepting new investigation activity. Your existing evidence remains private and unchanged, so you can inspect it again if you restore product consent.</p><dl><div><dt>Account</dt><dd>{state.identity.email}</dd></div><div><dt>Policy version</dt><dd>{state.consent?.policyVersion ?? "Current"}</dd></div><div><dt>Data status</dt><dd>Retained, no new collection</dd></div></dl>{error && <p className="field-error">{error}</p>}<Button size="lg" disabled={saving} onClick={() => void onRestore({ action: "restoreConsent" })}>{saving ? "Restoring…" : "Restore consent and continue"}</Button><p className="privacy-footnote">Restoring creates a new consent record. It does not rewrite your earlier withdrawal.</p></div></main>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-symbol">B</span>
      <div><strong>BIS</strong><small>Behaviour Intelligence</small></div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-shell">
      <Brand />
      <div className="loading-line" /><div className="loading-line short" />
      <div className="loading-grid"><div /><div /><div /></div>
    </div>
  );
}

function Onboarding({
  identity,
  saving,
  error,
  onSubmit,
}: {
  identity: { email: string; displayName: string } | null;
  saving: boolean;
  error: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [ageBand, setAgeBand] = useState("");
  const [mode, setMode] = useState("INDEPENDENT");
  const [consent, setConsent] = useState(false);

  return (
    <main className="onboarding-shell">
      <div className="onboarding-header"><Brand /><Badge variant="outline">Habit Lab {LAB_VERSION}</Badge></div>
      <section className="onboarding-intro">
        <div>
          <p className="eyebrow">Your first investigation</p>
          <h1>Understand a pattern in your behaviour by collecting evidence from your own life.</h1>
          <p className="lede">This is not a personality test. You will notice a repeated pattern, build a working explanation, test it for seven days and review what actually happened.</p>
          <div className="journey-line" aria-label="Investigation journey">
            {["Notice", "Explain", "Test", "Review"].map((label, index) => <div key={label}><span>{index + 1}</span><strong>{label}</strong></div>)}
          </div>
        </div>
        <div className="surface-card onboarding-card">
          <div className="privacy-heading"><LockKeyhole /><div><h2>Before you begin</h2><p>Private by design. Evidence before judgment.</p></div></div>
          <label className="field-label">How will you use Habit Lab?</label>
          <div className="choice-grid two">
            <ChoiceButton active={mode === "INDEPENDENT"} title="On my own" detail="Move at your own pace" onClick={() => setMode("INDEPENDENT")} />
            <ChoiceButton active={mode === "FACILITATED"} title="With a facilitator" detail="Use it in a guided session" onClick={() => setMode("FACILITATED")} />
          </div>
          <label className="field-label" htmlFor="age-band">Age band</label>
          <Select value={ageBand} onValueChange={setAgeBand}>
            <SelectTrigger id="age-band" className="w-full"><SelectValue placeholder="Choose an age band" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="14-17">14–17</SelectItem>
              <SelectItem value="18-21">18–21</SelectItem>
              <SelectItem value="22-25">22–25</SelectItem>
              <SelectItem value="26+">26 or older</SelectItem>
            </SelectContent>
          </Select>
          <div className="privacy-copy">
            <ShieldCheck />
            <p><strong>What BIS collects:</strong> the evidence and reflections you choose to add, your experiment events and calculated results. You can pass a question. Your work is not a score about who you are.</p>
          </div>
          <label className="consent-row">
            <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
            <span>I understand what is collected, why it is used, who may see it in my selected mode, and that safeguarding or legal duties may limit confidentiality.</span>
          </label>
          {error && <p className="field-error">{error}</p>}
          <Button className="w-full" size="lg" disabled={saving || !ageBand || !consent} onClick={() => void onSubmit({ action: "setup", ageBand, mode, consent })}>
            {saving ? "Preparing your Lab…" : <>Begin Habit Lab <ArrowRight /></>}
          </Button>
          <p className="signed-in-note">Signed in as {identity?.email ?? "your private account"}</p>
        </div>
      </section>
    </main>
  );
}

function ChoiceButton({ active, title, detail, onClick }: { active: boolean; title: string; detail: string; onClick: () => void }) {
  return <button type="button" className={`choice-button ${active ? "selected" : ""}`} onClick={onClick}><span>{active ? <Check /> : null}</span><strong>{title}</strong><small>{detail}</small></button>;
}

function BaselineScreen({ state, saving, error, act }: { state: Snapshot; saving: boolean; error: string; act: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [ratings, setRatings] = useState<Record<string, string>>(() => Object.fromEntries(baselineItems.map(([field]) => [field, valueOf(state, field)])));
  const [control, setControl] = useState(numberOf(state, "HAB.CONTROL.PRE", 5));
  const complete = baselineItems.every(([field]) => ratings[field]);
  return <main className="baseline-shell"><div className="baseline-top"><Brand /><div><Badge variant="outline">Starting point</Badge><strong>Behaviour baseline</strong></div></div><section className="baseline-layout"><div className="baseline-copy"><p className="eyebrow">Before the investigation</p><h1>Create your starting point.</h1><p>This is evidence, not judgment. There is no overall Habit Score and no comparison with other people.</p><div className="baseline-principles"><div><ShieldCheck /><span><strong>Private</strong>Your responses stay tied to your account.</span></div><div><Eye /><span><strong>Editable</strong>You can correct an earlier response.</span></div><div><Compass /><span><strong>Descriptive</strong>This records frequency, not identity.</span></div></div></div><div className="surface-card baseline-card"><div className="section-title"><div><p className="eyebrow">Behaviour Baseline Profile</p><h2>How often do you…</h2></div><Badge>10 items</Badge></div><div className="baseline-items">{baselineItems.map(([field, label], index) => <div key={field}><span className="baseline-index">{String(index + 1).padStart(2, "0")}</span><label>{label}</label><Select value={ratings[field]} onValueChange={(value) => setRatings({ ...ratings, [field]: value })}><SelectTrigger className="baseline-select"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{responseScale.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>)}</div><div className="control-rating"><div><p className="eyebrow">Habit Control Rating — before</p><h3>How much control do you feel you have over your habits?</h3><p>1 = my habits control me · 10 = I consciously design my habits</p></div><strong>{control}<span>/10</span></strong><Slider value={[control]} min={1} max={10} step={1} onValueChange={([value]) => setControl(value)} /></div>{error && <p className="field-error">{error}</p>}<Button className="w-full" size="lg" disabled={saving || !complete} onClick={() => void act({ action: "saveResponses", items: [...baselineItems.map(([semanticFieldId]) => ({ semanticFieldId, value: ratings[semanticFieldId], investigation: 0 })), { semanticFieldId: "HAB.CONTROL.PRE", value: control, investigation: 0 }] })}>{saving ? "Saving your starting point…" : <>Enter Habit Lab <ArrowRight /></>}</Button></div></section></main>;
}

function HomeView({ state, name, onContinue, onView }: { state: Snapshot; name: string; onContinue: () => void; onView: (view: View) => void }) {
  const current = Math.max(1, state.enrolment?.currentInvestigation || 1);
  const investigation = investigations[current - 1];
  const evidenceCount = Object.values(state.responses).filter((item) => item.status === "ANSWERED").length + state.events.length;
  const cue = valueOf(state, "HAB.CUE.TEXT", "Not mapped yet");
  const hypothesis = state.hypothesis?.statement;
  const adherence = state.measurements["HAB.BEI06"]?.value;
  const timing = state.experiment ? getExperimentTiming(state.experiment, state.events, todayInTimeZone(state.notificationPreference.timezone)) : null;
  const experimentPhase = current === 7 && state.experiment?.status === "ACTIVE" && timing;
  const continueTitle = !experimentPhase ? investigation.title : timing.status === "BEFORE_START" ? "Your experiment is prepared." : timing.status === "READY_TODAY" ? `Day ${timing.calendarDay} is ready when life gives you evidence.` : timing.status === "WINDOW_COMPLETE" ? "Your evidence window is complete." : "You are done for today.";
  const continueMission = !experimentPhase ? investigation.mission : timing.status === "BEFORE_START" ? `Day 1 opens on ${new Date(`${state.experiment!.startDate}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}. Nothing needs to be recorded early.` : timing.status === "READY_TODAY" ? "Notice the first time your cue appears. If it never appears, record no opportunity at the end of the day." : timing.status === "WINDOW_COMPLETE" ? "Choose whether to finish, extend or refine the experiment without rewriting earlier evidence." : `Your next observation opens ${timing.nextUnlockDate ? new Date(`${timing.nextUnlockDate}T00:00:00Z`).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" }) : "tomorrow"}. You do not need to manufacture another opportunity.`;
  const continueLabel = experimentPhase ? timing.status === "WINDOW_COMPLETE" ? "Review experiment decision" : timing.status === "READY_TODAY" ? "Open today's observation" : "See experiment status" : "Continue investigation";

  return (
    <div className="page-wrap home-view">
      <div className="page-intro">
        <div><p className="eyebrow">{new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })} · Your investigation</p><h1>Welcome back, {name}.</h1><p>Pick up where the evidence left you.</p></div>
        <Badge className="status-badge" variant="outline"><ShieldCheck /> Private investigation</Badge>
      </div>

      {state.reminders.length > 0 && <section className="reminder-stack" aria-label="Experiment reminders">{state.reminders.map((reminder) => <article key={reminder.id} className="reminder-card"><Bell /><div><strong>{reminder.title}</strong><p>{reminder.detail}</p></div>{reminder.priority === "ACTION" && <Button variant="outline" onClick={() => onView("experiment")}>Open experiment</Button>}</article>)}</section>}

      <section className="continue-card">
        <div className="continue-main">
          <div className="continue-top"><Badge>{experimentPhase ? "Phase B · Real-world experiment" : "Habit Lab"}</Badge><span>{experimentPhase && timing.calendarDay ? `Day ${timing.calendarDay} of ${timing.totalDays}` : `Investigation ${current} of 9`}</span></div>
          <h2>{continueTitle}</h2>
          <p>{continueMission}</p>
          <Progress value={(current / 9) * 100} />
          <div className="continue-actions"><Button size="lg" onClick={experimentPhase ? () => onView("experiment") : onContinue}>{continueLabel} <ArrowRight /></Button><span><NotebookTabs /> {experimentPhase ? "One entry per experienced day" : `About ${investigation.time}`}</span></div>
        </div>
        <div className="evidence-orbit" aria-hidden="true">
          <div className="orbit-center"><Search /><span>Current focus</span><strong>{current < 4 ? "Notice" : current < 7 ? "Test the explanation" : "Review evidence"}</strong></div>
          <span className="orbit-dot one" /><span className="orbit-dot two" /><span className="orbit-dot three" />
        </div>
      </section>

      <section className="home-grid">
        <article className="surface-card stat-card"><div className="card-icon coral"><Archive /></div><span>Evidence collected</span><strong>{evidenceCount}</strong><p>Responses and real-world observations</p><button onClick={() => onView("evidence")}>Open evidence vault <ChevronRight /></button></article>
        <article className="surface-card stat-card"><div className="card-icon teal"><Target /></div><span>Cue you are watching</span><strong className="stat-copy">{cue}</strong><p>{state.experiment ? "Active in your seven-day experiment" : "Your current working entry"}</p><button onClick={() => onView(state.experiment ? "experiment" : "lab")}>View current test <ChevronRight /></button></article>
        <article className="surface-card stat-card"><div className="card-icon amber"><FlaskConical /></div><span>Experiment evidence</span><strong>{state.events.length}<small> / {timing?.totalDays ?? 7} days</small></strong><p>{timing?.status === "WAITING_NEXT_DAY" || timing?.status === "CATCH_UP_AVAILABLE" ? "Today's observation is complete" : adherence === null || adherence === undefined ? "No calculated adherence yet" : `${adherence}% adherence — ${state.measurements["HAB.BEI06"]?.evidenceStrength.toLowerCase().replaceAll("_", " ")}`}</p><button onClick={() => onView(state.experiment ? "experiment" : "lab")}>{state.experiment ? timing?.status === "READY_TODAY" ? "Record today's evidence" : "Open experiment" : "Prepare experiment"} <ChevronRight /></button></article>
      </section>

      <section className="home-lower-grid">
        <article className="surface-card hypothesis-card">
          <div className="section-title"><div><p className="eyebrow">Your current hypothesis</p><h3>A working explanation, not a verdict.</h3></div><Badge variant="outline">{state.hypothesis?.status ?? "Not formed"}</Badge></div>
          <blockquote>{hypothesis || "Your working equation will appear after you map the pattern."}</blockquote>
          {state.hypothesis && <p><Lightbulb /> The next seven days may support it, challenge it or make it more specific.</p>}
        </article>
        <article className="companion-card">
          <div className="companion-mark"><Bot /></div>
          <div><p className="eyebrow">BIS Companion</p><h3>What would you like to understand?</h3><p>I can retrieve your evidence, clarify a question or help examine your working explanation.</p></div>
          <Button variant="outline" onClick={() => onView("companion")}>Open Companion <MessageCircleQuestion /></Button>
        </article>
      </section>
    </div>
  );
}

function LabRunner({ state, step, setStep, saving, act, onView }: { state: Snapshot; step: number; setStep: (step: number) => void; saving: boolean; act: (payload: Record<string, unknown>) => Promise<unknown>; onView: (view: View) => void }) {
  const info = investigations[step - 1];
  const maxStep = Math.max(1, state.enrolment?.currentInvestigation || 1);
  return (
    <div className="runner-shell">
      <div className="runner-topbar">
        <button className="back-link" onClick={() => onView("home")}><ArrowLeft /> Back home</button>
        <div className="runner-progress"><span>Investigation {step} of 9</span><Progress value={(step / 9) * 100} /></div>
      </div>
      <div className="runner-layout">
        <aside className="investigation-rail" aria-label="Habit Lab investigations">
          {investigations.map((item) => {
            const available = item.number <= Math.max(maxStep, step);
            const complete = item.number < maxStep;
            return <button key={item.number} disabled={!available} className={step === item.number ? "current" : complete ? "complete" : ""} onClick={() => setStep(item.number)}><span>{complete ? <Check /> : item.number}</span><div><small>{item.phase}</small><strong>{item.title}</strong></div></button>;
          })}
        </aside>
        <section className="runner-content">
          <div className="mission-line"><div><p className="eyebrow">Mission</p><h1>{info.title}</h1><p>{info.mission}</p></div><Badge variant="outline">{info.time}</Badge></div>
          {step === 1 && <InvestigationOne state={state} saving={saving} act={act} next={() => setStep(2)} />}
          {step === 2 && <InvestigationTwo state={state} saving={saving} act={act} next={() => setStep(3)} />}
          {step === 3 && <InvestigationThree state={state} saving={saving} act={act} next={() => setStep(4)} />}
          {step === 4 && <InvestigationFour state={state} saving={saving} act={act} next={() => setStep(5)} />}
          {step === 5 && <InvestigationFive state={state} saving={saving} act={act} next={() => setStep(6)} />}
          {step === 6 && <InvestigationSix state={state} saving={saving} act={act} next={() => { setStep(7); onView("experiment"); }} />}
          {step === 7 && <ExperimentView state={state} saving={saving} act={act} onView={onView} embedded />}
          {step === 8 && <InvestigationEight state={state} saving={saving} act={act} next={() => setStep(9)} />}
          {step === 9 && <InvestigationNine state={state} saving={saving} act={act} onView={onView} />}
        </section>
      </div>
    </div>
  );
}

function InvestigationOne({ state, saving, act, next }: StepProps) {
  const [prediction, setPrediction] = useState(valueOf(state, "HAB.STORY1.PREDICTION"));
  const choices = ["He gives up and goes back to his old habits", "He keeps wasting money and never changes", "Someone notices him and his path begins", "Nothing changes — he stays the same"];
  return (
    <div className="investigation-stack">
      <article className="story-card"><div className="story-heading"><BookOpen /><div><small>Episode 1</small><h2>The Boy Who Kept Losing R20</h2></div></div>{storyEpisodeOne.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>
      <article className="prompt-card"><p className="prompt-kicker"><Compass /> Predict before the story explains</p><h3>What do you think happens next for Sipho?</h3><div className="answer-list">{choices.map((choice) => <button type="button" key={choice} className={prediction === choice ? "selected" : ""} onClick={() => setPrediction(choice)}><span>{prediction === choice ? <Check /> : null}</span>{choice}</button>)}</div><p className="method-note">This prediction stays in the story. Your own behaviour prediction comes later.</p></article>
      <PauseCard question="What surprised me most so far?" />
      <StepFooter saving={saving} disabled={!prediction} onSave={async () => { await act({ action: "saveResponse", semanticFieldId: "HAB.STORY1.PREDICTION", value: prediction, investigation: 1 }); next(); }} />
    </div>
  );
}

type StepProps = { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<unknown>; next: () => void };

function InvestigationTwo({ state, saving, act, next }: StepProps) {
  const [form, setForm] = useState({
    pattern: valueOf(state, "HAB.PATTERN.TARGET"),
    evidence: valueOf(state, "HAB.EVIDENCE.INITIAL"),
    evidenceMeaning: valueOf(state, "HAB.EVIDENCE.INITIAL_MEANING"),
    obvious: valueOf(state, "HAB.REWARD.OBVIOUS"),
    lessObvious: valueOf(state, "HAB.REWARD.LESS_OBVIOUS"),
    observer: valueOf(state, "HAB.I2.OBSERVER.TEXT"),
    insight: valueOf(state, "HAB.I2.INSIGHT.TEXT"),
  });
  const [examples, setExamples] = useState(false);
  const ready = Object.values(form).every(Boolean);
  return (
    <div className="investigation-stack">
      <PromptSection number="01" title="Name the repeated pattern" prompt="What habit feels hardest to change—the one that costs you more than you want to admit?"><TextField value={form.pattern} onChange={(pattern) => setForm({ ...form, pattern })} placeholder="Name one specific repeated behaviour…" /></PromptSection>
      <PromptSection number="02" title="Find one piece of evidence" prompt="Think of one piece of evidence from the last seven days—a screenshot, object, message, photo, app history, calendar entry or something else."><TextField value={form.evidence} onChange={(evidence) => setForm({ ...form, evidence })} placeholder="Describe the evidence. Uploading anything is optional." /><TextField value={form.evidenceMeaning} onChange={(evidenceMeaning) => setForm({ ...form, evidenceMeaning })} placeholder="What does this show that memory alone might not?" /></PromptSection>
      <PromptSection number="03" title="Investigate the reward" prompt="What does this pattern give you—even if it also costs you?"><TextField value={form.obvious} onChange={(obvious) => setForm({ ...form, obvious })} placeholder="The obvious reward…" /><TextField value={form.lessObvious} onChange={(lessObvious) => setForm({ ...form, lessObvious })} placeholder="The feeling or less-obvious reward…" />{!examples ? <Button variant="ghost" className="self-start" onClick={() => setExamples(true)}>Still stuck? Show me examples</Button> : <div className="example-box">Some people discover relief from boredom, escape from a difficult feeling, a sense of control, temporary numbness or avoiding something uncomfortable. These are examples, not answers about you.</div>}</PromptSection>
      <PromptSection number="04" title="Observer question" prompt="If someone had been watching your behaviour, what might they have guessed about the reward you were seeking?"><TextField value={form.observer} onChange={(observer) => setForm({ ...form, observer })} /></PromptSection>
      <PromptSection number="05" title="Today’s insight" prompt="Finish this without thinking too hard: lately I’m noticing…"><TextField value={form.insight} onChange={(insight) => setForm({ ...form, insight })} /></PromptSection>
      <PauseCard question="Is there anything I’m hesitating to write down? If so, what?" />
      <StepFooter saving={saving} disabled={!ready} onSave={async () => { await act({ action: "saveResponses", items: [
        { semanticFieldId: "HAB.PATTERN.TARGET", value: form.pattern, investigation: 2 },
        { semanticFieldId: "HAB.EVIDENCE.INITIAL", value: form.evidence, investigation: 2 },
        { semanticFieldId: "HAB.EVIDENCE.INITIAL_MEANING", value: form.evidenceMeaning, investigation: 2 },
        { semanticFieldId: "HAB.REWARD.OBVIOUS", value: form.obvious, investigation: 2 },
        { semanticFieldId: "HAB.REWARD.LESS_OBVIOUS", value: form.lessObvious, investigation: 2 },
        { semanticFieldId: "HAB.I2.OBSERVER.TEXT", value: form.observer, investigation: 2 },
        { semanticFieldId: "HAB.I2.INSIGHT.TEXT", value: form.insight, investigation: 2 },
      ] }); next(); }} />
    </div>
  );
}

function InvestigationThree({ state, saving, act, next }: StepProps) {
  const [correct, setCorrect] = useState(valueOf(state, "HAB.STORY1.CORRECT"));
  const [assumption, setAssumption] = useState(valueOf(state, "HAB.STORY1.ASSUMPTION"));
  return <div className="investigation-stack"><article className="story-card revelation"><div className="story-heading"><Sparkles /><div><small>Episode 2</small><h2>What Sipho Didn’t See</h2></div></div>{storyEpisodeTwo.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<div className="loop-diagram"><div><small>Cue</small><strong>Something happens</strong></div><ArrowRight /><div><small>Routine</small><strong>You respond</strong></div><ArrowRight /><div><small>Reward</small><strong>You get something</strong></div></div></article><div className="observer-card"><Eye /><div><strong>The Observer</strong><p>Interesting. Nobody noticed what Sipho stopped doing that day. And nobody noticed what he was starting to do instead.</p></div></div><PromptSection number="01" title="Look back at your prediction" prompt="Was your prediction about Sipho correct?"><div className="choice-grid two"><ChoiceButton active={correct === "Yes"} title="Yes" detail="It matched what happened" onClick={() => setCorrect("Yes")} /><ChoiceButton active={correct === "No"} title="No" detail="The story challenged it" onClick={() => setCorrect("No")} /></div><TextField value={assumption} onChange={setAssumption} placeholder="What assumption did the story challenge?" /></PromptSection><StepFooter saving={saving} disabled={!correct || !assumption} onSave={async () => { await act({ action: "saveResponses", items: [{ semanticFieldId: "HAB.STORY1.CORRECT", value: correct, investigation: 3 }, { semanticFieldId: "HAB.STORY1.ASSUMPTION", value: assumption, investigation: 3 }] }); next(); }} /></div>;
}

function InvestigationFour({ state, saving, act, next }: StepProps) {
  const [form, setForm] = useState({
    cue: valueOf(state, "HAB.CUE.TEXT"), cueCertainty: numberOf(state, "HAB.CUE.CERTAINTY", 3), routine: valueOf(state, "HAB.ROUTINE.TEXT"), rewardCertainty: numberOf(state, "HAB.REWARD.CERTAINTY", 3), cost: valueOf(state, "HAB.COST.TEXT"), people: valueOf(state, "HAB.AFFECTED_PEOPLE.TEXT"), environment: valueOf(state, "HAB.ENVIRONMENT.TEXT"), alternative: valueOf(state, "HAB.ALTERNATIVE.TEXT"), emotion: valueOf(state, "HAB.EMOTION.TEXT"), person: valueOf(state, "HAB.SOCIAL_TRIGGER.TEXT"), frequency: valueOf(state, "HAB.FREQUENCY.YESTERDAY"), observer: valueOf(state, "HAB.I4.OBSERVER.TEXT"), insight: valueOf(state, "HAB.I4.INSIGHT.TEXT"),
  });
  const required = [form.cue, form.routine, form.cost, form.environment, form.alternative, form.emotion, form.frequency, form.observer, form.insight].every(Boolean);
  return <div className="investigation-stack"><div className="mapping-banner"><div><Target /><span>Your target pattern</span><strong>{valueOf(state, "HAB.PATTERN.TARGET", "One repeated behaviour")}</strong></div><p>Map what happens. You can return and revise any working entry as your evidence changes.</p></div><div className="mapping-grid">
    <PromptSection number="01" title="Cue" prompt="What happens right before this pattern—time, place, person, feeling, event or situation?"><TextField value={form.cue} onChange={(cue) => setForm({ ...form, cue })} /><ScaleField label="How certain are you?" value={form.cueCertainty} max={5} onChange={(cueCertainty) => setForm({ ...form, cueCertainty })} /></PromptSection>
    <PromptSection number="02" title="Routine" prompt="Exactly what do you do? Walk through the steps."><TextField value={form.routine} onChange={(routine) => setForm({ ...form, routine })} /></PromptSection>
    <PromptSection number="03" title="Reward" prompt="Review the obvious and less-obvious rewards you named."><div className="evidence-quote"><span>Obvious</span>{valueOf(state, "HAB.REWARD.OBVIOUS", "Not answered")}</div><div className="evidence-quote"><span>Less obvious</span>{valueOf(state, "HAB.REWARD.LESS_OBVIOUS", "Not answered")}</div><ScaleField label="How certain are you?" value={form.rewardCertainty} max={5} onChange={(rewardCertainty) => setForm({ ...form, rewardCertainty })} /></PromptSection>
    <PromptSection number="04" title="Cost" prompt="What does this pattern cost you—time, money, energy, self-respect or relationships?"><TextField value={form.cost} onChange={(cost) => setForm({ ...form, cost })} /><TextField value={form.people} onChange={(people) => setForm({ ...form, people })} placeholder="Who else, if anyone, is affected?" /></PromptSection>
    <PromptSection number="05" title="Environment" prompt="Where does this happen most, and what about that place makes it easier?"><TextField value={form.environment} onChange={(environment) => setForm({ ...form, environment })} /></PromptSection>
    <PromptSection number="06" title="Replacement routine" prompt="What could give you a similar reward with a lower cost?"><TextField value={form.alternative} onChange={(alternative) => setForm({ ...form, alternative })} /></PromptSection>
    <PromptSection number="07" title="Diagnostic layer" prompt="Add context. These are observations, not identity labels."><TextField value={form.emotion} onChange={(emotion) => setForm({ ...form, emotion })} placeholder="Emotion before the pattern" /><TextField value={form.person} onChange={(person) => setForm({ ...form, person })} placeholder="Person who may make it more likely (optional)" /><Input type="number" min={0} value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} placeholder="How many times yesterday?" /></PromptSection>
    <PromptSection number="08" title="Observer question" prompt="If someone watched you for a week, what pattern might they see that you haven’t noticed?"><TextField value={form.observer} onChange={(observer) => setForm({ ...form, observer })} /></PromptSection>
    <PromptSection number="09" title="Today’s insight" prompt="What might someone close to you notice about this pattern?"><TextField value={form.insight} onChange={(insight) => setForm({ ...form, insight })} /></PromptSection>
  </div><StepFooter saving={saving} disabled={!required} onSave={async () => { await act({ action: "saveResponses", items: [
    ["HAB.CUE.TEXT", form.cue], ["HAB.CUE.CERTAINTY", form.cueCertainty], ["HAB.ROUTINE.TEXT", form.routine], ["HAB.REWARD.CERTAINTY", form.rewardCertainty], ["HAB.COST.TEXT", form.cost], ["HAB.AFFECTED_PEOPLE.TEXT", form.people], ["HAB.ENVIRONMENT.TEXT", form.environment], ["HAB.ALTERNATIVE.TEXT", form.alternative], ["HAB.EMOTION.TEXT", form.emotion], ["HAB.SOCIAL_TRIGGER.TEXT", form.person], ["HAB.FREQUENCY.YESTERDAY", Number(form.frequency)], ["HAB.I4.OBSERVER.TEXT", form.observer], ["HAB.I4.INSIGHT.TEXT", form.insight],
  ].map(([semanticFieldId, value]) => ({ semanticFieldId, value, investigation: 4 })) }); next(); }} /></div>;
}

function InvestigationFive({ state, saving, act, next }: StepProps) {
  const suggested = `${valueOf(state, "HAB.CUE.TEXT", "Cue")} + ${valueOf(state, "HAB.ROUTINE.TEXT", "old routine")} → ${valueOf(state, "HAB.COST.TEXT", "cost")}`;
  const [equation, setEquation] = useState(state.hypothesis?.statement || valueOf(state, "HAB.EQUATION.TEXT", suggested));
  const [falsification, setFalsification] = useState(state.hypothesis?.falsificationStatement || valueOf(state, "HAB.FALSIFICATION.TEXT"));
  const [misunderstood, setMisunderstood] = useState(valueOf(state, "HAB.FALSIFICATION.MISUNDERSTOOD"));
  const [observer, setObserver] = useState(valueOf(state, "HAB.I5.OBSERVER.TEXT"));
  const [insight, setInsight] = useState(valueOf(state, "HAB.I5.INSIGHT.TEXT"));
  const [confidence, setConfidence] = useState(state.hypothesis?.learnerConfidence || numberOf(state, "HAB.EQUATION.CONFIDENCE_PRE", 5));
  const examples = [
    ["Doomscrolling", "Boredom + Phone nearby → Lost evening"],
    ["Skipping practice", "Fatigue + Easy distraction → Missed session"],
    ["Late-night snacking", "Restlessness + Available snacks → Regret next morning"],
    ["Abandoning projects", "Initial excitement fades + New distraction → Unfinished task"],
  ];
  const ready = [equation, falsification, misunderstood, observer, insight].every(Boolean);
  return <div className="investigation-stack">
    <div className="equation-card"><p className="eyebrow">Working Behaviour Equation</p><div className="equation-structure"><span>Cue + Old Routine</span><ArrowRight /><span>Cost</span></div><div className="equation-structure alternative"><span>Cue + New Routine</span><ArrowRight /><span>Similar Reward + Lower Cost</span></div><p>This isn’t a verdict. It’s a working explanation that the next seven days will test.</p></div>
    <PromptSection number="01" title="Write your current explanation" prompt="Based on what you have noticed so far, what is your working equation?"><TextField value={equation} onChange={setEquation} rows={4} /><ScaleField label="How confident are you that this explains the pattern?" value={confidence} max={10} onChange={setConfidence} /></PromptSection>
    <PromptSection number="02" title="Make it challengeable" prompt="If I’m wrong about this habit pattern, what would I see?"><TextField value={falsification} onChange={setFalsification} rows={4} placeholder="Name one observation that could prove the equation wrong." /><TextField value={misunderstood} onChange={setMisunderstood} rows={4} placeholder="What evidence would convince you that you’ve misunderstood this pattern?" /></PromptSection>
    <PromptSection number="03" title="Observer question" prompt="If your best friend looked at this equation, what would they agree with? What would they challenge?"><TextField value={observer} onChange={setObserver} /></PromptSection>
    <PromptSection number="04" title="Today’s insight" prompt="If this week were evidence about what you can influence, what would it suggest?"><TextField value={insight} onChange={setInsight} /></PromptSection>
    <section className="surface-card equation-examples"><div className="section-title"><div><p className="eyebrow">Repetition-specific examples</p><h2>Example working equations</h2><p>Use the structure, not the answer.</p></div><Lightbulb /></div><div>{examples.map(([pattern, workingEquation]) => <article key={pattern}><strong>{pattern}</strong><span>{workingEquation}</span></article>)}</div></section>
    <StepFooter saving={saving} disabled={!ready} onSave={async () => { await act({ action: "saveHypothesis", statement: equation, falsificationStatement: falsification, learnerConfidence: confidence, misunderstood, observer, insight }); next(); }} />
  </div>;
}

function InvestigationSix({ state, saving, act, next }: StepProps) {
  const [form, setForm] = useState({ targetPattern: valueOf(state, "HAB.PATTERN.TARGET"), targetCondition: valueOf(state, "HAB.CUE.TEXT"), alternativeBehaviour: valueOf(state, "HAB.ALTERNATIVE.TEXT"), expectedReward: valueOf(state, "HAB.REWARD.LESS_OBVIOUS"), witness: "", restartPlan: "Restart at the next opportunity without guilt", minimumVersion: "Pause for 30 seconds before the old routine", failureSignal: "The replacement does not answer the reward I am seeking", insight: valueOf(state, "HAB.I6.INSIGHT.TEXT"), predictedValue: 60, startDate: localDate(), plannedEndDate: localDate(6) });
  const [domains, setDomains] = useState<string[]>([]);
  const allReady = [form.targetPattern, form.targetCondition, form.alternativeBehaviour, form.expectedReward, form.restartPlan, form.minimumVersion, form.failureSignal, form.insight, form.startDate, form.plannedEndDate].every(Boolean);
  return <div className="investigation-stack"><div className="contract-intro"><FlaskConical /><div><p className="eyebrow">Your investigation leaves the workbook</p><h2>Design a test you can actually observe.</h2><p>For seven days, notice the first time your cue appears. Record whether you used the replacement routine.</p></div></div><div className="contract-grid">
    <PromptSection number="01" title="What you will test" prompt="Keep the target specific and observable."><TextField value={form.targetPattern} onChange={(targetPattern) => setForm({ ...form, targetPattern })} placeholder="One habit I will track" /><TextField value={form.alternativeBehaviour} onChange={(alternativeBehaviour) => setForm({ ...form, alternativeBehaviour })} placeholder="My new routine — what I will do instead" /><TextField value={form.targetCondition} onChange={(targetCondition) => setForm({ ...form, targetCondition })} placeholder="My cue — time, place, person, feeling, event, or situation" /><TextField value={form.expectedReward} onChange={(expectedReward) => setForm({ ...form, expectedReward })} placeholder="My reward — what the new routine should provide" /></PromptSection>
    <PromptSection number="02" title="Make it resilient" prompt="Plan for a difficult day before one happens."><TextField value={form.witness} onChange={(witness) => setForm({ ...form, witness })} placeholder="Witness (optional)" /><TextField value={form.restartPlan} onChange={(restartPlan) => setForm({ ...form, restartPlan })} placeholder="Restart plan" /><TextField value={form.minimumVersion} onChange={(minimumVersion) => setForm({ ...form, minimumVersion })} placeholder="Smallest version on your worst day" /><TextField value={form.failureSignal} onChange={(failureSignal) => setForm({ ...form, failureSignal })} placeholder="How you will know the experiment needs adjustment" /></PromptSection>
    <PromptSection number="03" title="Habit Impact Profile" prompt="Which parts of your life does this pattern affect? This is a profile, not a risk score."><div className="domain-grid">{["Health", "Money", "Relationships", "School", "Work", "Mental wellbeing"].map((domain) => <label key={domain}><Checkbox checked={domains.includes(domain)} onCheckedChange={(checked) => setDomains(checked === true ? [...domains, domain] : domains.filter((item) => item !== domain))} />{domain}</label>)}</div></PromptSection>
    <PromptSection number="04" title="Predict your own behaviour" prompt="When your cue appears, how often do you predict you will use the replacement routine?"><div className="prediction-value">{form.predictedValue}<span>%</span></div><Slider value={[form.predictedValue]} min={0} max={100} step={5} onValueChange={([predictedValue]) => setForm({ ...form, predictedValue })} /><div className="date-grid"><label>Start date<Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label>Planned end date<Input type="date" value={form.plannedEndDate} onChange={(event) => setForm({ ...form, plannedEndDate: event.target.value })} /></label></div></PromptSection>
    <PromptSection number="05" title="Today’s insight" prompt="What feels different about how you approach this pattern right now?"><TextField value={form.insight} onChange={(insight) => setForm({ ...form, insight })} /></PromptSection>
  </div><div className="commitment-note"><ShieldCheck /><p>I understand that this experiment is for evidence, not perfection. If I miss a day, I will return without guilt—because guilt is not a strategy.</p></div><StepFooter label="Start seven-day experiment" saving={saving} disabled={!allReady} onSave={async () => { await act({ action: "startExperiment", ...form, impactDomains: domains }); next(); }} /></div>;
}

function ExperimentView({ state, saving, act, onView, embedded = false }: { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<unknown>; onView: (view: View) => void; embedded?: boolean }) {
  const experiment = state.experiment;
  const timing = experiment ? getExperimentTiming(experiment, state.events, todayInTimeZone(state.notificationPreference.timezone)) : null;
  const [selectedDay, setSelectedDay] = useState(() => timing?.suggestedDay ?? 1);
  const existing = experiment ? state.events.find((event) => event.dayNumber === selectedDay) : undefined;
  const [cueOccurred, setCueOccurred] = useState<boolean | null>(existing?.targetConditionOccurred ?? null);
  const [alternativeUsed, setAlternativeUsed] = useState<boolean | null>(existing?.alternativeUsed ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  function chooseDay(day: number) {
    const event = state.events.find((item) => item.dayNumber === day);
    setSelectedDay(day);
    setCueOccurred(event?.targetConditionOccurred ?? null);
    setAlternativeUsed(event?.alternativeUsed ?? null);
    setNotes(event?.notes ?? "");
  }

  if (!experiment) return <EmptyExperiment onView={onView} embedded={embedded} />;
  const start = new Date(`${experiment.startDate}T00:00:00Z`);
  const totalDays = timing!.totalDays;
  const availableDay = timing!.availableDay;
  const opportunityCount = Number(state.measurements["HAB.EXPERIMENT.OPPORTUNITY_COUNT"]?.value ?? 0);
  const replacementCount = Number(state.measurements["HAB.EXPERIMENT.REPLACEMENT_COUNT"]?.value ?? 0);
  const adherence = state.measurements["HAB.BEI06"]?.value;
  const evidenceStrength = state.measurements["HAB.BEI06"]?.evidenceStrength ?? "NONE";
  const active = experiment.status === "ACTIVE";
  const canClose = timing!.canClose;
  const selectedDate = new Date(start);
  selectedDate.setUTCDate(start.getUTCDate() + selectedDay - 1);
  const selectedUnavailable = selectedDay > availableDay;
  const nextDate = timing!.nextUnlockDate ? new Date(`${timing!.nextUnlockDate}T00:00:00Z`).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" }) : null;
  const statusTitle = timing!.status === "BEFORE_START" ? "Your experiment is prepared—not late." : timing!.status === "READY_TODAY" ? `Day ${timing!.calendarDay} is open.` : timing!.status === "WINDOW_COMPLETE" ? "The evidence window is complete." : timing!.status === "CLOSED" ? "This experiment is closed." : "You are done for today.";
  const statusMessage = timing!.status === "BEFORE_START" ? `Day 1 opens on ${start.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}. Future evidence cannot be entered early.` : timing!.status === "READY_TODAY" ? "Wait for the first real target opportunity. If the cue does not appear, record no opportunity at the end of the day." : timing!.status === "CATCH_UP_AVAILABLE" ? `Today's entry is complete. Day ${timing!.missingAvailableDay} is still empty; fill it only if you clearly remember what happened.` : timing!.status === "WAITING_NEXT_DAY" ? `Nothing else is required today. Your next observation opens ${nextDate}.` : timing!.status === "WINDOW_COMPLETE" ? "Review the opportunity count and choose whether to finish, extend or refine the cue." : "The record remains available for inspection and correction.";
  const strengthLabel = evidenceStrength === "SUFFICIENT_FOR_LAB" ? "Sufficient for this Lab" : evidenceStrength === "LIMITED" ? "Limited evidence" : "No opportunities yet";

  return <div className={`experiment-view ${embedded ? "embedded" : "page-wrap"}`}>
    {!embedded && <div className="page-intro"><div><p className="eyebrow">{active ? "Active experiment" : "Experiment complete"}</p><h1>Notice what actually happens.</h1><p>One target opportunity per day. No opportunity is not failure.</p></div><Badge>{state.events.length} of {totalDays} days recorded</Badge></div>}
    <section className="experiment-hero"><div><p className="eyebrow">You are testing · Version {experiment.parameterVersion}</p><h2>Whether <em>{experiment.targetCondition}</em> is connected to <em>{experiment.targetPattern}</em>.</h2></div><div className="alternative-chip"><span>Your alternative</span><strong>{experiment.alternativeBehaviour}</strong></div></section>
    <section className={`experiment-status ${timing!.status.toLowerCase().replaceAll("_", "-")}`}><div className="experiment-status-icon">{timing!.status === "READY_TODAY" ? <Eye /> : timing!.status === "WINDOW_COMPLETE" || timing!.status === "CLOSED" ? <Check /> : <CalendarDays />}</div><div><p className="eyebrow">Current state</p><h2>{statusTitle}</h2><p>{statusMessage}</p></div><Badge variant="outline">{timing!.calendarDay ? `Day ${timing!.calendarDay} of ${totalDays}` : timing!.status === "BEFORE_START" ? "Starts soon" : "Review ready"}</Badge></section>
    {active && timing!.status !== "WINDOW_COMPLETE" && <section className="between-observations surface-card"><div className="section-title"><div><p className="eyebrow">Between observations</p><h3>{timing!.status === "READY_TODAY" ? "Live the experiment; do not force the evidence." : "There is nothing else to submit right now."}</h3><p>The experiment continues in real life even while the form is waiting.</p></div><Compass /></div><ol><li><span>1</span><div><strong>Watch for the first cue</strong><p>Notice the first genuine target opportunity—not every possible moment.</p></div></li><li><span>2</span><div><strong>Use the smallest useful alternative</strong><p>Your minimum version counts when the full replacement routine is unrealistic.</p></div></li><li><span>3</span><div><strong>Return once for that day</strong><p>Record what happened. If no opportunity appeared, say so rather than guessing.</p></div></li></ol><div className="between-actions"><Button variant="outline" onClick={() => onView("companion")}>Ask the Companion</Button><Button variant="outline" onClick={() => onView("evidence")}>Review evidence overview</Button></div></section>}
    <section className="experiment-grid">
      <div className="surface-card days-card"><div className="section-title"><div><h3>{totalDays > 7 ? "Extended evidence window" : "Seven-day evidence"}</h3><p>Future days unlock only after they happen. Correct an earlier day only from clear memory—never fill a gap by guessing.</p></div><CalendarDays /></div><div className="day-list">{Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => {
        const event = state.events.find((item) => item.dayNumber === day);
        const disabled = day > availableDay;
        return <button key={day} disabled={disabled} className={`${selectedDay === day ? "selected" : ""} ${event ? "recorded" : ""}`} onClick={() => chooseDay(day)}><span>{event ? <Check /> : day}</span><div><strong>Day {day}</strong><small>{disabled ? "Not experienced yet" : event ? event.targetConditionOccurred ? event.alternativeUsed ? "Alternative used" : "Cue observed" : "No target opportunity" : day === timing!.calendarDay ? "Ready today" : "Available to recall"}</small></div>{disabled ? <LockKeyhole /> : <ChevronRight />}</button>;
      })}</div></div>
      <div className="surface-card checkin-card"><p className="eyebrow">Day {selectedDay} check-in · {selectedDate.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</p>{selectedUnavailable ? <div className="waiting-checkin"><LockKeyhole /><h3>This day has not happened yet.</h3><p>Future observations stay locked. Return on that date so the record remains evidence rather than prediction.</p></div> : active ? <><h3>Did your cue occur?</h3><div className="choice-grid two"><ChoiceButton active={cueOccurred === true} title="Yes" detail="A target opportunity occurred" onClick={() => setCueOccurred(true)} /><ChoiceButton active={cueOccurred === false} title="No" detail="No target opportunity today" onClick={() => { setCueOccurred(false); setAlternativeUsed(null); }} /></div>{cueOccurred === true && <><h3>Did you use your new routine?</h3><div className="choice-grid two"><ChoiceButton active={alternativeUsed === true} title="Yes" detail="I used the alternative" onClick={() => setAlternativeUsed(true)} /><ChoiceButton active={alternativeUsed === false} title="No" detail="I used the old routine" onClick={() => setAlternativeUsed(false)} /></div></>} {cueOccurred === false && <div className="no-opportunity"><Eye /><div><strong>No target opportunity today.</strong><p>This is valid evidence. It is excluded from adherence rather than scored as 0%.</p></div></div>}<label className="field-label">What happened? <span>Optional</span></label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add only what will help you remember the moment…" /><Button className="w-full" size="lg" disabled={saving || cueOccurred === null || (cueOccurred === true && alternativeUsed === null)} onClick={() => void act({ action: "saveEvent", experimentId: experiment.id, dayNumber: selectedDay, occurredAt: selectedDate.toISOString(), targetConditionOccurred: cueOccurred, alternativeUsed, notes })}>{saving ? "Saving evidence…" : existing ? "Update this evidence" : "Save this evidence"}</Button></> : <div className="closed-checkin"><ShieldCheck /><h3>This evidence window is closed.</h3><p>You can inspect each day, the calculation trail and parameter history. New observations are paused for this experiment.</p><Button variant="outline" onClick={() => onView("evidence")}>Open evidence vault</Button></div>}</div>
    </section>
    <section className="measurement-strip"><div><span>Opportunities observed</span><strong>{opportunityCount}</strong></div><div><span>Alternative used</span><strong>{replacementCount}</strong></div><div><span>Adherence</span><strong>{adherence === null || adherence === undefined ? "N/A" : `${adherence}%`}</strong></div><div><span>Evidence strength</span><strong>{strengthLabel}</strong></div></section>
    {state.events.length >= 3 && <CheckpointPanel state={state} saving={saving} act={act} />}
    {canClose && <ExperimentClosure state={state} saving={saving} act={act} />}
    {!active && <div className="checkpoint-card complete"><div className="card-icon teal"><Check /></div><div><p className="eyebrow">Evidence review ready</p><h3>{experiment.status === "COMPLETED_INSUFFICIENT" ? "Finished with insufficient evidence." : "Experiment complete."}</h3><p>The record preserves missingness, every parameter version and the inputs behind each calculated value.</p></div><Button variant="outline" onClick={() => onView("evidence")}>Inspect evidence</Button></div>}
  </div>;
}

function CheckpointPanel({ state, saving, act }: { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const experiment = state.experiment!;
  const checkpoint = state.checkpoints.find((item) => item.dayNumber === 3);
  const [surprise, setSurprise] = useState("");
  const [observability, setObservability] = useState("AS_EXPECTED");
  const [support, setSupport] = useState("");
  const [challenge, setChallenge] = useState("");
  const [decision, setDecision] = useState("KEEP");
  const [targetCondition, setTargetCondition] = useState(experiment.targetCondition);
  const [alternativeBehaviour, setAlternativeBehaviour] = useState(experiment.alternativeBehaviour);

  if (checkpoint) {
    return <section className="surface-card checkpoint-summary"><div className="section-title"><div><p className="eyebrow">Day 3 checkpoint recorded</p><h3>{checkpoint.decision === "ADJUST" ? "The experiment was calibrated." : "The original parameters were kept."}</h3></div><Badge variant="outline">{state.parameterVersions.length} parameter version{state.parameterVersions.length === 1 ? "" : "s"}</Badge></div><div className="checkpoint-evidence"><div><span>What surprised you</span><p>{checkpoint.surprise}</p></div><div><span>Supported</span><p>{checkpoint.evidenceSupport}</p></div><div><span>Challenged</span><p>{checkpoint.evidenceChallenge}</p></div></div>{state.parameterVersions.length > 0 && <details className="version-history"><summary>Inspect parameter history</summary>{state.parameterVersions.map((version) => <div key={version.id}><strong>Version {version.version}</strong><span>Effective {new Date(version.effectiveFrom).toLocaleString("en-ZA")}</span><p>Cue: {version.targetCondition}</p><p>Alternative: {version.alternativeBehaviour}</p></div>)}</details>}</section>;
  }

  if (experiment.status !== "ACTIVE") return null;
  const complete = surprise && support && challenge && (decision === "KEEP" || targetCondition !== experiment.targetCondition || alternativeBehaviour !== experiment.alternativeBehaviour);
  return <section className="surface-card checkpoint-form"><div className="section-title"><div><p className="eyebrow">Day 3 checkpoint</p><h3>Calibrate without erasing version 1.</h3></div><RotateCcw /></div><div className="checkpoint-fields"><label>What surprised you?<Textarea value={surprise} onChange={(event) => setSurprise(event.target.value)} /></label><label>How observable is the cue now?<Select value={observability} onValueChange={setObservability}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EASIER">Easier to catch</SelectItem><SelectItem value="AS_EXPECTED">About as expected</SelectItem><SelectItem value="HARDER">Harder to catch</SelectItem></SelectContent></Select></label><label>What supports your equation?<Textarea value={support} onChange={(event) => setSupport(event.target.value)} /></label><label>What challenges it?<Textarea value={challenge} onChange={(event) => setChallenge(event.target.value)} /></label></div><div className="choice-grid two"><ChoiceButton active={decision === "KEEP"} title="Keep version 1" detail="Continue with the current cue and alternative" onClick={() => setDecision("KEEP")} /><ChoiceButton active={decision === "ADJUST"} title="Create version 2" detail="Change the cue or alternative from now on" onClick={() => setDecision("ADJUST")} /></div>{decision === "ADJUST" && <div className="checkpoint-adjust"><label>Updated cue<Input value={targetCondition} onChange={(event) => setTargetCondition(event.target.value)} /></label><label>Updated alternative<Input value={alternativeBehaviour} onChange={(event) => setAlternativeBehaviour(event.target.value)} /></label></div>}<Button size="lg" disabled={saving || !complete} onClick={() => void act({ action: "saveCheckpoint", experimentId: experiment.id, surprise, observability, evidenceSupport: support, evidenceChallenge: challenge, decision, targetCondition, alternativeBehaviour })}>{saving ? "Saving checkpoint…" : "Save checkpoint"}</Button></section>;
}

function ExperimentClosure({ state, saving, act }: { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const experiment = state.experiment!;
  const opportunities = Number(state.measurements["HAB.EXPERIMENT.OPPORTUNITY_COUNT"]?.value ?? 0);
  const sufficient = opportunities >= experiment.minimumEvidenceThreshold;
  const [cue, setCue] = useState(experiment.targetCondition);
  return <section className="surface-card closure-card"><div className="section-title"><div><p className="eyebrow">End-of-window decision</p><h3>{sufficient ? "Your review has enough lab evidence." : "The evidence is still limited."}</h3><p>{opportunities} eligible opportunit{opportunities === 1 ? "y" : "ies"} observed · minimum {experiment.minimumEvidenceThreshold}</p></div><Badge variant="outline">{sufficient ? "Review ready" : "Insufficient evidence"}</Badge></div>{sufficient ? <div className="closure-actions"><p>Finish the experiment to unlock the evidence review, or extend if another few days would answer a specific question.</p><Button disabled={saving} onClick={() => void act({ action: "completeExperiment", experimentId: experiment.id, decision: "FINISH" })}>Finish and review</Button><Button variant="outline" disabled={saving} onClick={() => void act({ action: "completeExperiment", experimentId: experiment.id, decision: "EXTEND" })}>Extend 3 days</Button></div> : <div className="closure-options"><article><h4>Extend the window</h4><p>Keep the current cue and collect three more days.</p><Button variant="outline" disabled={saving} onClick={() => void act({ action: "completeExperiment", experimentId: experiment.id, decision: "EXTEND" })}>Extend 3 days</Button></article><article><h4>Use a more observable cue</h4><p>Version the cue, then collect three more days.</p><Input value={cue} onChange={(event) => setCue(event.target.value)} /><Button variant="outline" disabled={saving || cue.trim() === experiment.targetCondition} onClick={() => void act({ action: "completeExperiment", experimentId: experiment.id, decision: "ADJUST_CUE", targetCondition: cue })}>Adjust and extend</Button></article><article><h4>Finish honestly</h4><p>Close the experiment with insufficient evidence. N/A values remain N/A.</p><Button variant="outline" disabled={saving} onClick={() => void act({ action: "completeExperiment", experimentId: experiment.id, decision: "FINISH_INSUFFICIENT" })}>Finish with insufficient evidence</Button></article></div>}</section>;
}

function EmptyExperiment({ onView, embedded }: { onView: (view: View) => void; embedded: boolean }) {
  return <div className={embedded ? "empty-state" : "page-wrap empty-page"}><FlaskConical /><h2>Your experiment is not ready yet.</h2><p>Complete your Behaviour Equation and Behaviour Contract first.</p><Button onClick={() => onView("lab")}>Continue Habit Lab <ArrowRight /></Button></div>;
}

function InvestigationEight({ state, saving, act, next }: StepProps) {
  const [control, setControl] = useState(numberOf(state, "HAB.CONTROL.POST", 5));
  const [confidence, setConfidence] = useState(numberOf(state, "HAB.EQUATION.CONFIDENCE_POST", state.hypothesis?.learnerConfidence ?? 5));
  const [reflection, setReflection] = useState({
    cueFrequency: valueOf(state, "HAB.I8.CUE_FREQUENCY.TEXT"),
    routineUse: valueOf(state, "HAB.I8.ROUTINE_USE.TEXT"),
    hardest: valueOf(state, "HAB.I8.HARDEST.TEXT"),
    best: valueOf(state, "HAB.I8.BEST.TEXT"),
    difficultyChange: valueOf(state, "HAB.I8.DIFFICULTY_CHANGE.TEXT"),
    supporting: valueOf(state, "HAB.EVIDENCE.SUPPORTING"),
    challenging: valueOf(state, "HAB.EVIDENCE.CHALLENGING"),
    assumption: valueOf(state, "HAB.I8.ASSUMPTION.TEXT"),
    metaPlan: valueOf(state, "HAB.META_HABIT.PLAN"),
    observer: valueOf(state, "HAB.I8.OBSERVER.TEXT"),
  });
  const opportunityCount = Number(state.measurements["HAB.EXPERIMENT.OPPORTUNITY_COUNT"]?.value ?? 0);
  const adherence = state.measurements["HAB.BEI06"]?.value;
  const accuracy = state.measurements["HAB.BEI03"]?.value;
  const ready = Object.values(reflection).every(Boolean);
  return <div className="investigation-stack">
    <section className="evidence-review-sequence"><div><small>Original hypothesis</small><strong>{state.hypothesis?.statement ?? "Not recorded"}</strong></div><div><small>Original prediction</small><strong>{state.experiment?.predictedValue ?? "—"}%</strong></div><div><small>Actual events</small><strong>{opportunityCount} opportunities</strong></div><div><small>Adherence</small><strong>{adherence === null || adherence === undefined ? "N/A" : `${adherence}%`}</strong></div><div><small>Prediction accuracy</small><strong>{accuracy === null || accuracy === undefined ? "N/A" : `${accuracy}/100`}</strong></div></section>
    <PromptSection number="01" title="Rate again after seeing the evidence" prompt="A lower rating is not failure. Observing closely can change how you judge the pattern."><ScaleField label="How much control do you have over your habits now?" value={control} max={10} onChange={setControl} /><ScaleField label="How confident are you now that your working equation explains your behaviour?" value={confidence} max={10} onChange={setConfidence} /></PromptSection>
    <div className="review-grid">
      <PromptSection number="02" title="Cue opportunities" prompt="Did my cue appear on most days? Why or why not?"><TextField value={reflection.cueFrequency} onChange={(cueFrequency) => setReflection({ ...reflection, cueFrequency })} /></PromptSection>
      <PromptSection number="03" title="Replacement routine" prompt="When my cue appeared, did I use my new routine? What made it easier or harder?"><TextField value={reflection.routineUse} onChange={(routineUse) => setReflection({ ...reflection, routineUse })} /></PromptSection>
      <PromptSection number="04" title="The hardest part" prompt="What was the hardest part of the seven days?"><TextField value={reflection.hardest} onChange={(hardest) => setReflection({ ...reflection, hardest })} /></PromptSection>
      <PromptSection number="05" title="The best part" prompt="What was the best part?"><TextField value={reflection.best} onChange={(best) => setReflection({ ...reflection, best })} /></PromptSection>
      <PromptSection number="06" title="Change across the week" prompt="Did my habit get easier over time, or stay difficult?"><TextField value={reflection.difficultyChange} onChange={(difficultyChange) => setReflection({ ...reflection, difficultyChange })} /></PromptSection>
      <PromptSection number="07" title="Evidence that supported it" prompt="What evidence convinced you that this pattern exists?"><TextField value={reflection.supporting} onChange={(supporting) => setReflection({ ...reflection, supporting })} /></PromptSection>
      <PromptSection number="08" title="Evidence that challenged it" prompt="What evidence challenged your understanding of this pattern?"><TextField value={reflection.challenging} onChange={(challenging) => setReflection({ ...reflection, challenging })} /></PromptSection>
      <PromptSection number="09" title="An assumption under pressure" prompt="Which assumption about this pattern became harder to defend after this experiment?"><TextField value={reflection.assumption} onChange={(assumption) => setReflection({ ...reflection, assumption })} /></PromptSection>
    </div>
    <PromptSection number="10" title="My meta-habit" prompt="The meta-habit is the habit of noticing and adjusting your habits. What is your plan to keep it alive?"><TextField value={reflection.metaPlan} onChange={(metaPlan) => setReflection({ ...reflection, metaPlan })} /></PromptSection>
    <PromptSection number="11" title="Observer question" prompt="If you were the observer of your own experiment, what would you conclude about the pattern?"><TextField value={reflection.observer} onChange={(observer) => setReflection({ ...reflection, observer })} /></PromptSection>
    <StepFooter saving={saving} disabled={!ready} onSave={async () => { await act({ action: "saveResponses", items: [
      ["HAB.CONTROL.POST", control],
      ["HAB.EQUATION.CONFIDENCE_POST", confidence],
      ["HAB.I8.CUE_FREQUENCY.TEXT", reflection.cueFrequency],
      ["HAB.I8.ROUTINE_USE.TEXT", reflection.routineUse],
      ["HAB.I8.HARDEST.TEXT", reflection.hardest],
      ["HAB.I8.BEST.TEXT", reflection.best],
      ["HAB.I8.DIFFICULTY_CHANGE.TEXT", reflection.difficultyChange],
      ["HAB.EVIDENCE.SUPPORTING", reflection.supporting],
      ["HAB.EVIDENCE.CHALLENGING", reflection.challenging],
      ["HAB.I8.ASSUMPTION.TEXT", reflection.assumption],
      ["HAB.META_HABIT.PLAN", reflection.metaPlan],
      ["HAB.I8.OBSERVER.TEXT", reflection.observer],
    ].map(([semanticFieldId, value]) => ({ semanticFieldId, value, investigation: 8 })) }); next(); }} />
  </div>;
}

function InvestigationNine({ state, saving, act, onView }: { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<unknown>; onView: (view: View) => void }) {
  const [agency, setAgency] = useState(valueOf(state, "HAB.AGENCY.REFLECTION"));
  const [capability, setCapability] = useState(valueOf(state, "HAB.I9.CAPABILITY.TEXT"));
  const [letter, setLetter] = useState(valueOf(state, "HAB.I9.FUTURE_LETTER"));
  const [nextPattern, setNextPattern] = useState(valueOf(state, "HAB.NEXT_PATTERN.TEXT"));
  const [remember, setRemember] = useState(false);
  const ready = [agency, capability, letter, nextPattern].every(Boolean);
  return <div className="investigation-stack">
    <div className="profile-preview"><div className="profile-preview-head"><div><p className="eyebrow">Behaviour Profile Summary</p><h2>Your investigation, with provenance.</h2></div><Badge variant="outline">Habit Lab {LAB_VERSION}</Badge></div><EvidenceColumns state={state} compact revealPrivate /></div>
    <PromptSection number="01" title="Behavioural agency shift" prompt="Given what you observed, what do you now believe you are capable of doing differently?"><TextField value={agency} onChange={setAgency} rows={5} /></PromptSection>
    <PromptSection number="02" title="One sentence that describes what I can now do" prompt="Describe the capability your evidence has revealed without turning the pattern into an identity label."><TextField value={capability} onChange={setCapability} rows={4} /></PromptSection>
    <PromptSection number="03" title="Letter to my future self" prompt="Write to Future Me about the pattern at the beginning, what seven days taught you, what you are proud of, what still needs work, and one habit you want to keep building."><TextField value={letter} onChange={setLetter} rows={9} placeholder="Dear Future Me,…" /></PromptSection>
    <PromptSection number="04" title="Your journey continues" prompt="What habit would be worth investigating next?"><TextField value={nextPattern} onChange={setNextPattern} /><label className="consent-row memory-confirm"><Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} /><span>Remember my current hypothesis as a pattern I am still investigating. I can retire it later.</span></label></PromptSection>
    <div className="completion-note"><ShieldCheck /><div><strong>This is not a certificate of perfection.</strong><p>It is evidence that you completed and reviewed a behavioural investigation.</p></div></div>
    <StepFooter label="Complete investigation" saving={saving} disabled={!ready} onSave={async () => { const updated = await act({ action: "saveResponses", items: [
      { semanticFieldId: "HAB.AGENCY.REFLECTION", value: agency, investigation: 9 },
      { semanticFieldId: "HAB.I9.CAPABILITY.TEXT", value: capability, investigation: 9 },
      { semanticFieldId: "HAB.I9.FUTURE_LETTER", value: letter, investigation: 9 },
      { semanticFieldId: "HAB.NEXT_PATTERN.TEXT", value: nextPattern, investigation: 9 },
    ] }); if (remember && state.hypothesis) await act({ action: "remember", statement: state.hypothesis.statement, sourceId: state.hypothesis.id }); onView("evidence"); void updated; }} />
  </div>;
}

function EvidenceView({ state, onView }: { state: Snapshot; onView: (view: View) => void }) {
  const evidenceCount = Object.keys(state.responses).length + state.events.length;
  const formulas: Record<string, string> = {
    "HAB.EXPERIMENT.OPPORTUNITY_COUNT": "Count events where eligible opportunity = true",
    "HAB.EXPERIMENT.REPLACEMENT_COUNT": "Count eligible events where alternative used = true",
    "HAB.BEI06": "Alternative used ÷ eligible opportunities × 100; N/A when opportunities = 0",
    "HAB.BEI03": "100 − |predicted adherence − actual adherence|; N/A when adherence is N/A",
  };
  const measureLabels: Record<string, string> = {
    "HAB.EXPERIMENT.OPPORTUNITY_COUNT": "Opportunities observed",
    "HAB.EXPERIMENT.REPLACEMENT_COUNT": "Replacement routine used",
    "HAB.BEI06": "Experiment adherence",
    "HAB.BEI03": "Prediction accuracy",
  };
  return <div className="page-wrap evidence-view"><div className="page-intro"><div><p className="eyebrow">Evidence overview</p><h1>See the shape before the detail.</h1><p>Counts and calculations stay visible here. Your original wording remains closed until you deliberately open it.</p></div><Badge variant="outline"><LockKeyhole /> {evidenceCount} private records</Badge></div><EvidenceColumns state={state} /><details className="surface-card disclosure-section trace-disclosure"><summary><div><p className="eyebrow">Measure → evidence → source</p><h2>How BIS reached each number</h2><p>Open formula versions and linked inputs only when you need the technical trail.</p></div><ChevronRight /></summary><div className="trace-list">{Object.entries(state.measurements).map(([code, measure]) => <details key={code}><summary><span className="provenance-tag calculated">BIS calculated</span><strong>{measureLabels[code] ?? "Registered calculation"}</strong><b>{measure.status === "NA" ? "N/A" : String(measure.value)}</b></summary><div className="trace-body"><dl><div><dt>Formula</dt><dd>{formulas[code] ?? "Registered BIS calculation"}</dd></div><div><dt>Formula version</dt><dd>{measure.formulaVersion}</dd></div><div><dt>Evidence strength</dt><dd>{measure.evidenceStrength === "SUFFICIENT_FOR_LAB" ? "Sufficient for this Lab" : measure.evidenceStrength.toLowerCase().replaceAll("_", " ")}</dd></div><div><dt>Calculated</dt><dd>{new Date(measure.calculatedAt).toLocaleString("en-ZA")}</dd></div></dl><h4>Linked source inputs ({measure.sources.length})</h4>{measure.sources.length === 0 ? <p>No source inputs recorded yet.</p> : <ul>{measure.sources.map((source, index) => <li key={`${source.sourceObjectId}-${source.inputRole}-${index}`}><span>{source.sourceObjectType.toLowerCase().replaceAll("_", " ")}</span><strong>{source.inputRole.toLowerCase().replaceAll("_", " ")}</strong><code>{String(source.inputValue)}</code></li>)}</ul>}</div></details>)}</div></details><details className="surface-card disclosure-section private-records"><summary><div><p className="eyebrow">Private reflections</p><h2>Review my original responses</h2><p>This section contains your wording. It stays closed by default and is covered whenever the privacy screen activates.</p></div><Badge variant="outline">{Object.keys(state.responses).length} responses</Badge></summary><div className="evidence-list">{Object.entries(state.responses).map(([field, item]) => <div key={field}><span className="provenance-tag said">You said</span><div><strong>{fieldLabels[field] ?? "Habit Lab reflection"}</strong><p>{item.status === "PASS" ? "Passed" : String(item.value)}</p></div><time>{new Date(item.recordedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</time></div>)}</div></details><div className="companion-card evidence-companion"><div className="companion-mark"><Bot /></div><div><p className="eyebrow">Ask why</p><h3>Every behavioural statement should be traceable.</h3><p>Ask the Companion to retrieve your cue, evidence or challenge test.</p></div><Button variant="outline" onClick={() => onView("companion")}>Open Companion</Button></div></div>;
}

function EvidenceColumns({ state, compact = false, revealPrivate = false }: { state: Snapshot; compact?: boolean; revealPrivate?: boolean }) {
  const observed = state.events.length;
  const adherence = state.measurements["HAB.BEI06"]?.value;
  const accuracy = state.measurements["HAB.BEI03"]?.value;
  const cards = [
    { type: "said", label: "You said", icon: FileText, title: revealPrivate ? valueOf(state, "HAB.PATTERN.TARGET", "No target pattern yet") : `${Object.keys(state.responses).length} private responses`, detail: revealPrivate ? valueOf(state, "HAB.CUE.TEXT", "Your cue will appear here") : "Original wording is stored and closed below" },
    { type: "observed", label: "You observed", icon: Eye, title: `${observed} experiment day${observed === 1 ? "" : "s"}`, detail: observed ? `${state.events.filter((event) => event.eligibleOpportunity).length} target opportunities recorded` : "No real-world observations yet" },
    { type: "calculated", label: "BIS calculated", icon: Search, title: adherence === null || adherence === undefined ? "Adherence N/A" : `${adherence}% adherence`, detail: accuracy === null || accuracy === undefined ? "Prediction accuracy needs an opportunity" : `${accuracy}/100 prediction accuracy` },
    { type: "hypothesis", label: "Your current hypothesis", icon: Lightbulb, title: revealPrivate ? state.hypothesis?.statement ?? "Not formed yet" : state.hypothesis ? "Working hypothesis stored privately" : "Not formed yet", detail: revealPrivate && state.hypothesis ? `Challenge test: ${state.hypothesis.falsificationStatement}` : state.hypothesis ? "Open your private reflections only when you want the wording on screen" : "Build a working equation in Investigation 5" },
  ];
  return <section className={`provenance-grid ${compact ? "compact" : ""}`}>{cards.map((card) => { const Icon = card.icon; return <article key={card.label} className={`provenance-card ${card.type}`}><div><span className={`provenance-tag ${card.type}`}><Icon />{card.label}</span></div><h3>{card.title}</h3><p>{card.detail}</p></article>; })}</section>;
}

function CompanionView({ state, saving, act }: { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>, replaceSnapshot?: boolean) => Promise<unknown> }) {
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState(state.companionTurns);
  const quick = ["What did I say my cue was?", "What does less obvious reward mean?", "Show me my evidence", "What could challenge my equation?"];
  async function send(text = message) {
    if (!text.trim()) return;
    setTurns((items) => [...items, { id: crypto.randomUUID(), role: "USER", content: text, mode: "USER_MESSAGE", evidenceRefs: "[]" }]);
    setMessage("");
    const result = await act({ action: "companion", message: text }, false) as { reply: string; mode: string; evidenceRefs: string[] };
    setTurns((items) => [...items, { id: crypto.randomUUID(), role: "ASSISTANT", content: result.reply, mode: result.mode, evidenceRefs: JSON.stringify(result.evidenceRefs) }]);
  }
  return <div className="companion-page"><div className="companion-page-head"><div className="companion-mark large"><Bot /></div><div><p className="eyebrow">BIS Companion</p><h1>Think with your evidence.</h1><p>I clarify, retrieve and question. I do not diagnose or decide what your behaviour means.</p></div></div><div className="companion-layout"><section className="surface-card chat-panel"><div className="chat-scroll">{turns.length === 0 && <div className="chat-welcome"><Sparkles /><h2>Where should we look?</h2><p>Ask about evidence already in your investigation, or ask for help understanding the current task.</p></div>}{turns.map((turn) => <div key={turn.id} className={`chat-turn ${turn.role === "USER" ? "user" : "assistant"}`}>{turn.role !== "USER" && <span className="mini-bot"><Bot /></span>}<div><p>{turn.content}</p>{turn.role !== "USER" && turn.evidenceRefs !== "[]" && <small><Search /> Grounded in your evidence</small>}</div></div>)}</div><div className="quick-prompts">{quick.map((prompt) => <button key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div><div className="chat-compose"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about your investigation…" rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><Button size="icon-lg" aria-label="Send message" disabled={saving || !message.trim()} onClick={() => void send()}><ArrowRight /></Button></div></section><aside className="companion-context"><div className="surface-card"><p className="eyebrow">Current context</p><h3>Habit Lab · Investigation {state.enrolment?.currentInvestigation ?? 1}</h3><dl><div><dt>Pattern</dt><dd>{valueOf(state, "HAB.PATTERN.TARGET", "Not named")}</dd></div><div><dt>Cue</dt><dd>{valueOf(state, "HAB.CUE.TEXT", "Not mapped")}</dd></div><div><dt>Evidence</dt><dd>{Object.keys(state.responses).length + state.events.length} records</dd></div></dl></div><div className="companion-boundary"><ShieldCheck /><p>Companion responses remain tentative and tied to your evidence. You can disagree, correct or retire a remembered pattern.</p></div></aside></div></div>;
}

function MemoryView({ state, saving, act }: { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const active = state.memories.filter((memory) => memory.status === "ACTIVE");
  return <div className="page-wrap memory-view"><div className="page-intro"><div><p className="eyebrow">What BIS remembers</p><h1>Inspectable memory, under your control.</h1><p>Only user-stated or user-confirmed items appear here. A system suggestion never silently becomes fact.</p></div><Badge variant="outline"><Brain /> {active.length} active</Badge></div>{active.length === 0 ? <div className="empty-state surface-card"><Brain /><h2>No confirmed behavioural memories yet.</h2><p>When a pattern becomes useful for continuity, BIS will ask before remembering it.</p></div> : <div className="memory-list">{active.map((memory) => <article className="surface-card" key={memory.id}><div><Badge variant="outline">{memory.memoryType.toLowerCase().replaceAll("_", " ")}</Badge><Badge className="confirmed-badge"><Check /> User confirmed</Badge></div><h2>{memory.statement}</h2><dl><div><dt>Source</dt><dd>{memory.sourceType.toLowerCase()}</dd></div><div><dt>Status</dt><dd>{memory.status.toLowerCase()}</dd></div></dl><Button variant="outline" disabled={saving} onClick={() => void act({ action: "retireMemory", memoryId: memory.id })}>Retire memory</Button></article>)}</div>}<div className="memory-policy"><LockKeyhole /><div><h3>Memory is not identity.</h3><p>BIS may remember a pattern you are investigating. It does not turn that pattern into a label about who you are.</p></div></div></div>;
}

function SettingsView({ state, saving, act, onLock }: { state: Snapshot; saving: boolean; act: (payload: Record<string, unknown>) => Promise<unknown>; onLock: () => void }) {
  const [preference, setPreference] = useState(state.notificationPreference);
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const [supportCategory, setSupportCategory] = useState("FACILITATOR_CHECK_IN");
  const [supportNote, setSupportNote] = useState("");
  const reminderOptions = [
    ["experimentStarted", "Experiment started", "Acknowledge when a new evidence window begins"],
    ["dailyObservation", "Daily observation", "Show a reminder when today's evidence has not been recorded"],
    ["dayThreeCheckpoint", "Day 3 checkpoint", "Prompt for calibration after three recorded days"],
    ["experimentEnding", "Experiment ending", "Flag the final two days and completion choices"],
    ["reviewReady", "Review ready", "Show when the experiment is ready for evidence review"],
  ] as const;
  return <div className="page-wrap settings-view"><div className="page-intro"><div><p className="eyebrow">Settings & privacy</p><h1>Your controls, in one place.</h1><p>Configure in-app reminders and manage product consent without changing earlier records.</p></div><Badge variant="outline"><ShieldCheck /> Consent {state.consent?.status.toLowerCase()}</Badge></div><div className="settings-grid"><section className="surface-card settings-card"><div className="section-title"><div><p className="eyebrow">In-app reminders</p><h2>Experiment notifications</h2><p>This pilot does not send push notifications, email or SMS. Reminders appear only inside BIS.</p></div><Bell /></div><label className="preference-row master"><Checkbox checked={preference.enabled} onCheckedChange={(checked) => setPreference({ ...preference, enabled: checked === true })} /><span><strong>Enable experiment reminders</strong><small>Turn all in-app reminders on or off</small></span></label><div className={preference.enabled ? "preference-list" : "preference-list disabled"}>{reminderOptions.map(([key, title, detail]) => <label className="preference-row" key={key}><Checkbox disabled={!preference.enabled} checked={preference[key]} onCheckedChange={(checked) => setPreference({ ...preference, [key]: checked === true })} /><span><strong>{title}</strong><small>{detail}</small></span></label>)}</div><div className="reminder-schedule"><label>Reminder time<Input type="time" value={preference.reminderTime} disabled={!preference.enabled} onChange={(event) => setPreference({ ...preference, reminderTime: event.target.value })} /></label><label>Timezone<Input value={preference.timezone} disabled readOnly /></label></div><Button disabled={saving} onClick={() => void act({ action: "updateNotificationPreferences", ...preference })}>{saving ? "Saving…" : "Save reminder settings"}</Button></section><section className="surface-card settings-card privacy-card"><div className="section-title"><div><p className="eyebrow">Privacy control</p><h2>Cover or pause your investigation</h2><p>The privacy screen hides personal content immediately. Pausing consent separately stops new investigation activity.</p></div><LockKeyhole /></div><dl><div><dt>Signed-in account</dt><dd>{state.identity.email}</dd></div><div><dt>Habit Lab experience</dt><dd>Version {state.experienceVersion}</dd></div><div><dt>Session privacy</dt><dd>Auto-hide after 2 minutes</dd></div><div><dt>Product consent</dt><dd>{state.consent?.status.toLowerCase()}</dd></div><div><dt>Policy version</dt><dd>{state.consent?.policyVersion}</dd></div><div><dt>Current sharing</dt><dd>Private Site access only</dd></div></dl><Button className="privacy-now" onClick={onLock}><EyeOff /> Hide private content now</Button><label className="consent-row"><Checkbox checked={confirmWithdrawal} onCheckedChange={(checked) => setConfirmWithdrawal(checked === true)} /><span>I understand that new responses, experiment events and Companion turns will pause until I restore consent.</span></label><Button variant="outline" disabled={saving || !confirmWithdrawal} onClick={() => void act({ action: "withdrawConsent" })}>Pause consent and investigation</Button></section><section className="surface-card settings-card support-card"><div className="section-title"><div><p className="eyebrow">Human support</p><h2>Ask for a private follow-up</h2><p>Your request goes to the restricted safeguarding queue. BIS does not diagnose you or assign an automated risk score.</p></div><LifeBuoy /></div><div className="support-layout"><div className="ops-form-stack"><label>What kind of support?<Select value={supportCategory} onValueChange={setSupportCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FACILITATOR_CHECK_IN">Facilitator check-in</SelectItem><SelectItem value="SAFETY_CONCERN">Safety concern</SelectItem><SelectItem value="PRIVACY_QUESTION">Privacy question</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></label><label>Optional note<Textarea value={supportNote} onChange={(event) => setSupportNote(event.target.value)} maxLength={800} placeholder="Share only what you want the safeguarding officer to receive…" /></label><Button disabled={saving} onClick={async () => { const result = await act({ action: "requestSupport", category: supportCategory, note: supportNote }); if (result) setSupportNote(""); }}>Request human follow-up</Button><small className="support-warning">BIS is not an emergency service. If there is immediate danger, contact local emergency services or a trusted person now.</small></div><div className="support-status-list"><strong>Your requests</strong>{state.supportRequests.length === 0 ? <p>No support requests yet.</p> : state.supportRequests.map((request) => <div key={request.id}><span><b>{request.category.toLowerCase().replaceAll("_", " ")}</b><small>Opened {new Date(request.openedAt).toLocaleDateString("en-ZA")}</small></span><Badge variant="outline">{request.status.toLowerCase().replaceAll("_", " ")}</Badge></div>)}</div></div></section></div></div>;
}

function PromptSection({ number, title, prompt, children }: { number: string; title: string; prompt: string; children: React.ReactNode }) {
  return <section className="prompt-section"><div className="prompt-number">{number}</div><div className="prompt-body"><h2>{title}</h2><p>{prompt}</p><div className="prompt-controls">{children}</div></div></section>;
}

function TextField({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return <Textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} placeholder={placeholder ?? "Write what you actually notice…"} />;
}

function ScaleField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <div className="scale-field"><div><span>{label}</span><strong>{value} / {max}</strong></div><Slider value={[value]} min={1} max={max} step={1} onValueChange={([next]) => onChange(next)} /></div>;
}

function PauseCard({ question }: { question: string }) {
  return <div className="pause-card"><span>Pause</span><div><strong>Take 30 seconds.</strong><p>{question}</p></div></div>;
}

function StepFooter({ saving, disabled, onSave, label = "Save and continue" }: { saving: boolean; disabled: boolean; onSave: () => Promise<void>; label?: string }) {
  return <div className="step-footer"><span><ShieldCheck /> Your work saves with provenance.</span><Button size="lg" disabled={saving || disabled} onClick={() => void onSave()}>{saving ? "Saving…" : label} {!saving && <ArrowRight />}</Button></div>;
}
