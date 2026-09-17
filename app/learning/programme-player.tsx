"use client";

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

const handbookCards = [
  {
    number: "01",
    code: "HAB",
    title: "Habit Lab™",
    subtitle: "The Habit Investigation Handbook",
    copy: "Ten days. One repeated behaviour. A seven-day experiment from cue to evidence review.",
    kind: "reader" as const,
  },
  {
    number: "02",
    code: "DEC",
    title: "Decision Lab™",
    subtitle: "The Decision Investigation Handbook",
    copy: "Ten days. One decision pattern. A seven-day experiment in deliberate choice.",
    href: "/decision",
    kind: "current-lab" as const,
  },
  {
    number: "03",
    code: "MON",
    title: "Money Lab™",
    subtitle: "The Money Investigation Handbook",
    copy: "Ten days. One spending pattern. A seven-day experiment in seeing the moment before the moment.",
    href: "/money",
    kind: "current-lab" as const,
  },
  {
    number: "04",
    code: "IDN",
    title: "Identity Lab™",
    subtitle: "The Self-Story Investigation Handbook",
    copy: "Ten days. One safe, observable self-claim. Prediction, evidence and refinement.",
    kind: "source-held" as const,
  },
  {
    number: "05",
    code: "ATT",
    title: "Attention Lab™",
    subtitle: "The Attention Investigation Handbook",
    copy: "Ten days. One ordinary attention pattern. Conditions, triggers and evidence.",
    kind: "source-held" as const,
  },
] as const;

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

async function loadProgramme(edition: Edition): Promise<HabitProgramme> {
  const response = await fetch(`/programmes/habit-${edition}.json.gz.b64`, {
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error("The complete Habit programme material could not be loaded.");
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
  initialSection = "today",
}: {
  initialSection?: AppSection;
}) {
  const [snapshot, setSnapshot] = useState<LearningSnapshot | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [programme, setProgramme] = useState<HabitProgramme | null>(null);
  const [selected, setSelected] = useState(0);
  const [section, setSection] = useState<AppSection>(initialSection);
  const [learnMode, setLearnMode] = useState<LearnMode>("library");
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dirty = useRef(new Set<string>());
  const documentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setSection(initialSection);
    if (initialSection === "learn") setLearnMode("library");
  }, [initialSection]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [learningResponse, runtimeResponse] = await Promise.all([
          fetch("/api/learning", { cache: "no-store", signal: controller.signal }),
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
        const loaded = await loadProgramme(learning.profile.deliveryEdition);
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
        const latest = learning.progress.find((item) => item.labCode === "HAB");
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
  }, []);

  const release = snapshot?.releases.find((item) => item.labCode === "HAB");
  const page = programme?.treatment.pages[selected];
  const completed = useMemo(
    () =>
      new Set(
        snapshot?.progress
          .filter(
            (item) =>
              item.labCode === "HAB" &&
              item.status === "COMPLETED" &&
              (!release || item.contentReleaseId === release.id),
          )
          .map((item) => item.semanticStepId) ?? [],
      ),
    [snapshot, release],
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

  const saveDirtyResponses = useCallback(async () => {
    if (!snapshot || !page || !release || dirty.current.size === 0 || saving) return;
    const elements = [
      ...(documentRef.current?.querySelectorAll<HTMLTextAreaElement>(
        "textarea[data-field-id]",
      ) ?? []),
    ];
    const ids = [...dirty.current];
    const items = ids.flatMap((id) => {
      const field = elements.find((candidate) => candidate.dataset.fieldId === id);
      return !field || field.dataset.purpose !== "LEARNING_RESPONSE" || !field.dataset.sourceKey
        ? []
        : [
            {
              semanticFieldId: id,
              sourceFieldKey: field.dataset.sourceKey,
              semanticStepId: page.id,
              value: drafts[id] ?? "",
            },
          ];
    });
    if (!items.length) {
      dirty.current.clear();
      setSaveState("saved");
      return;
    }
    setSaving(true);
    setSaveState("saving");
    setError("");
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "saveWorkbookResponses",
          labCode: "HAB",
          contentReleaseId: release.id,
          items,
        }),
      });
      const data = (await response.json()) as LearningSnapshot & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Your workbook responses could not be saved.");
      }
      ids.forEach((id) => dirty.current.delete(id));
      mergeSnapshot(data);
      setSaveState("saved");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Your workbook responses could not be saved.",
      );
      setSaveState("dirty");
    } finally {
      setSaving(false);
    }
  }, [drafts, mergeSnapshot, page, release, saving, snapshot]);

  useEffect(() => {
    if (!page || !release || completed.has(page.id)) return;
    const controller = new AbortController();
    void fetch("/api/learning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "saveProgress",
        labCode: "HAB",
        contentReleaseId: release.id,
        semanticStepId: page.id,
        status: "STARTED",
      }),
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [page, release, completed]);

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
    dirty.current.add(target.dataset.fieldId);
    setDrafts((current) => ({ ...current, [target.dataset.fieldId!]: target.value }));
    setSaveState("dirty");
  }

  function openToday() {
    setSection("today");
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openLearn(mode: LearnMode = "library") {
    setSection("learn");
    setLearnMode(mode);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function completePage() {
    if (!page || !release || saving) return;
    if (page.key === "Day 3" && !phaseAComplete) {
      setError("Complete Habit Lab Phase A before marking Programme Day 3 complete.");
      return;
    }
    await saveDirtyResponses();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "saveProgress",
          labCode: "HAB",
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

  const dayThree = page.key === "Day 3" ? splitDayThree(page) : null;

  return (
    <div className="prototype-player" data-edition={snapshot.profile.deliveryEdition}>
      <header className="prototype-topbar">
        <button
          type="button"
          className="prototype-brand"
          onClick={() => openToday()}
          aria-label="Go to Today"
        >
          <span>BIS</span>
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
                <small>{progressPercent}% of the Habit programme reviewed</small>
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

              {page.key === "Day 3" && !phaseAComplete ? (
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

              {runtime.experiment ? (
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
            <p className="prototype-eyebrow">Volume 1</p>
            <h1>Learning library.</h1>
            <p className="prototype-lede">Choose a handbook to open or continue.</p>

            <div className="prototype-section-heading">
              <div>
                <p className="prototype-eyebrow">Browse</p>
                <h2>Handbooks</h2>
              </div>
              <span>1–5</span>
            </div>

            <div className="prototype-handbook-grid">
              {handbookCards.map((book) => {
                if (book.kind === "reader") {
                  return (
                    <button
                      type="button"
                      key={book.code}
                      className="prototype-handbook-card"
                      onClick={() => openLearn("reader")}
                    >
                      <HandbookCardBody
                        number={book.number}
                        title={book.title}
                        subtitle={book.subtitle}
                        copy={book.copy}
                        status={progressPercent > 0 ? `${progressPercent}% reviewed` : "Open handbook"}
                      />
                    </button>
                  );
                }
                if (book.kind === "current-lab") {
                  return (
                    <Link key={book.code} className="prototype-handbook-card" href={book.href}>
                      <HandbookCardBody
                        number={book.number}
                        title={book.title}
                        subtitle={book.subtitle}
                        copy={book.copy}
                        status="Open Lab"
                      />
                    </Link>
                  );
                }
                return (
                  <article key={book.code} className="prototype-handbook-card source-held">
                    <HandbookCardBody
                      number={book.number}
                      title={book.title}
                      subtitle={book.subtitle}
                      copy={book.copy}
                      status="Coming later"
                    />
                  </article>
                );
              })}
            </div>

          </section>
        ) : (
          <section className="prototype-page prototype-reader">
            <button type="button" className="prototype-back-link" onClick={() => setLearnMode("library")}>
              <ArrowLeft /> All handbooks
            </button>

            <div className="prototype-reader-hero prototype-reader-hero-compact">
              <div className="prototype-reader-compact-head">
                <div>
                  <p className="prototype-eyebrow">Habit Investigation Handbook</p>
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

            <details className="prototype-programme-map">
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
                  : "Workbook responses saved"}
            </div>

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

            {error ? (
              <p className="prototype-error" role="alert">
                {error}
              </p>
            ) : null}

            <footer className="prototype-reader-footer">
              <button
                type="button"
                onClick={() => setSelected(Math.max(0, selected - 1))}
                disabled={selected === 0}
              >
                <ArrowLeft /> Previous
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void completePage()}
                disabled={saving || (page.key === "Day 3" && !phaseAComplete)}
              >
                {page.key === "Day 3" && !phaseAComplete
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
            <span>BIS</span>
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
            onClick={() => openLearn("library")}
          >
            <BookOpen />
            <span><strong>Learn</strong><small>Handbooks, programme map and workbook</small></span>
          </button>
          <Link href="/habit-lab?returnTo=%2Fhabit">
            <FlaskConical />
            <span><strong>Lab</strong><small>Habit Lab Phase A and investigation record</small></span>
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

function HandbookCardBody({
  number,
  title,
  subtitle,
  copy,
  status,
}: {
  number: string;
  title: string;
  subtitle: string;
  copy: string;
  status: string;
}) {
  return (
    <>
      <div>
        <div className="prototype-book-number">{number}</div>
        <div className="prototype-book-meta">{title}</div>
        <div className="prototype-book-title">{subtitle}</div>
        <p>{copy}</p>
      </div>
      <span className="prototype-book-status">{status}</span>
    </>
  );
}
