"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, Circle, FlaskConical, LockKeyhole, Menu, NotebookPen, ShieldCheck, X } from "lucide-react";
import type { HabitProgramme, ProgrammePage } from "../../lib/programme-handbook";

type Edition = HabitProgramme["edition"];
type Progress = { labCode: string; contentReleaseId: string; semanticStepId: string; status: "STARTED" | "COMPLETED"; lastSeenAt: string };
type LearningSnapshot = {
  profile: { displayName: string; deliveryEdition: Edition; deliveryContext: string; language: string; timezone: string };
  releases: Array<{ id: string; labCode: string; contentVersion: string; status: string }>;
  progress: Progress[];
  workbookResponses: Record<string, { value: string; semanticStepId: string; sourceFieldKey: string; updatedAt: string }>;
};
type Runtime = {
  enrolment: null | { currentInvestigation: number; status: string; phaseACompletedAt?: string | null; experimentStartedAt?: string | null };
  hypothesis: null | { statement: string; falsificationStatement: string; learnerConfidence: number };
  experiment: null | { id: string; status: string; targetPattern: string; targetCondition: string; alternativeBehaviour: string; predictedValue: number; startDate: string; plannedEndDate: string };
  events: Array<{ dayNumber: number; eligibleOpportunity: boolean; alternativeUsed: boolean | null }>;
  measurements: Record<string, { value: unknown; status: string; evidenceStrength: string }>;
};
type Panel = "learn" | "experiment" | "investigation" | "progress";

const pageNumber = (page: ProgrammePage) => page.key === "Welcome" ? "00" : page.key === "Weekend" ? "W" : page.key === "Certificate" ? "✓" : String(page.programmeDay ?? "").padStart(2, "0");
const currentExperimentDay = (experiment: Runtime["experiment"]) => {
  if (!experiment) return null;
  const start = new Date(`${experiment.startDate}T00:00:00.000Z`).getTime();
  const now = new Date();
  return Math.max(1, Math.min(7, Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start) / 86_400_000) + 1));
};

function splitDayThree(page: ProgrammePage) {
  if (!page.labHandoff) return null;
  const start = page.html.indexOf(page.labHandoff.startMarker);
  const end = page.html.indexOf(page.labHandoff.endMarker, Math.max(0, start));
  return start < 0 || end < 0 ? null : { intro: page.html.slice(0, start), reference: page.html.slice(start, end), tail: page.html.slice(end) };
}

async function loadProgramme(edition: Edition): Promise<HabitProgramme> {
  const response = await fetch(`/programmes/habit-${edition}.json.gz.b64`, { cache: "force-cache" });
  if (!response.ok) throw new Error("The complete Habit programme material could not be loaded.");
  if (!("DecompressionStream" in globalThis)) throw new Error("This browser cannot open the compressed programme material.");
  const binary = atob((await response.text()).trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const stream = new Blob([bytes.buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as HabitProgramme;
}

export function ProgrammePlayer() {
  const [snapshot, setSnapshot] = useState<LearningSnapshot | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [programme, setProgramme] = useState<HabitProgramme | null>(null);
  const [selected, setSelected] = useState(0);
  const [panel, setPanel] = useState<Panel>("learn");
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dirty = useRef(new Set<string>());
  const documentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [learningResponse, runtimeResponse] = await Promise.all([
          fetch("/api/learning", { cache: "no-store", signal: controller.signal }),
          fetch("/api/bis", { cache: "no-store", signal: controller.signal }),
        ]);
        const learning = await learningResponse.json() as LearningSnapshot & { error?: string };
        const live = await runtimeResponse.json() as Runtime & { error?: string };
        if (!learningResponse.ok) throw new Error(learning.error || "Your learning record could not be loaded.");
        if (!runtimeResponse.ok) throw new Error(live.error || "Your Habit Lab record could not be loaded.");
        const loaded = await loadProgramme(learning.profile.deliveryEdition);
        if (controller.signal.aborted) return;
        setSnapshot(learning); setRuntime(live); setProgramme(loaded);
        setDrafts(Object.fromEntries(Object.entries(learning.workbookResponses ?? {}).map(([id, row]) => [id, row.value ?? ""])));
        const latest = learning.progress.find((item) => item.labCode === "HAB");
        const index = latest ? loaded.treatment.pages.findIndex((page) => page.id === latest.semanticStepId) : -1;
        if (index >= 0) setSelected(index);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The programme could not be opened.");
      }
    })();
    return () => controller.abort();
  }, []);

  const release = snapshot?.releases.find((item) => item.labCode === "HAB");
  const page = programme?.treatment.pages[selected];
  const completed = useMemo(() => new Set(snapshot?.progress.filter((item) => item.labCode === "HAB" && item.status === "COMPLETED" && (!release || item.contentReleaseId === release.id)).map((item) => item.semanticStepId) ?? []), [snapshot, release]);
  const experimentDay = currentExperimentDay(runtime?.experiment ?? null);
  const phaseAComplete = Boolean(runtime?.enrolment?.phaseACompletedAt || runtime?.experiment);
  const progressPercent = programme ? Math.round(programme.treatment.pages.filter((item) => completed.has(item.id)).length / programme.treatment.pages.length * 100) : 0;

  const mergeSnapshot = useCallback((data: LearningSnapshot) => {
    setSnapshot(data);
    setDrafts((current) => ({ ...Object.fromEntries(Object.entries(data.workbookResponses ?? {}).map(([id, row]) => [id, row.value ?? ""])), ...current }));
  }, []);

  const saveDirtyResponses = useCallback(async () => {
    if (!snapshot || !page || !release || dirty.current.size === 0 || saving) return;
    const elements = [...(documentRef.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-field-id]") ?? [])];
    const ids = [...dirty.current];
    const items = ids.flatMap((id) => {
      const field = elements.find((candidate) => candidate.dataset.fieldId === id);
      return !field || field.dataset.purpose !== "LEARNING_RESPONSE" || !field.dataset.sourceKey ? [] : [{ semanticFieldId: id, sourceFieldKey: field.dataset.sourceKey, semanticStepId: page.id, value: drafts[id] ?? "" }];
    });
    if (!items.length) { dirty.current.clear(); setSaveState("saved"); return; }
    setSaving(true); setSaveState("saving"); setError("");
    try {
      const response = await fetch("/api/learning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "saveWorkbookResponses", labCode: "HAB", contentReleaseId: release.id, items }) });
      const data = await response.json() as LearningSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error || "Your workbook responses could not be saved.");
      ids.forEach((id) => dirty.current.delete(id)); mergeSnapshot(data); setSaveState("saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your workbook responses could not be saved."); setSaveState("dirty"); }
    finally { setSaving(false); }
  }, [drafts, mergeSnapshot, page, release, saving, snapshot]);

  useEffect(() => {
    if (!page || !release || completed.has(page.id)) return;
    const controller = new AbortController();
    void fetch("/api/learning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "saveProgress", labCode: "HAB", contentReleaseId: release.id, semanticStepId: page.id, status: "STARTED" }), signal: controller.signal }).catch(() => undefined);
    return () => controller.abort();
  }, [page, release, completed]);

  useEffect(() => {
    if (!page || panel !== "learn") return;
    const frame = requestAnimationFrame(() => documentRef.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-field-id]").forEach((field) => {
      const id = field.dataset.fieldId;
      if (!id) return;
      field.value = drafts[id] ?? snapshot?.workbookResponses?.[id]?.value ?? "";
      if (field.dataset.purpose === "FORMAL_LAB_REFERENCE") { field.disabled = true; field.placeholder = "Captured in the live Habit Lab"; }
    }));
    return () => cancelAnimationFrame(frame);
  }, [drafts, page, panel, snapshot?.workbookResponses]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(() => void saveDirtyResponses(), 900);
    return () => clearTimeout(timer);
  }, [saveDirtyResponses, saveState]);

  function onDocumentInput(event: FormEvent<HTMLElement>) {
    const target = event.target as HTMLTextAreaElement;
    if (!(target instanceof HTMLTextAreaElement) || !target.dataset.fieldId || target.dataset.purpose === "FORMAL_LAB_REFERENCE") return;
    dirty.current.add(target.dataset.fieldId); setDrafts((current) => ({ ...current, [target.dataset.fieldId!]: target.value })); setSaveState("dirty");
  }

  async function completePage() {
    if (!page || !release || saving) return;
    if (page.key === "Day 3" && !phaseAComplete) { setError("Complete Habit Lab Phase A before marking Programme Day 3 complete."); return; }
    await saveDirtyResponses(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/learning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "saveProgress", labCode: "HAB", contentReleaseId: release.id, semanticStepId: page.id, status: "COMPLETED" }) });
      const data = await response.json() as LearningSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error || "Programme progress could not be saved.");
      mergeSnapshot(data);
      if (programme && selected < programme.treatment.pages.length - 1) { setSelected((value) => value + 1); setPanel("learn"); window.scrollTo({ top: 0, behavior: "smooth" }); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Programme progress could not be saved."); }
    finally { setSaving(false); }
  }

  if (error && !programme) return <main className="learning-state"><LockKeyhole/><h1>Programme unavailable</h1><p>{error}</p><Link href="/learning">Return to Volume 1</Link></main>;
  if (!snapshot || !programme || !page || !runtime) return <main className="learning-state"><span className="learning-loader"/><h1>Opening Habit Lab™ programme…</h1><p>Loading your edition, handbook, experiment and workbook record.</p></main>;
  const dayThree = page.key === "Day 3" ? splitDayThree(page) : null;

  return <div className="programme-shell">
    <header className="programme-header"><button onClick={() => setMenuOpen(true)} className="programme-menu" aria-label="Open programme navigation"><Menu/></button><Link href="/learning" className="programme-brand"><span>BIS</span><div><strong>{programme.title}</strong><small>{programme.treatment.label}</small></div></Link><div className="programme-clocks"><span>{page.programmeDay ? `Programme Day ${page.programmeDay} of 10` : page.key}</span>{runtime.experiment?.status === "ACTIVE" && experimentDay && <strong>Experiment Day {experimentDay} of 7</strong>}</div></header>
    <div className="programme-meter"><i style={{ width: `${progressPercent}%` }}/><span>{progressPercent}% programme reviewed</span></div>
    {menuOpen && <button className="programme-scrim" onClick={() => setMenuOpen(false)} aria-label="Close programme navigation"/>}
    <aside className={`programme-rail ${menuOpen ? "open" : ""}`}><div className="programme-rail-top"><Link href="/learning"><ArrowLeft/>Volume 1</Link><button onClick={() => setMenuOpen(false)} aria-label="Close programme navigation"><X/></button></div><p>10-day programme</p><nav aria-label="Habit programme days">{programme.treatment.pages.map((item, index) => <button key={item.id} onClick={() => { setSelected(index); setPanel("learn"); setMenuOpen(false); scrollTo({ top: 0 }); }} className={`${index === selected ? "current" : ""} ${completed.has(item.id) ? "complete" : ""}`}><span>{completed.has(item.id) ? <Check/> : pageNumber(item)}</span><div><small>{item.phase.replaceAll("_", " ")}</small><strong>{item.label}</strong></div></button>)}</nav><div className="programme-privacy"><ShieldCheck/><p>{programme.treatment.privacySummary}</p></div></aside>
    <main className="programme-main">
      <section className="programme-day-heading"><p>{page.key} · {page.phase.replaceAll("_", " ")}</p><h1>{page.label}</h1><div className="programme-day-badges"><span>{programme.treatment.sourceId}</span>{page.experimentPosition && <strong>{page.experimentPosition}</strong>}</div></section>
      <nav className="programme-tabs" aria-label="Programme tools"><button className={panel === "learn" ? "active" : ""} onClick={() => setPanel("learn")}><BookOpen/>Learn</button><button className={panel === "experiment" ? "active" : ""} onClick={() => setPanel("experiment")}><CalendarDays/>Experiment{runtime.experiment?.status === "ACTIVE" && <i/>}</button><button className={panel === "investigation" ? "active" : ""} onClick={() => setPanel("investigation")}><FlaskConical/>My Investigation</button><button className={panel === "progress" ? "active" : ""} onClick={() => setPanel("progress")}><NotebookPen/>Progress</button></nav>
      {panel === "learn" && <><div className="programme-save-state" aria-live="polite">{saveState === "saving" ? "Saving workbook responses…" : saveState === "dirty" ? "Changes waiting to save…" : "Workbook responses saved"}</div><article ref={documentRef} className="programme-document" onInput={onDocumentInput}>{dayThree ? <><div dangerouslySetInnerHTML={{ __html: dayThree.intro }}/><section className="programme-lab-handoff"><div><p>DAY 3 · LIVE INVESTIGATION</p><h2>Continue into Habit Lab Phase A.</h2><span>The handbook remains your reference while the formal hypothesis, experiment contract and seven-day evidence are captured once in the executable Lab.</span></div><Link href="/?view=lab&returnTo=/learning/habit">{phaseAComplete ? "Return to My Lab" : "Open Habit Lab Phase A"}<ArrowRight/></Link></section><details className="programme-day3-reference"><summary>Open the full authored Day 3 investigation reference</summary><p>Formal Lab response boxes are read-only here because those responses belong to the live Habit Lab record.</p><div dangerouslySetInnerHTML={{ __html: dayThree.reference }}/></details>{phaseAComplete ? <div dangerouslySetInnerHTML={{ __html: dayThree.tail }}/> : <section className="programme-after-lab"><LockKeyhole/><div><strong>Finish Phase A to continue Day 3.</strong><p>Your experiment begins when the live investigation is complete.</p></div></section>}</> : <div dangerouslySetInnerHTML={{ __html: page.html }}/>}</article>{error && <p className="programme-error" role="alert">{error}</p>}<footer className="programme-footer"><div><strong>{page.key}</strong><span>{completed.has(page.id) ? "Reviewed" : "In progress"}</span></div><div><button onClick={() => setSelected(Math.max(0, selected - 1))} disabled={selected === 0}><ArrowLeft/>Previous</button><button className="primary" onClick={() => void completePage()} disabled={saving || (page.key === "Day 3" && !phaseAComplete)}>{page.key === "Day 3" && !phaseAComplete ? "Complete Phase A first" : completed.has(page.id) ? "Reviewed" : "Complete & continue"}<ChevronRight/></button></div></footer></>}
      {panel === "experiment" && <ToolPanel icon={<CalendarDays/>} kicker="Seven-day field experiment" title={runtime.experiment ? (runtime.experiment.status === "ACTIVE" ? `Experiment Day ${experimentDay ?? "—"} of 7` : "Experiment review ready") : "Your experiment begins in Habit Lab Phase A."} body={runtime.experiment ? `${runtime.events.length}/7 days recorded. No opportunity is valid evidence and is not a failure.` : "Use Programme Day 3 to define the experiment. Once Phase A is complete, this area becomes your daily evidence doorway."} href={runtime.experiment ? "/?view=experiment&returnTo=/learning/habit" : "/?view=lab&returnTo=/learning/habit"} link={runtime.experiment ? "Open today's experiment record" : "Open Habit Lab Phase A"}/>} 
      {panel === "investigation" && <ToolPanel icon={<FlaskConical/>} kicker="My Investigation" title={runtime.hypothesis?.statement || "Your investigation record appears after Phase A."} body={runtime.hypothesis?.falsificationStatement ? `Falsification test: ${runtime.hypothesis.falsificationStatement}` : "Your working equation and experiment contract stay connected to the programme without duplicating the Lab record."} href="/?view=lab&returnTo=/learning/habit" link="Open the full investigation"/>}
      {panel === "progress" && <section className="programme-progress-panel"><div><p className="programme-kicker">Programme map</p><h2>Two clocks. One continuous journey.</h2><p>The programme moves from Day 1 to Day 10. The field experiment begins on Day 3 and runs for seven days, including the weekend.</p></div><div className="programme-progress-list">{programme.treatment.pages.map((item, index) => <button key={item.id} onClick={() => { setSelected(index); setPanel("learn"); }} className={index === selected ? "current" : ""}><span>{completed.has(item.id) ? <Check/> : <Circle/>}</span><div><strong>{item.key}</strong><small>{item.label}</small></div>{item.experimentPosition && <em>{item.experimentPosition}</em>}</button>)}</div></section>}
    </main>
  </div>;
}

function ToolPanel({ icon, kicker, title, body, href, link }: { icon: React.ReactNode; kicker: string; title: string; body: string; href: string; link: string }) {
  return <section className="programme-tool-card">{icon}<p className="programme-kicker">{kicker}</p><h2>{title}</h2><p>{body}</p><Link href={href}>{link}<ArrowRight/></Link></section>;
}
