"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness, Check, GraduationCap, LockKeyhole, Menu, ShieldCheck, Sparkles, X } from "lucide-react";

type EditionKey = "school" | "emerging" | "workplace";
type Block =
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "banner"; text: string }
  | { type: "table"; rows: string[][] };
type Group = { label: string; blocks: Block[] };
type Section = { id: string; title: string; part: "front" | "A" | "B"; lockedByPhaseA: boolean; groups: Group[] };
type LearningDocument = {
  module: string;
  series: string;
  volume: string;
  editionKey: EditionKey;
  edition: string;
  ageBand: string;
  version: string;
  release: string;
  audience: string;
  privacySummary: string;
  sourceFile: string;
  contentSha256: string;
  sections: Section[];
};
type Snapshot = {
  profile?: { displayName?: string; ageBand?: string; mode?: string } | null;
  roles?: string[];
  enrolment?: { currentInvestigation?: number; status?: string } | null;
  experiment?: { id?: string; status?: string } | null;
};

type EditionConfig = {
  label: string;
  short: string;
  age: string;
  accent: string;
  soft: string;
  ink: string;
  hero: string;
  descriptor: string;
  privacy: string;
  icon: typeof GraduationCap;
};

const editions: Record<EditionKey, EditionConfig> = {
  school: {
    label: "School Edition",
    short: "School",
    age: "Ages 14–18",
    accent: "#0f6b5b",
    soft: "#e6f1ed",
    ink: "#173e36",
    icon: GraduationCap,
    hero: "Learn to see the pattern before you try to change it.",
    descriptor: "A guided learner journey that moves from noticing and evidence literacy into a real Habit Lab investigation.",
    privacy: "You control what you share with peers. Facilitator access is limited to what is needed to support learning.",
  },
  emerging: {
    label: "Emerging Adult Edition",
    short: "Emerging Adult",
    age: "Ages 18–25",
    accent: "#4954b8",
    soft: "#eceefe",
    ink: "#303a89",
    icon: Sparkles,
    hero: "Turn self-awareness into evidence you can act on.",
    descriptor: "A transition-stage learning journey for work, study, independence and everyday decision-making.",
    privacy: "Private reflections are not automatically shared with peers, employers, or programme administrators.",
  },
  workplace: {
    label: "Workplace Edition",
    short: "Workplace",
    age: "Ages 25+",
    accent: "#9a6726",
    soft: "#f7efe2",
    ink: "#64431d",
    icon: BriefcaseBusiness,
    hero: "Investigate a working-life pattern without turning it into a performance judgement.",
    descriptor: "A confidential professional learning journey that separates individual evidence from organisational reporting.",
    privacy: "Individual behavioural evidence is not shared with managers, HR, or employers. Organisational reporting is aggregated at cohort level.",
  },
};

function classificationFromAgeBand(ageBand?: string | null): EditionKey {
  if (ageBand === "18-21" || ageBand === "22-25") return "emerging";
  if (ageBand === "26+") return "workplace";
  return "school";
}

function progressKey(edition: EditionKey) {
  return `bis-learning-progress:${edition}:habit-1.4`;
}

function readProgress(edition: EditionKey): string[] {
  try { return JSON.parse(localStorage.getItem(progressKey(edition)) || "[]") as string[]; }
  catch { return []; }
}

async function gunzip(stream: ReadableStream<Uint8Array>): Promise<LearningDocument> {
  if (!("DecompressionStream" in globalThis)) throw new Error("This browser cannot open the compressed learning material.");
  const decoded = stream.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(decoded).text()) as LearningDocument;
}

async function loadDocument(edition: EditionKey): Promise<LearningDocument> {
  if (edition === "school") {
    const response = await fetch("/learning/habit-school.json.gz", { cache: "force-cache" });
    if (!response.ok || !response.body) throw new Error("Learning material could not be loaded.");
    return gunzip(response.body);
  }

  const response = await fetch(`/learning/habit-${edition}.json.gz.b64`, { cache: "force-cache" });
  if (!response.ok) throw new Error("Learning material could not be loaded.");
  const binary = atob((await response.text()).trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const stream = new Blob([bytes.buffer]).stream();
  return gunzip(stream);
}

export function LearningPortal() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [edition, setEdition] = useState<EditionKey>("school");
  const [document, setDocument] = useState<LearningDocument | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      let nextEdition: EditionKey = "school";
      try {
        const params = new URLSearchParams(window.location.search);
        const response = await fetch("../api/bis", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as Snapshot;
          if (!cancelled) setSnapshot(data);
          nextEdition = classificationFromAgeBand(data.profile?.ageBand);
          const preview = params.get("edition");
          if (data.roles?.includes("SYSTEM_ADMIN") && (preview === "school" || preview === "emerging" || preview === "workplace")) nextEdition = preview;
        } else {
          const preview = params.get("edition");
          if (preview === "school" || preview === "emerging" || preview === "workplace") nextEdition = preview;
        }
      } catch {
        const preview = new URLSearchParams(window.location.search).get("edition");
        if (preview === "school" || preview === "emerging" || preview === "workplace") nextEdition = preview;
      }
      if (!cancelled) setEdition(nextEdition);
    }
    void boot();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDocument(null);
    setSelectedId(null);
    setReaderOpen(false);
    void loadDocument(edition)
      .then((data) => {
        if (cancelled) return;
        setDocument(data);
        setCompleted(readProgress(edition));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Learning material could not be loaded.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [edition]);

  const config = editions[edition];
  const phaseAComplete = Boolean(snapshot?.experiment);
  const availableSections = useMemo(() => document?.sections.filter((section) => !section.lockedByPhaseA || phaseAComplete) ?? [], [document, phaseAComplete]);
  const nextSection = availableSections.find((section) => !completed.includes(section.id)) ?? availableSections[0];
  const progress = availableSections.length ? Math.round((completed.filter((id) => availableSections.some((section) => section.id === id)).length / availableSections.length) * 100) : 0;
  const selected = document?.sections.find((section) => section.id === selectedId) ?? null;
  const isAdmin = snapshot?.roles?.includes("SYSTEM_ADMIN") ?? false;
  const displayName = snapshot?.profile?.displayName?.split(" ")[0] || "Investigator";
  const style = { "--learn-accent": config.accent, "--learn-soft": config.soft, "--learn-ink": config.ink } as CSSProperties;

  function chooseEdition(next: EditionKey) {
    setEdition(next);
    const url = new URL(window.location.href);
    url.searchParams.set("edition", next);
    window.history.replaceState(null, "", url);
  }

  function openSection(section: Section) {
    if (section.lockedByPhaseA && !phaseAComplete) return;
    setSelectedId(section.id);
    setReaderOpen(true);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markComplete(section: Section) {
    const nextCompleted = Array.from(new Set([...completed, section.id]));
    setCompleted(nextCompleted);
    localStorage.setItem(progressKey(edition), JSON.stringify(nextCompleted));
    const index = availableSections.findIndex((candidate) => candidate.id === section.id);
    const following = availableSections[index + 1];
    if (following) openSection(following); else setReaderOpen(false);
  }

  if (loading) return <main className="min-h-screen bg-[#f5f3ee] grid place-items-center px-6"><div className="text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#173f35] text-white font-semibold">BIS</div><h1 className="mt-5 text-2xl font-semibold">Opening your learning journey…</h1><p className="mt-2 text-sm text-neutral-500">Loading the classification-specific Habit Lab material.</p></div></main>;
  if (!document || error) return <main className="min-h-screen bg-[#f5f3ee] grid place-items-center px-6"><div className="max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm"><LockKeyhole className="mx-auto size-9 text-neutral-600"/><h1 className="mt-4 text-2xl font-semibold">Learning material could not open</h1><p className="mt-3 text-sm leading-6 text-neutral-500">{error || "Try refreshing the page."}</p></div></main>;

  return (
    <div style={style} className="min-h-screen bg-[#f5f3ee] text-[#18201d]">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-black/10 bg-[#faf9f5]/95 px-4 backdrop-blur md:px-7">
        <div className="flex items-center gap-3"><button className="rounded-xl p-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu className="size-5"/></button><Link href="../" className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#173f35] text-[11px] font-bold tracking-[0.12em] text-white">BIS</span><span><strong className="block text-sm leading-none">Behaviour Intelligence</strong><small className="mt-1 block text-[10px] text-neutral-500">Learning Portal</small></span></Link></div>
        <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="hidden sm:inline">{document.version}</span><span className="rounded-full bg-white px-3 py-1.5 shadow-sm">{config.short}</span></div>
      </header>

      {menuOpen && <button className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation"/>}
      <aside className={`fixed inset-y-0 left-0 z-[60] w-[280px] border-r border-black/10 bg-[#faf9f5] p-5 transition-transform lg:top-16 lg:z-30 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between lg:hidden"><strong>Learning</strong><button className="rounded-lg p-2" onClick={() => setMenuOpen(false)}><X className="size-5"/></button></div>
        <div className="mt-5 rounded-2xl p-4 text-white lg:mt-0" style={{ background: config.accent }}><config.icon className="size-5"/><p className="mt-4 text-[10px] uppercase tracking-[0.12em] text-white/65">Current classification</p><strong className="mt-1 block text-lg">{config.label}</strong><small className="text-white/70">{config.age}</small></div>
        {isAdmin && <div className="mt-5"><p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Classification preview</p><div className="mt-2 grid gap-1">{(Object.keys(editions) as EditionKey[]).map((key) => <button key={key} onClick={() => chooseEdition(key)} className={`rounded-xl px-3 py-2.5 text-left text-xs ${edition === key ? "bg-white font-semibold shadow-sm" : "text-neutral-500 hover:bg-black/5"}`}>{editions[key].label}</button>)}</div></div>}
        <div className="mt-6"><p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Journey</p><div className="mt-3 grid gap-2 text-xs"><Journey number="1" label="Learn" state={phaseAComplete ? "done" : "active"}/><Journey number="2" label="Investigate" state={phaseAComplete ? "done" : "next"}/><Journey number="3" label="Experiment" state={phaseAComplete ? "active" : "locked"}/><Journey number="4" label="Review" state="locked"/></div></div>
        <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-black/10 bg-white p-3 text-[10px] leading-5 text-neutral-500"><ShieldCheck className="mb-2 size-4" style={{ color: config.accent }}/>Reader progress and private learning notes are separate from formal BIS evidence.</div>
      </aside>

      <main className="lg:ml-[280px]">
        {!readerOpen ? (
          <Dashboard config={config} document={document} displayName={displayName} progress={progress} completedCount={completed.length} availableCount={availableSections.length} nextSection={nextSection} phaseAComplete={phaseAComplete} currentInvestigation={snapshot?.enrolment?.currentInvestigation ?? 0} onOpen={openSection}/>
        ) : selected ? (
          <Reader config={config} document={document} section={selected} phaseAComplete={phaseAComplete} completed={completed} onBack={() => setReaderOpen(false)} onSelect={openSection} onComplete={markComplete}/>
        ) : null}
      </main>
    </div>
  );
}

function Journey({ number, label, state }: { number: string; label: string; state: "done" | "active" | "next" | "locked" }) {
  return <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${state === "active" ? "bg-white shadow-sm" : ""}`}><span className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${state === "done" || state === "active" ? "bg-[var(--learn-accent)] text-white" : "bg-black/5 text-neutral-400"}`}>{state === "done" ? <Check className="size-3"/> : state === "locked" ? <LockKeyhole className="size-3"/> : number}</span><span className={state === "locked" ? "text-neutral-400" : ""}>{label}</span></div>;
}

function Dashboard({ config, document, displayName, progress, completedCount, availableCount, nextSection, phaseAComplete, currentInvestigation, onOpen }: { config: EditionConfig; document: LearningDocument; displayName: string; progress: number; completedCount: number; availableCount: number; nextSection?: Section; phaseAComplete: boolean; currentInvestigation: number; onOpen: (section: Section) => void }) {
  const partA = document.sections.filter((section) => section.part !== "B");
  const partB = document.sections.filter((section) => section.part === "B");
  const readiness = partA.find((section) => section.title.includes("Before the Investigation"));
  return <div className="mx-auto w-full max-w-[1180px] px-5 py-10 md:px-9 md:py-14">
    <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{document.series}</p><h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-6xl">Welcome back, {displayName}.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">{config.hero}</p></div><div className="flex min-w-[190px] items-center gap-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><div className="grid size-14 place-items-center rounded-full text-sm font-bold" style={{ background: `conic-gradient(${config.accent} ${progress * 3.6}deg,#ece9e2 0deg)` }}><span className="grid size-11 place-items-center rounded-full bg-white">{progress}%</span></div><div><small className="text-neutral-500">Reader progress</small><strong className="mt-1 block">{completedCount} / {availableCount}</strong></div></div></div>
    <section className="relative mt-9 overflow-hidden rounded-[30px] p-7 text-white shadow-xl md:p-10" style={{ background: config.accent }}><div className="relative z-10 max-w-3xl"><div className="flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65"><span>{document.module}</span><span>•</span><span>{config.label}</span><span>•</span><span>{config.age}</span></div><h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] md:text-5xl">{config.descriptor}</h2><p className="mt-5 max-w-2xl text-sm leading-6 text-white/75">{phaseAComplete ? "Phase A is complete. Part B is now available and travels with your seven-day experiment." : "Part A prepares the investigation. At the readiness point, BIS hands you into Phase A. Part B remains locked until an experiment record exists."}</p><div className="mt-7 flex flex-wrap gap-2">{nextSection && <button onClick={() => onOpen(nextSection)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[var(--learn-ink)]">Continue learning <ArrowRight className="size-4"/></button>}<Link href="../" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white">Open Habit Lab <ArrowRight className="size-4"/></Link></div></div><config.icon className="absolute -bottom-16 -right-10 size-64 text-white/10"/></section>
    <section className="mt-10"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Your journey</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">Learning and Lab work move together.</h2></div><span className="hidden text-xs text-neutral-500 md:block">Investigation {currentInvestigation || 0} of 9</span></div><div className="mt-5 grid gap-3 md:grid-cols-4"><JourneyCard status="active" step="01" title="Learn" copy={`${partA.length} Part A sections`}/><JourneyCard status={phaseAComplete ? "done" : "next"} step="02" title="Investigate" copy="Phase A · Habit Lab"/><JourneyCard status={phaseAComplete ? "active" : "locked"} step="03" title="Experiment" copy={phaseAComplete ? `${partB.length} Part B sections unlocked` : "Unlocks after Phase A"}/><JourneyCard status="locked" step="04" title="Review" copy="Evidence review after seven days"/></div></section>
    <section className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_.75fr]"><div className="rounded-3xl border border-black/10 bg-white p-6 md:p-8"><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: config.accent }}>Next learning action</p><h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{nextSection?.title || "Reader complete"}</h3><p className="mt-3 text-sm leading-6 text-neutral-600">{nextSection?.part === "B" ? "Use this section alongside your real-world experiment." : "Continue the Investigation Reader. Your learning prepares the evidence work that follows."}</p>{nextSection && <button onClick={() => onOpen(nextSection)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: config.accent }}>Open reader <ArrowRight className="size-4"/></button>}</div><div className="rounded-3xl p-6 md:p-8" style={{ background: config.soft }}><ShieldCheck className="size-6" style={{ color: config.accent }}/><h3 className="mt-4 text-xl font-semibold">Privacy for this classification</h3><p className="mt-3 text-sm leading-6 text-neutral-600">{config.privacy}</p></div></section>
    {readiness && !phaseAComplete && <section className="mt-4 rounded-3xl border border-black/10 bg-[#ebe7da] p-6 md:p-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Day 3 bridge</p><h3 className="mt-2 text-xl font-semibold">Readiness comes before formal habit language.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">The learner finishes Part A, enters the existing Habit Lab investigation, and returns to Part B only after Phase A has produced an experiment.</p></div><button onClick={() => onOpen(readiness)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-semibold text-white">Open readiness <ArrowRight className="size-4"/></button></div></section>}
  </div>;
}

function JourneyCard({ status, step, title, copy }: { status: "active" | "done" | "next" | "locked"; step: string; title: string; copy: string }) {
  return <div className={`rounded-2xl border p-5 ${status === "active" ? "border-[var(--learn-accent)] bg-white shadow-sm" : status === "done" ? "border-black/10 bg-white" : "border-black/10 bg-[#faf9f5]"}`}><div className="flex items-center justify-between"><span className={`grid size-8 place-items-center rounded-full text-[10px] font-bold ${status === "active" || status === "done" ? "bg-[var(--learn-accent)] text-white" : "bg-black/5 text-neutral-400"}`}>{status === "done" ? <Check className="size-4"/> : status === "locked" ? <LockKeyhole className="size-3.5"/> : step}</span>{status === "next" && <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">Next</span>}</div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-neutral-500">{copy}</p></div>;
}

function Reader({ config, document, section, phaseAComplete, completed, onBack, onSelect, onComplete }: { config: EditionConfig; document: LearningDocument; section: Section; phaseAComplete: boolean; completed: string[]; onBack: () => void; onSelect: (section: Section) => void; onComplete: (section: Section) => void }) {
  const available = document.sections.filter((candidate) => !candidate.lockedByPhaseA || phaseAComplete);
  const index = available.findIndex((candidate) => candidate.id === section.id);
  const readiness = section.title.includes("Before the Investigation");
  return <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[280px_minmax(0,1fr)]"><aside className="hidden border-r border-black/10 bg-[#faf9f5] p-5 lg:block"><button onClick={onBack} className="flex items-center gap-2 text-xs font-semibold text-neutral-500"><ArrowLeft className="size-4"/> Dashboard</button><div className="mt-6 max-h-[calc(100vh-150px)] space-y-1 overflow-y-auto pr-1">{document.sections.map((candidate) => { const locked = candidate.lockedByPhaseA && !phaseAComplete; return <button key={candidate.id} disabled={locked} onClick={() => onSelect(candidate)} className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-xs leading-5 ${candidate.id === section.id ? "bg-white font-semibold shadow-sm" : locked ? "cursor-not-allowed text-neutral-300" : "text-neutral-600 hover:bg-white/70"}`}><span className="mt-1">{completed.includes(candidate.id) ? <Check className="size-3.5" style={{ color: config.accent }}/> : locked ? <LockKeyhole className="size-3.5"/> : <span className="block size-3 rounded-full border border-black/20"/>}</span><span><small className="block text-[9px] uppercase tracking-[0.09em] text-neutral-400">{candidate.part === "B" ? "Part B" : candidate.part === "A" ? "Part A" : "Start"}</small>{candidate.title}</span></button>; })}</div></aside><article className="mx-auto w-full max-w-[850px] px-5 py-8 md:px-10 md:py-12"><div className="flex items-center justify-between border-b border-black/10 pb-5"><button onClick={onBack} className="flex items-center gap-2 text-xs font-semibold text-neutral-500 lg:hidden"><ArrowLeft className="size-4"/> Dashboard</button><span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-neutral-400">{section.part === "B" ? "Part B · Pattern & Experiment Reader" : section.part === "A" ? "Part A · Investigation Reader" : config.label}</span><span className="text-[10px] text-neutral-400">{Math.max(index + 1, 1)} / {available.length}</span></div><h1 className="mt-8 text-4xl font-semibold tracking-[-0.045em] md:text-5xl">{section.title}</h1><div className="mt-8 space-y-6">{section.groups.map((group, groupIndex) => <ContentGroup key={`${group.label}-${groupIndex}`} group={group} accent={config.accent} soft={config.soft}/>)}</div>{readiness && <div className="mt-9 rounded-3xl p-7 text-white" style={{ background: config.accent }}><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/60">Learning → Investigation</p><h2 className="mt-3 text-2xl font-semibold">You are ready to enter Phase A.</h2><p className="mt-3 text-sm leading-6 text-white/75">The next step is the existing Habit Lab. Part B stays locked until BIS has an experiment record from Phase A.</p><Link href="../" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[var(--learn-ink)]">Begin Habit Lab <ArrowRight className="size-4"/></Link></div>}<div className="mt-10 flex flex-col-reverse justify-between gap-3 border-t border-black/10 pt-6 sm:flex-row"><button onClick={onBack} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold"><ArrowLeft className="size-4"/> Leave reader</button><button onClick={() => onComplete(section)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: config.accent }}>{completed.includes(section.id) ? "Continue" : "Mark complete & continue"}<ArrowRight className="size-4"/></button></div></article></div>;
}

function ContentGroup({ group, accent, soft }: { group: Group; accent: string; soft: string }) {
  const dark = group.label === "Big Idea";
  const callout = dark || group.label === "Why This Matters" || group.label === "Evidence Connection" || group.label === "Common Mistake";
  return <section className={callout ? "rounded-2xl p-5 md:p-6" : ""} style={callout ? { background: dark ? accent : soft, color: dark ? "white" : undefined } : undefined}>{group.label !== "Overview" && <h2 className={`mb-4 text-[11px] font-bold uppercase tracking-[0.13em] ${dark ? "text-white/65" : "text-neutral-500"}`}>{group.label}</h2>}<div className="space-y-4">{group.blocks.map((block, index) => <ContentBlock key={index} block={block} dark={dark}/>)}</div></section>;
}

function ContentBlock({ block, dark }: { block: Block; dark: boolean }) {
  if (block.type === "paragraph") return <p className={`text-[15px] leading-7 ${dark ? "text-white/90" : "text-[#3f4a45]"}`}>{block.text}</p>;
  if (block.type === "bullet") return <div className="flex gap-3 text-sm leading-7"><span className="mt-[11px] block size-1.5 shrink-0 rounded-full bg-[var(--learn-accent)]"/><span>{block.text}</span></div>;
  if (block.type === "banner") return <div className={`border-y py-5 text-lg font-semibold ${dark ? "border-white/20" : "border-black/10"}`}>{block.text}</div>;
  const columns = Math.max(...block.rows.map((row) => row.length), 1);
  return <div className="overflow-x-auto rounded-xl border border-black/10 bg-white text-[#18201d]"><table className="w-full min-w-[520px] border-collapse text-left text-xs"><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex === 0 ? "bg-[#f0ede6] font-semibold" : "border-t border-black/10"}>{Array.from({ length: columns }).map((_, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-top leading-5">{row[cellIndex] || ""}</td>)}</tr>)}</tbody></table></div>;
}
