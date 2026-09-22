"use client";

import { BisMark } from "@/components/brand/bis-mark";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  FlaskConical,
  House,
  LibraryBig,
  LockKeyhole,
  Menu,
  X,
} from "lucide-react";
import { BIS_MODULES } from "../../lib/bis-catalogue";
import { WorkbookSaveQueue } from "../../lib/workbook-save-queue";
import type { HabitProgramme, ProgrammePage } from "../../lib/programme-handbook";

type Edition = HabitProgramme["edition"];
type AppSection = "today" | "learn";
type LearnMode = "library" | "reader";
type Progress = {
  labCode: string;
  contentReleaseId: string;
  semanticStepId: string;
  status: "STARTED" | "COMPLETED";
  lastSeenAt: string;
};
type LearningSnapshot = {
  profile: {
    displayName: string;
    deliveryEdition: Edition;
    deliveryContext: string;
    language: string;
    timezone: string;
  };
  releases: Array<{ id: string; labCode: string; contentVersion: string; status: string }>;
  progress: Progress[];
  workbookResponses: Record<
    string,
    { value: string; semanticStepId: string; sourceFieldKey: string; updatedAt: string }
  >;
};
type Runtime = {
  roles?: string[];
  enrolment: null | {
    currentInvestigation: number;
    status: string;
    phaseACompletedAt?: string | null;
    experimentStartedAt?: string | null;
  };
  hypothesis: null | {
    statement: string;
    falsificationStatement: string;
    learnerConfidence: number;
  };
  experiment: null | {
    id: string;
    status: string;
    targetPattern: string;
    targetCondition: string;
    alternativeBehaviour: string;
    predictedValue: number;
    startDate: string;
    plannedEndDate: string;
  };
  events: Array<{ dayNumber: number; eligibleOpportunity: boolean; alternativeUsed: boolean | null }>;
  measurements: Record<string, { value: unknown; status: string; evidenceStrength: string }>;
};



const pageNumber = (page: ProgrammePage) =>
  page.key === "Welcome"
    ? "00"
    : page.key === "Weekend"
      ? "W"
      : page.key === "Certificate"
        ? "✓"
        : String(page.programmeDay ?? "").padStart(2, "0");

const currentExperimentDay = (experiment: Runtime["experiment"]) => {
  if (!experiment) return null;
  const start = new Date(`${experiment.startDate}T00:00:00.000Z`).getTime();
  const now = new Date();
  return Math.max(
    1,
    Math.min(
      7,
      Math.floor(
        (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start) /
          86_400_000,
      ) + 1,
    ),
  );
};

function splitDayThree(page: ProgrammePage) {
  if (!page.labHandoff) return null;
  const start = page.html.indexOf(page.labHandoff.startMarker);
  const end = page.html.indexOf(page.labHandoff.endMarker, Math.max(0, start));
  return start < 0 || end < 0
    ? null
    : {
        intro: page.html.slice(0, start),
        reference: page.html.slice(start, end),
        tail: page.html.slice(end),
      };
}

async function loadProgramme(edition: Edition, code: HabitProgramme["labCode"]): Promise<HabitProgramme> {
  const slug = ({ HAB: "habit", DEC: "decision", MON: "money", IDN: "identity", ATT: "attention" })[code];
  const response = await fetch(`/handbooks/v1/${slug}-${edition}.json.gz.b64`, {
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error("The complete handbook material could not be loaded.");
  }
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("This browser cannot open the compressed programme material.");
  }
  const binary = atob((await response.text()).trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const stream = new Blob([bytes.buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as HabitProgramme;
}

export function ProgrammePlayer({
  moduleCode = "HAB",
  initialSection = "today",
  initialLearnMode = "library",
}: {
  moduleCode?: HabitProgramme["labCode"];
  initialSection?: AppSection;
  initialLearnMode?: LearnMode;
}) {
  const [snapshot, setSnapshot] = useState<LearningSnapshot | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [programme, setProgramme] = useState<HabitProgramme | null>(null);
  const [selected, setSelected] = useState(0);
  const [section, setSection] = useState<AppSection>(initialSection);
  const [learnMode, setLearnMode] = useState<LearnMode>(initialLearnMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const queue = useRef(new WorkbookSaveQueue());
  const [completing, setCompleting] = useState(false);
  const documentRef = useRef<HTMLElement | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1100px)");
    const sync = () => setMapOpen(desktop.matches);
    const frame = requestAnimationFrame(sync);
    desktop.addEventListener("change", sync);
    return () => { cancelAnimationFrame(frame); desktop.removeEventListener("change", sync); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [learningResponse, runtimeResponse] = await Promise.all([
          fetch(`/api/learning?lab=${moduleCode}`, { cache: "no-store", signal: controller.signal }),
          fetch("/api/bis", { cache: "no-store", signal: controller.signal }),
        ]);
        const learning = (await learningResponse.json()) as LearningSnapshot & { error?: string };
        const live = (await runtimeResponse.json()) as Runtime & { error?: string };
        if (!learningResponse.ok) {
          throw new Error(learning.error || "Your learning record could not be loaded.");
        }
        if (!runtimeResponse.ok) {
          throw new Error(live.error || "Your Habit Lab record could not be loaded.");
        }
        const loaded = await loadProgramme(learning.profile.deliveryEdition, moduleCode);
        if (controller.signal.aborted) return;
        setSnapshot(learning);
        setRuntime(live);
        setProgramme(loaded);
        setDrafts(
          Object.fromEntries(
            Object.entries(learning.workbookResponses ?? {}).map(([id, row]) => [
              id,
              row.value ?? "",
            ]),
          ),
        );
        const latest = learning.progress.find((item) => item.labCode === moduleCode);
        const index = latest
          ? loaded.treatment.pages.findIndex((item) => item.id === latest.semanticStepId)
          : -1;
        if (index >= 0) setSelected(index);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "The programme could not be opened.",
          );
        }
      }
    })();
    return () => controller.abort();
  }, [moduleCode]);

  const release = snapshot?.releases.find((item) => item.labCode === moduleCode);
  const page = programme?.treatment.pages[selected];
  const completed = useMemo(
    () =>
      new Set(
        snapshot?.progress
          .filter(
            (item) =>
              item.labCode === moduleCode &&
              item.status === "COMPLETED" &&
              (!release || item.contentReleaseId === release.id),
          )
          .map((item) => item.semanticStepId) ?? [],
      ),
    [snapshot, release, moduleCode],
  );
  const experimentDay = currentExperimentDay(runtime?.experiment ?? null);
  const phaseAComplete = Boolean(runtime?.enrolment?.phaseACompletedAt || runtime?.experiment);
  const progressPercent = programme
    ? Math.round(
        (programme.treatment.pages.filter((item) => completed.has(item.id)).length /
          programme.treatment.pages.length) *
          100,
      )
    : 0;
  const firstName = snapshot?.profile.displayName?.split(" ")[0] || "Investigator";
  const hasStaffAccess = Boolean(
    runtime?.roles?.some((role) =>
      ["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER"].includes(role),
    ),
  );

  const mergeSnapshot = useCallback((data: LearningSnapshot) => {
    setSnapshot(data);
    setDrafts((current) => ({
      ...Object.fromEntries(
        Object.entries(data.workbookResponses ?? {}).map(([id, row]) => [id, row.value ?? ""]),
      ),
      ...current,
    }));
  }, []);

  const saveDirtyResponses = useCallback(async (): Promise<boolean> => {
    if (!release) return queue.current.size === 0;
    if (queue.current.size === 0) return true;
    setSaving(true);
    setSaveState("saving");
    const success = await queue.current.flush(async (items) => {
      try {
        const response = await fetch("/api/learning", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "saveWorkbookResponses", labCode: programme?.labCode ?? "HAB", contentReleaseId: release.id, items }),
        });
        const data = await response.json() as LearningSnapshot & { error?: string };
        if (!response.ok) throw new Error(data.error || "Your workbook responses could not be saved.");
        mergeSnapshot(data);
      } catch (cause) {
        setError((cause instanceof Error ? cause.message : "Your workbook responses could not be saved.") + " Your edits are still here. Retry before leaving this page.");
        throw cause;
      }
    });
    setSaving(false);
    setSaveState(success ? "saved" : "error");
    if (success) setError("");
    return success;
  }, [mergeSnapshot, programme, release]);

  // Capture document-wide links, including the shared shell outside this player.
  useEffect(() => {
    const guardNavigation = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.getAttribute("href")?.startsWith("#")) return;
      if (!completing && !queue.current.size) return;
      event.preventDefault();
      event.stopPropagation();
      if (!completing) void saveDirtyResponses().then((saved) => { if (saved) window.location.assign(link.href); });
    };
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [completing, saveDirtyResponses]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (queue.current.size) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  useEffect(() => {
    if (!page || section !== "learn" || learnMode !== "reader") return;
    const frame = requestAnimationFrame(() =>
      documentRef.current
        ?.querySelectorAll<HTMLTextAreaElement>("textarea[data-field-id]")
        .forEach((field) => {
          const id = field.dataset.fieldId;
          if (!id) return;
          field.value = drafts[id] ?? snapshot?.workbookResponses?.[id]?.value ?? "";
          if (field.dataset.purpose === "FORMAL_LAB_REFERENCE") {
            field.disabled = true;
            field.placeholder = "Captured in the live Habit Lab";
          }
        }),
    );
    return () => cancelAnimationFrame(frame);
  }, [drafts, learnMode, page, section, snapshot?.workbookResponses]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(() => void saveDirtyResponses(), 900);
    return () => clearTimeout(timer);
  }, [saveDirtyResponses, saveState]);

  function onDocumentInput(event: FormEvent<HTMLElement>) {
    const target = event.target as HTMLTextAreaElement;
    if (
      !(target instanceof HTMLTextAreaElement) ||
      !target.dataset.fieldId ||
      target.dataset.purpose === "FORMAL_LAB_REFERENCE"
    ) {
      return;
    }
    if (!page || !target.dataset.sourceKey) return;
    queue.current.edit({ semanticFieldId: target.dataset.fieldId, semanticStepId: page.id, sourceFieldKey: target.dataset.sourceKey, value: target.value });
    setDrafts((current) => ({ ...current, [target.dataset.fieldId!]: target.value }));
    setSaveState("dirty");
  }

  function openToday() {
    if (completing) return;
    setSection("today");
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openLearn(mode: LearnMode = "library") {
    if (completing) return;
    setSection("learn");
    setLearnMode(mode);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function completePage() {
    if (!page || !release || saving || completing) return;
    if (moduleCode === "HAB" && page.key === "Day 3" && !phaseAComplete) {
      setError("Complete Habit Lab Phase A before marking Programme Day 3 complete.");
      return;
    }
    setCompleting(true);
    if (!(await saveDirtyResponses())) { setCompleting(false); return; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "saveProgress",
          labCode: moduleCode,
          contentReleaseId: release.id,
          semanticStepId: page.id,
          status: "COMPLETED",
        }),
      });
      const data = (await response.json()) as LearningSnapshot & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Programme progress could not be saved.");
      }
      mergeSnapshot(data);
      if (programme && selected < programme.treatment.pages.length - 1) {
        setSelected((value) => value + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Programme progress could not be saved.");
    } finally {
      setSaving(false);
      setCompleting(false);
    }
  }

  if (error && !programme) {
    return (
      <main className="learning-state">
        <LockKeyhole />
        <h1>Programme unavailable</h1>
        <p>{error}</p>
        <Link href="/habit">Try the programme again</Link>
      </main>
    );
  }
  if (!snapshot || !programme || !page || !runtime) {
    return (
      <main className="learning-state">
        <span className="learning-loader" />
        <h1>Opening your BIS learning environment…</h1>
        <p>Loading your progress.</p>
      </main>
    );
  }

  const dayThree = moduleCode === "HAB" && page.key === "Day 3" ? splitDayThree(page) : null;

  return (
    <div className="prototype-player" data-edition={snapshot.profile.deliveryEdition}>
      <header className="prototype-topbar">
        <button
          type="button"
          className="prototype-brand"
          onClick={() => openToday()}
          aria-label="Go to Today"
        >
          <span><BisMark /></span>
          <strong>Behaviour Intelligence Series™</strong>
        </button>
        <div className="prototype-top-context">
          {runtime.experiment?.status === "ACTIVE" && experimentDay ? (
            <strong>Experiment Day {experimentDay} of 7</strong>
          ) : null}
        </div>
      </header>

      <main className="prototype-main">
        {section === "today" ? (
          <section className="prototype-page prototype-today">
            <div className="prototype-today-hero">
              <div>
                <p className="prototype-eyebrow">Today · {programme.title}</p>
                <h1>Good to see you, {firstName}.</h1>
                <p>
                  Your programme, Lab and field experiment are one journey. This screen tells you
                  what needs your attention now; it does not create another navigation system.
                </p>
              </div>
              <div className="prototype-today-status">
                <span>{page.programmeDay ? `Programme Day ${page.programmeDay} of 10` : page.key}</span>
                <strong>{page.label}</strong>
                <div className="prototype-progress-track">
                  <i style={{ width: `${progressPercent}%` }} />
                </div>
                <small>{progressPercent}% of this handbook reviewed</small>
              </div>
            </div>

            <div className="prototype-dashboard-grid">
              <article className="prototype-card prototype-journey-card">
                <p className="prototype-eyebrow">Continue your programme</p>
                <h2>{page.label}</h2>
                <p>{page.experimentPosition || "Your authored handbook is ready at your current position."}</p>
                <button type="button" className="prototype-btn primary" onClick={() => openLearn("reader")}>
                  Continue learning <ArrowRight />
                </button>
              </article>

              {moduleCode === "HAB" && page.key === "Day 3" && !phaseAComplete ? (
                <article className="prototype-card prototype-action-card">
                  <FlaskConical />
                  <p className="prototype-eyebrow">Day 3 · Habit Lab</p>
                  <h3>Your live investigation is ready.</h3>
                  <p>Complete Phase A here; the handbook remains your learning reference.</p>
                  <Link className="prototype-btn primary" href="/habit-lab?returnTo=%2Fhabit%3Fsection%3Dlearn">
                    Open Habit Lab <ArrowRight />
                  </Link>
                </article>
              ) : null}

              {moduleCode === "HAB" && runtime.experiment ? (
                <article className="prototype-card prototype-action-card">
                  <CalendarDays />
                  <p className="prototype-eyebrow">Field experiment</p>
                  <h3>{runtime.events.length}/7 observation days recorded.</h3>
                  <p>No opportunity is valid evidence. The experiment has its own clock.</p>
                  <Link
                    className="prototype-btn soft"
                    href="/habit-lab/experiment?returnTo=%2Fhabit"
                  >
                    Open experiment <ArrowRight />
                  </Link>
                </article>
              ) : null}
            </div>
          </section>
        ) : learnMode === "library" ? (
          <section className="prototype-page prototype-library">
            <p className="prototype-eyebrow">Learning library</p>
            <h1>Your handbooks live in one place.</h1>
            <p className="prototype-lede">
              Browse all 34 BIS learning modules across Volumes 1, 2 and 3.
            </p>
            <Link className="prototype-btn primary" href="/learn">
              Open handbook library <ArrowRight />
            </Link>
          </section>
        ) : (
          <section className="prototype-page prototype-reader">
            <Link className="prototype-back-link" href="/learn">
              <ArrowLeft /> All handbooks
            </Link>

            <div className="prototype-reader-hero prototype-reader-hero-compact">
              <div className="prototype-reader-compact-head">
                <div>
                  <p className="prototype-eyebrow">{programme.subtitle}</p>
                  <h1>{page.programmeDay ? `Day ${page.programmeDay} of 10` : page.key}</h1>
                </div>
                <strong>{progressPercent}%</strong>
              </div>
              {page.experimentPosition ? (
                <p className="prototype-reader-position">{page.experimentPosition}</p>
              ) : null}
              <div className="prototype-progress-track light">
                <i style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <details className="prototype-programme-map" open={mapOpen} onToggle={(event) => setMapOpen(event.currentTarget.open)}>
              <summary>
                <span>
                  <LibraryBig /> Programme map
                </span>
                <strong>{page.key} · {page.label}</strong>
              </summary>
              <div>
                {programme.treatment.pages.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    disabled={completing}
                    className={`${index === selected ? "current" : ""} ${completed.has(item.id) ? "complete" : ""}`}
                    onClick={() => {
                      setSelected(index);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <span>{completed.has(item.id) ? <Check /> : pageNumber(item)}</span>
                    <div>
                      <strong>{item.key}</strong>
                      <small>{item.label}</small>
                    </div>
                    {item.experimentPosition ? <em>{item.experimentPosition}</em> : null}
                  </button>
                ))}
              </div>
            </details>

            <div className="prototype-save-state" aria-live="polite">
              {saveState === "saving"
                ? "Saving workbook responses…"
                : saveState === "dirty"
                  ? "Changes waiting to save…"
                  : saveState === "error" ? "Not saved — retry before leaving" : "Workbook responses saved"}
              {saveState === "error" ? <button type="button" onClick={() => void saveDirtyResponses()}>Retry save</button> : null}
            </div>

            <fieldset className="workbook-fields" disabled={completing}>
            <article ref={documentRef} className="prototype-document" onInput={onDocumentInput}>
              {dayThree ? (
                <>
                  <div dangerouslySetInnerHTML={{ __html: dayThree.intro }} />
                  <section className="prototype-lab-handoff">
                    <div>
                      <p>DAY 3 · LIVE INVESTIGATION</p>
                      <h2>Continue into Habit Lab Phase A.</h2>
                      <span>
                        The handbook remains here as your learning reference. Formal hypothesis,
                        experiment contract and evidence are captured once in the executable Lab.
                      </span>
                    </div>
                    <Link href="/habit-lab?returnTo=%2Fhabit%3Fsection%3Dlearn">
                      {phaseAComplete ? "Return to Habit Lab" : "Open Habit Lab Phase A"}
                      <ArrowRight />
                    </Link>
                  </section>
                  <details className="prototype-reference">
                    <summary>Open the full authored Day 3 investigation reference</summary>
                    <p>
                      Formal Lab response boxes are read-only here because those responses belong to
                      the live Habit Lab record.
                    </p>
                    <div dangerouslySetInnerHTML={{ __html: dayThree.reference }} />
                  </details>
                  {phaseAComplete ? (
                    <div dangerouslySetInnerHTML={{ __html: dayThree.tail }} />
                  ) : (
                    <section className="prototype-after-lab">
                      <LockKeyhole />
                      <div>
                        <strong>Finish Phase A to continue Day 3.</strong>
                        <p>Your seven-day experiment begins when the live investigation is complete.</p>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: page.html }} />
              )}
            </article>
            </fieldset>

            {page.key === "Certificate" && completed.has(page.id) ? (
              <section className="handbook-next" aria-label="Continue learning">
                <h2>Choose your next handbook</h2>
                <p>Your page review is saved. All five handbooks are open; choose any one.</p>
                <div>{BIS_MODULES.filter((item) => item.learningStatus === "live" && item.code !== moduleCode).map((item) => <Link key={item.code} href={item.learningHref!}>{item.title}<ArrowRight /></Link>)}</div>
              </section>
            ) : null}
            {moduleCode !== "HAB" && page.key === "Day 3" ? <p className="handbook-learning-note">These are private handbook reflections. Formal Lab investigations and their evidence records remain separate. {moduleCode === "DEC" || moduleCode === "MON" ? <Link href={moduleCode === "DEC" ? "/decision" : "/money"}>Open the live {programme.title}</Link> : null}</p> : null}
            {error ? (
              <p className="prototype-error" role="alert">
                {error}
              </p>
            ) : null}

            <footer className="prototype-reader-footer">
              <button
                type="button"
                onClick={() => setSelected(Math.max(0, selected - 1))}
                disabled={selected === 0 || completing}
              >
                <ArrowLeft /> Previous
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void completePage()}
                disabled={saving || completing || (moduleCode === "HAB" && page.key === "Day 3" && !phaseAComplete)}
              >
                {moduleCode === "HAB" && page.key === "Day 3" && !phaseAComplete
                  ? "Complete Phase A first"
                  : completed.has(page.id)
                    ? "Reviewed"
                    : "Complete & continue"}
                <ChevronRight />
              </button>
            </footer>
          </section>
        )}
      </main>

      {menuOpen ? (
        <button
          type="button"
          className="prototype-menu-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      ) : null}

      <nav className={`prototype-bottom-sheet ${menuOpen ? "open" : ""}`} aria-label="BIS learner menu">
        <div className="prototype-bottom-sheet-head">
          <div>
            <span><BisMark /></span>
            <div>
              <strong>Behaviour Intelligence Series™</strong>
              <small>Learner menu</small>
            </div>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>
        <div className="prototype-menu-items">
          <button type="button" className={section === "today" ? "active" : ""} onClick={openToday}>
            <House />
            <span><strong>Today</strong><small>What needs your attention now</small></span>
          </button>
          <button
            type="button"
            className={section === "learn" ? "active" : ""}
            onClick={() => { void saveDirtyResponses().then((saved) => { if (saved) window.location.assign("/learn"); }); }}
          >
            <BookOpen />
            <span><strong>Learn</strong><small>Browse handbooks</small></span>
          </button>
          <Link href="/labs">
            <FlaskConical />
            <span><strong>Lab</strong><small>Browse investigations</small></span>
          </Link>
          <Link href="/habit-lab/experiment?returnTo=%2Fhabit">
            <CalendarDays />
            <span><strong>Experiment</strong><small>Seven-day field evidence</small></span>
          </Link>
          {hasStaffAccess ? (
            <Link href="/workspace">
              <BriefcaseBusiness />
              <span><strong>Staff workspace</strong><small>Role-restricted operational view</small></span>
            </Link>
          ) : null}
        </div>

      </nav>

      <button
        type="button"
        className="prototype-bottom-trigger"
        onClick={() => setMenuOpen(true)}
        aria-label="Open BIS menu"
        aria-expanded={menuOpen}
      >
        <Menu /> <span>Menu</span>
      </button>
    </div>
  );
}


