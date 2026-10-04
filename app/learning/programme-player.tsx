"use client";

import { BisMark } from "@/components/brand/bis-mark";
import { EditionLanguageScope } from "@/components/learning/school-language-scope";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  ShieldCheck,
  X,
} from "lucide-react";
import { BIS_MODULES, BIS_MODULE_TEMPLATE } from "../../lib/bis-catalogue";
import { loadLearningLabRuntime, universalLearningKnownValues } from "../../lib/learning-lab-runtime.mjs";
import { WorkbookSaveQueue } from "../../lib/workbook-save-queue";
import { enhanceHandbookDocument, type HandbookKnownValue } from "./handbook-document-enhancements";
import type { HabitProgramme, ProgrammePage } from "../../lib/programme-handbook";
import {
  BIS_LAB_PHASE_A_MINUTES,
  sessionDesignForPage,
} from "../../lib/session-design";
import { facilitatorSessionForDay } from "../../lib/facilitator-session";

type Edition = HabitProgramme["edition"];
type AppSection = "today" | "learn";
type LearnMode = "library" | "reader";
type ViewerMode = "learner" | "facilitator";
type FacilitatorContext = {
  cohortId: string;
  cohortName: string;
  edition: Edition;
  returnTo: string;
};
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
  runtimeMode?: "STATIC" | "DYNAMIC";
  definition?: unknown;
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
  events: Array<{ dayNumber: number; eligibleOpportunity: boolean; alternativeUsed: boolean | null; details?: Record<string, unknown> | null }>;
  measurements: Record<string, { value: unknown; status: string; evidenceStrength: string }>;
  responses?: Record<string, { value: unknown; status: string; responseId?: string; recordedAt?: string }>;
  programmeHandoff?: {
    experimentStarted: boolean;
    currentDay: number;
    totalDays: number;
    evidenceDaysRecorded: number;
    todayEvidenceRecorded: boolean;
    evidenceWindowCount?: number;
    reviewReady?: boolean;
    reviewInvestigation?: number;
    labCompleted?: boolean;
    portfolioReady?: boolean;
    nextAction?: "LAB" | "EVIDENCE" | "LEARNING" | "REVIEW" | "PORTFOLIO";
  };
};

const emptyRuntime = (): Runtime => ({
  roles: [],
  enrolment: null,
  hypothesis: null,
  experiment: null,
  events: [],
  measurements: {},
});

function metricNumber(runtime: Runtime | null, code: string) {
  const measurement = runtime?.measurements?.[code];
  if (!measurement || measurement.status === "NA") return null;
  const value = Number(measurement.value);
  return Number.isFinite(value) ? value : null;
}

function responseNumber(runtime: Runtime | null, fieldId: string) {
  const response = runtime?.responses?.[fieldId];
  if (!response || response.status === "PASS") return null;
  const value = Number(response.value);
  return Number.isFinite(value) ? value : null;
}




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

function labHrefWithReturn(href: string, returnTo: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function labHrefWithStep(href: string, step: number) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}step=${step}`;
}

function ProgrammeLabHandoff({
  title,
  href,
  status,
  isHabit,
  habitPhaseAComplete,
}: {
  title: string;
  href: string | null;
  status: "live" | "source_ready" | "catalogued" | "planned";
  isHabit: boolean;
  habitPhaseAComplete: boolean;
}) {
  const live = Boolean(href);
  const sourceReady = !live && status === "source_ready";
  const actionLabel = isHabit
    ? habitPhaseAComplete ? "Return to Habit Lab" : "Open Habit Lab Phase A"
    : `Open ${title}`;

  return (
    <section className={`prototype-lab-handoff ${live ? "live" : "planned"}`}>
      <div className="prototype-lab-handoff-copy">
        <div className="prototype-lab-handoff-meta">
          <span>DAY 3 · LAB HANDOVER</span>
          <em>{live ? "Lab ready" : sourceReady ? "Lab source ready" : "Lab access pending"}</em>
        </div>
        <h2>{live ? `Continue into ${title}.` : `${title} connects here.`}</h2>
        <p className="prototype-lab-handoff-description">
          {live
            ? isHabit
              ? "Complete the facilitated Lab, begin your seven-day test, then return to the handbook."
              : "Complete the facilitated Lab, then return here for your next programme step."
            : sourceReady
              ? "This Lab is already part of the BIS programme. Its digital access will appear here when it is enabled for this programme."
              : "This is where today’s learning connects to the practical Lab."}
        </p>
        <div className="prototype-lab-handoff-phase" aria-label="Lab phase details">
          <strong>Phase A</strong>
          <span>{BIS_LAB_PHASE_A_MINUTES} minutes · Facilitated</span>
        </div>
      </div>
      {href ? (
        <Link className="prototype-lab-handoff-action" href={href}>
          {actionLabel}
          <ArrowRight />
        </Link>
      ) : (
        <span className="prototype-lab-status">Lab access not yet enabled</span>
      )}
    </section>
  );
}

function legacyDayThreeBoundary(html: string) {
  if (!html.trim()) return -1;
  const minimum = Math.floor(html.length * 0.18);
  const maximum = Math.floor(html.length * 0.7);

  const responseEnds = [...html.matchAll(/<\/textarea>/gi)]
    .map((match) => (match.index ?? -1) + match[0].length)
    .filter((index) => index >= minimum && index <= maximum);
  if (responseEnds.length) return responseEnds[0];

  const structural = [...html.matchAll(/<(?:hr|h2|h3|h4)\b[^>]*>/gi)]
    .map((match) => match.index ?? -1)
    .find((index) => index >= Math.floor(html.length * 0.28) && index <= maximum);
  if (structural !== undefined) return structural;

  const paragraphEnd = html.indexOf("</p>", Math.floor(html.length * 0.32));
  return paragraphEnd >= 0 ? paragraphEnd + 4 : -1;
}

function stripLegacyDayThreePlatformPreamble(html: string) {
  const platformIndex = html.search(/EXISTING\s+BIS\s+LAB\s+PLATFORM/i);
  if (platformIndex < 0) return html;

  const dayLabelIndex = html.toUpperCase().indexOf("DAY 3 OF 10", platformIndex);
  if (dayLabelIndex < 0) return html;

  const dayStart = html.lastIndexOf("<", dayLabelIndex);
  return html.slice(dayStart >= 0 ? dayStart : dayLabelIndex);
}

function splitDayThree(page: ProgrammePage) {
  const html = stripLegacyDayThreePlatformPreamble(page.html);

  if (page.labHandoff?.startMarker && page.labHandoff?.endMarker) {
    const start = html.indexOf(page.labHandoff.startMarker);
    const end = html.indexOf(page.labHandoff.endMarker, Math.max(0, start));
    if (start >= 0 && end >= 0) {
      return {
        intro: html.slice(0, start),
        reference: html.slice(start, end),
        tail: html.slice(end),
        authored: true,
      };
    }
  }

  // Legacy packages pre-date authored Day 3 anchors. Keep their handover inside
  // the learning flow rather than throwing a generic Lab card above the page.
  const boundary = legacyDayThreeBoundary(html);
  if (boundary < 0) return null;
  return {
    intro: html.slice(0, boundary),
    reference: html.slice(boundary),
    tail: "",
    authored: false,
  };
}

async function loadProgramme(edition: Edition, code: string): Promise<HabitProgramme> {
  const dynamic = await fetch(
    `/api/runtime-content?kind=LEARNING_MODULE&code=${encodeURIComponent(code)}&edition=${edition}`,
    { cache: "no-store" },
  );
  if (dynamic.ok) {
    const result = await dynamic.json() as { payload: HabitProgramme };
    return result.payload;
  }

  const detail = await dynamic.json().catch(() => null) as { error?: string } | null;
  throw new Error(detail?.error || "The active learning module could not be loaded.");
}

export function ProgrammePlayer({
  moduleCode = "HAB",
  initialSection = "today",
  initialLearnMode = "library",
  previewVersionId,
  previewEdition,
  viewerMode = "learner",
  facilitatorContext,
}: {
  moduleCode?: string;
  initialSection?: AppSection;
  initialLearnMode?: LearnMode;
  previewVersionId?: string;
  previewEdition?: Edition;
  viewerMode?: ViewerMode;
  facilitatorContext?: FacilitatorContext;
}) {
  const [snapshot, setSnapshot] = useState<LearningSnapshot | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [moduleRuntime, setModuleRuntime] = useState<Runtime | null>(null);
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewMode = Boolean(previewVersionId && previewEdition);
  const facilitatorMode = viewerMode === "facilitator" && Boolean(facilitatorContext);
  const readOnlyMode = previewMode || facilitatorMode;

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
        let learning: LearningSnapshot;
        let live: Runtime;
        let moduleLive: Runtime | null = null;
        let loaded: HabitProgramme;

        if (facilitatorMode && facilitatorContext) {
          loaded = await loadProgramme(facilitatorContext.edition, moduleCode);
          learning = {
            profile: {
              displayName: facilitatorContext.cohortName,
              deliveryEdition: facilitatorContext.edition,
              deliveryContext: "facilitated",
              language: "en",
              timezone: "Africa/Johannesburg",
            },
            releases: [],
            progress: [],
            workbookResponses: {},
          };
          live = {
            roles: ["FACILITATOR"],
            enrolment: null,
            hypothesis: null,
            experiment: null,
            events: [],
            measurements: {},
          };
          moduleLive = null;
        } else if (previewVersionId && previewEdition) {
          const previewResponse = await fetch(
            `/api/content-studio/preview?versionId=${encodeURIComponent(previewVersionId)}&artifact=${encodeURIComponent(`learning:${previewEdition}`)}`,
            { cache: "no-store", signal: controller.signal },
          );
          const preview = await previewResponse.json() as {
            payload?: HabitProgramme;
            version?: { version?: string };
            error?: string;
          };
          if (!previewResponse.ok || !preview.payload) {
            throw new Error(preview.error || "The compiled programme preview could not be loaded.");
          }
          loaded = preview.payload;
          learning = {
            profile: {
              displayName: "UAT reviewer",
              deliveryEdition: previewEdition,
              deliveryContext: "activation-uat",
              language: "en",
              timezone: "Africa/Johannesburg",
            },
            releases: [{
              id: `preview:${previewVersionId}:${previewEdition}`,
              labCode: moduleCode,
              contentVersion: preview.version?.version ?? loaded.contentVersion,
              status: "PREVIEW",
            }],
            progress: [],
            workbookResponses: {},
          };
          live = {
            roles: ["SYSTEM_ADMIN"],
            enrolment: null,
            hypothesis: null,
            experiment: null,
            events: [],
            measurements: {},
          };
          moduleLive = moduleCode === "HAB" ? live : null;
        } else {
          const moduleRuntimePromise = loadLearningLabRuntime(moduleCode, fetch, controller.signal) as Promise<Runtime | null>;

          const [learningResponse, runtimeResponse, moduleRuntimeResult] = await Promise.all([
            fetch(`/api/learning?lab=${moduleCode}`, { cache: "no-store", signal: controller.signal }),
            fetch("/api/profile", { cache: "no-store", signal: controller.signal }),
            moduleRuntimePromise,
          ]);
          learning = (await learningResponse.json()) as LearningSnapshot & { error?: string };
          if (!learningResponse.ok) {
            throw new Error((learning as LearningSnapshot & { error?: string }).error || "Your learning record could not be loaded.");
          }

          live = runtimeResponse.ok
            ? await runtimeResponse.json() as Runtime
            : emptyRuntime();
          moduleLive = moduleRuntimeResult;
          loaded = await loadProgramme(learning.profile.deliveryEdition, moduleCode);
        }

        if (controller.signal.aborted) return;
        setSnapshot(learning);
        setRuntime(live);
        setModuleRuntime(moduleLive);
        setProgramme(loaded);
        setDrafts(
          Object.fromEntries(
            Object.entries(learning.workbookResponses ?? {}).map(([id, row]) => [
              id,
              row.value ?? "",
            ]),
          ),
        );
        const requestedPage = Number(new URLSearchParams(window.location.search).get("page"));
        const requestedIndex = Number.isInteger(requestedPage) && requestedPage >= 1
          ? Math.min(loaded.treatment.pages.length - 1, requestedPage - 1)
          : -1;
        const latest = learning.progress.find((item) => item.labCode === moduleCode);
        const progressIndex = latest
          ? loaded.treatment.pages.findIndex((item) => item.id === latest.semanticStepId)
          : -1;
        const index = requestedIndex >= 0 ? requestedIndex : progressIndex;
        if (index >= 0) setSelected(index);
        // Give the initial/resumed page a stable history entry before Next pushes
        // another page, so browser Back can restore the actual starting point.
        if (requestedIndex < 0) {
          const url = new URL(window.location.href);
          url.searchParams.set("page", String(Math.max(0, index) + 1));
          window.history.replaceState(window.history.state, "", url);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "The programme could not be opened.",
          );
        }
      }
    })();
    return () => controller.abort();
  }, [facilitatorContext, facilitatorMode, moduleCode, previewEdition, previewVersionId]);

  useEffect(() => {
    if (!programme) return;
    const onHistoryChange = () => {
      const requestedPage = Number(new URLSearchParams(window.location.search).get("page"));
      if (!Number.isInteger(requestedPage) || requestedPage < 1) return;
      const index = Math.min(programme.treatment.pages.length - 1, requestedPage - 1);
      setSelected(index);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("popstate", onHistoryChange);
    return () => window.removeEventListener("popstate", onHistoryChange);
  }, [programme]);

  const release = snapshot?.releases.find((item) => item.labCode === moduleCode);
  const page = programme?.treatment.pages[selected];
  const sessionDesign = useMemo(
    () => page && programme ? sessionDesignForPage(page, programme.edition) : null,
    [page, programme],
  );
  const facilitatorGuide = useMemo(
    () => facilitatorMode && page?.programmeDay && programme
      ? facilitatorSessionForDay(page.programmeDay, programme.edition)
      : null,
    [facilitatorMode, page, programme],
  );
  const moduleDefinition = BIS_MODULES.find((item) => item.code === moduleCode) ?? null;
  const universalLabHref = moduleRuntime?.runtimeMode === "DYNAMIC"
    ? `/labs/${moduleCode.toLowerCase()}`
    : null;
  const resolvedLabHref = universalLabHref ?? moduleDefinition?.labHref;
  const moduleLabIsLive = Boolean(
    moduleRuntime?.runtimeMode && resolvedLabHref,
  );
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
  const activeModuleRuntime = moduleRuntime;
  const programmeHandoff = activeModuleRuntime?.programmeHandoff;
  const experimentDay =
    programmeHandoff?.currentDay
    || currentExperimentDay(activeModuleRuntime?.experiment ?? null);
  const experimentTotalDays = programmeHandoff?.totalDays || 7;
  const experimentRecordedDays =
    programmeHandoff?.evidenceDaysRecorded
    ?? new Set(activeModuleRuntime?.events.map((event) => event.dayNumber) ?? []).size;
  const labExperimentStarted =
    readOnlyMode ||
    Boolean(
      programmeHandoff?.experimentStarted
      || activeModuleRuntime?.enrolment?.phaseACompletedAt
      || activeModuleRuntime?.experiment,
    );
  const labHandoffComplete =
    readOnlyMode ||
    Boolean(
      (programmeHandoff && programmeHandoff.evidenceDaysRecorded > 0)
      || (activeModuleRuntime?.experiment && activeModuleRuntime.events.length > 0),
    );
  const labReviewReady = Boolean(programmeHandoff?.reviewReady);
  const labCompleted = Boolean(
    programmeHandoff?.labCompleted || activeModuleRuntime?.enrolment?.status === "COMPLETED",
  );
  const dayThreeIndex = programme?.treatment.pages.findIndex((item) => item.key === "Day 3") ?? -1;
  const labSequenceLocked =
    !readOnlyMode &&
    !labHandoffComplete &&
    dayThreeIndex >= 0 &&
    selected >= dayThreeIndex;
  const knownValues = useMemo<HandbookKnownValue[]>(() => {
    const source = activeModuleRuntime;
    if (!source) return [];
    if (source.runtimeMode === "DYNAMIC") return universalLearningKnownValues(source);

    const values: HandbookKnownValue[] = [];
    const add = (labels: string[], value: number | string | null, suffix = "", note = "From your Lab") => {
      if (value === null || value === undefined || value === "") return;
      values.push({
        labels,
        value: typeof value === "number" ? `${value}${suffix}` : String(value),
        source: note,
      });
    };

    const hasExperiment = Boolean(source.experiment);
    const pending = "Available after your Lab record is complete";
    const notRecorded = "Not recorded in your Lab yet";
    const observedDays = hasExperiment ? new Set(source.events.map((event) => event.dayNumber)).size : null;
    const missingDays = observedDays === null ? null : Math.max(0, 7 - observedDays);
    const eligible = hasExperiment
      ? metricNumber(source, `${moduleCode}.EXPERIMENT.OPPORTUNITY_COUNT`)
        ?? source.events.filter((event) => event.eligibleOpportunity).length
      : null;
    const completedFromEvents = hasExperiment
      ? source.events.filter((event) => event.eligibleOpportunity && event.alternativeUsed === true).length
      : null;
    const completed = hasExperiment
      ? moduleCode === "HAB"
        ? metricNumber(source, "HAB.EXPERIMENT.REPLACEMENT_COUNT") ?? completedFromEvents
        : metricNumber(source, `${moduleCode}.EXPERIMENT.PAUSE_COUNT`) ?? completedFromEvents
      : null;
    const measuredAdherence = metricNumber(source, `${moduleCode}.BEI06`);
    const adherence = measuredAdherence
      ?? (eligible !== null && eligible > 0 && completed !== null
        ? Math.round((completed / eligible) * 100)
        : null);
    const measuredAccuracy = metricNumber(source, `${moduleCode}.BEI03`);
    const predicted = source.experiment ? Number(source.experiment.predictedValue) : Number.NaN;
    const predictedValue = Number.isFinite(predicted) ? predicted : null;
    const accuracy = measuredAccuracy
      ?? (adherence !== null && predictedValue !== null
        ? Math.max(0, 100 - Math.abs(predictedValue - adherence))
        : null);
    const labDataNote =
      observedDays !== null && observedDays < 7
        ? "Current Lab record — updates as you record each day"
        : "From your Lab";
    const systemFigure = (value: number | null) => {
      if (value !== null) return value;
      if (hasExperiment && observedDays === 7 && eligible === 0) return "N/A — no eligible opportunities";
      return pending;
    };

    add(["Observation days completed"], observedDays ?? pending, " / 7", labDataNote);
    add(["Missing / unrecorded days", "Missing days"], missingDays ?? pending, " / 7", labDataNote);
    if (moduleCode === "HAB") {
      add(["Eligible opportunities observed", "Eligible target opportunities observed"], eligible ?? pending, " / 7", labDataNote);
    } else {
      add(
        ["Eligible opportunities observed", "Eligible spending moments observed", "Eligible decision opportunities observed"],
        eligible ?? pending,
        "",
        labDataNote,
      );
    }

    if (moduleCode === "HAB") {
      add(
        ["Completed replacements", "Replacement routine completed", "Successful replacements"],
        completed ?? pending,
        "",
        labDataNote,
      );
      add(["Adherence Rate", "Habit Adherence Rate", "Actual Adherence Rate"], systemFigure(adherence), "%", labDataNote);
      add(["Prediction Accuracy", "Habit Prediction Accuracy"], systemFigure(accuracy), " / 100", labDataNote);
      add(["Predicted Adherence Rate", "Predicted Replacement Rate"], predictedValue ?? notRecorded, "%", labDataNote);
      add(
        ["Your control rating before the experiment was", "Control rating before the experiment"],
        responseNumber(source, "HAB.CONTROL.PRE") ?? notRecorded,
        " /10",
      );
      add(
        ["Your confidence rating before the experiment was", "Equation confidence before the experiment"],
        responseNumber(source, "HAB.EQUATION.CONFIDENCE_PRE") ?? notRecorded,
        " /10",
      );
    }

    if (moduleCode === "DEC") {
      const completedEvents = source.events.filter((event) => event.alternativeUsed === true);
      const pauseTypesKnown = hasExperiment && completedEvents.every(
        (event) => event.details?.pauseType === "Full" || event.details?.pauseType === "Minimum",
      );
      const fullFromEvents = pauseTypesKnown
        ? completedEvents.filter((event) => event.details?.pauseType === "Full").length
        : null;
      const minimumFromEvents = pauseTypesKnown
        ? completedEvents.filter((event) => event.details?.pauseType === "Minimum").length
        : null;
      const full = pauseTypesKnown
        ? metricNumber(source, "DEC.FULL_PAUSE_COUNT") ?? fullFromEvents
        : null;
      const minimum = pauseTypesKnown
        ? metricNumber(source, "DEC.MINIMUM_PAUSE_COUNT") ?? minimumFromEvents
        : null;

      add(["Decision Pauses Completed", "Decision process checks completed", "Pauses completed"], completed ?? pending, "", labDataNote);
      add(["Full Decision Pauses completed"], full ?? "Not separately recorded");
      add(["Secondary evidence — Minimum Version uses", "Minimum Version uses"], minimum ?? "Not separately recorded");
      add(
        ["Decision Process Adherence Rate", "Pause Initiation Rate", "Adherence Rate", "Actual pause rate"],
        systemFigure(adherence),
        "%",
        labDataNote,
      );
      add(["Decision Process Prediction Accuracy", "Prediction Accuracy"], systemFigure(accuracy), " / 100", labDataNote);
      add(
        ["Predicted Decision Pause Rate", "Predicted Outcome Rate", "Predicted pause rate"],
        predictedValue ?? notRecorded,
        "%",
        labDataNote,
      );
      const expandedFullPauses = pauseTypesKnown
        ? completedEvents.filter(
            (event) => event.details?.pauseType === "Full" && event.details?.extraOption === true,
          ).length
        : null;
      const expansionCount = pauseTypesKnown
        ? metricNumber(source, "DEC.OPTION_EXPANSION_COUNT") ?? expandedFullPauses
        : null;
      const expansionRate = pauseTypesKnown && full !== null && full > 0 && expansionCount !== null
        ? metricNumber(source, "DEC.OPTION_EXPANSION_RATE")
          ?? Math.round((expansionCount / full) * 100)
        : null;
      add(
        ["Option Expansion Count", "Full Decision Pauses where an additional option appeared"],
        pauseTypesKnown ? expansionCount ?? 0 : hasExperiment ? "Not separately recorded" : pending,
        "",
        labDataNote,
      );
      add(
        ["Option Expansion Rate"],
        pauseTypesKnown
          ? full !== null && full > 0
            ? expansionRate ?? pending
            : "N/A — no Full Pauses recorded"
          : hasExperiment ? "Not separately recorded" : pending,
        "%",
        labDataNote,
      );
      add(
        ["Your confidence rating before the experiment was", "Equation confidence before the experiment"],
        responseNumber(source, "DEC.EQUATION.CONFIDENCE_PRE") ?? notRecorded,
        " /10",
      );
      add(
        ["Your deliberateness rating before the experiment was", "Decision deliberateness before the experiment"],
        responseNumber(source, "DEC.DELIBERATENESS.PRE") ?? notRecorded,
        " /10",
      );
    }

    if (moduleCode === "MON") {
      const completedEvents = source.events.filter((event) => event.alternativeUsed === true);
      const pauseTypesKnown = hasExperiment && completedEvents.every(
        (event) => event.details?.pauseType === "Full" || event.details?.pauseType === "Minimum",
      );
      const fullFromEvents = pauseTypesKnown
        ? completedEvents.filter((event) => event.details?.pauseType === "Full").length
        : null;
      const minimumFromEvents = pauseTypesKnown
        ? completedEvents.filter((event) => event.details?.pauseType === "Minimum").length
        : null;
      const full = pauseTypesKnown
        ? metricNumber(source, "MON.FULL_PAUSE_COUNT") ?? fullFromEvents
        : null;
      const minimum = pauseTypesKnown
        ? metricNumber(source, "MON.MINIMUM_PAUSE_COUNT") ?? minimumFromEvents
        : null;
      const fullRate = eligible !== null && eligible > 0 && full !== null
        ? Math.round((full / eligible) * 100)
        : null;
      add(["Pauses initiated (Minimum or Full)"], completed ?? pending, "", labDataNote);
      add(["Pause Initiation Rate", "Actual Pause Initiation Rate"], systemFigure(adherence), "%", labDataNote);
      add(["Full Pauses completed"], pauseTypesKnown ? full ?? 0 : hasExperiment ? "Not separately recorded" : pending, "", labDataNote);
      add(["Minimum Pauses completed"], pauseTypesKnown ? minimum ?? 0 : hasExperiment ? "Not separately recorded" : pending, "", labDataNote);
      add(
        ["Full Pause Completion Rate"],
        pauseTypesKnown
          ? eligible !== null && eligible > 0
            ? fullRate ?? pending
            : "N/A — no eligible opportunities"
          : hasExperiment ? "Not separately recorded" : pending,
        "%",
        labDataNote,
      );
      add(["Spending Pause Prediction Accuracy", "Prediction Accuracy"], systemFigure(accuracy), " / 100", labDataNote);
      add(
        ["Predicted Pause Rate", "Predicted Outcome Rate", "Predicted Pause Initiation Rate"],
        predictedValue ?? notRecorded,
        "%",
        labDataNote,
      );
      add(
        ["Your awareness rating before the experiment was", "Money awareness before the experiment"],
        responseNumber(source, "MON.AWARENESS.PRE") ?? notRecorded,
        " /10",
      );
      add(
        ["Your confidence rating before the experiment was", "Equation confidence before the experiment"],
        responseNumber(source, "MON.EQUATION.CONFIDENCE_PRE") ?? notRecorded,
        " /10",
      );
    }

    return values;
  }, [activeModuleRuntime, moduleCode]);
  const progressPercent = programme
    ? Math.round(
        (programme.treatment.pages.filter((item) => completed.has(item.id)).length /
          programme.treatment.pages.length) *
          100,
      )
    : 0;
  const firstName = facilitatorMode ? "Facilitator" : snapshot?.profile.displayName?.split(" ")[0] || "Investigator";
  const hasStaffAccess = Boolean(
    runtime?.roles?.some((role) =>
      ["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER"].includes(role),
    ),
  );

  const goToProgrammePage = useCallback((index: number) => {
    if (!programme) return;
    const next = Math.max(0, Math.min(programme.treatment.pages.length - 1, index));
    setSelected(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "learn");
    params.set("page", String(next + 1));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname, programme, router, searchParams]);

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
    if (readOnlyMode) return true;
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
  }, [mergeSnapshot, programme, readOnlyMode, release]);

  // Capture document-wide links, including the shared shell outside this player.
  useEffect(() => {
    const guardNavigation = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.getAttribute("href")?.startsWith("#")) return;
      if (!completing && !queue.current.size) return;
      event.preventDefault();
      event.stopPropagation();
      if (!completing) void saveDirtyResponses().then((saved) => {
        if (!saved) return;
        const target = new URL(link.href, window.location.href);
        if (target.origin === window.location.origin) {
          router.push(`${target.pathname}${target.search}${target.hash}`);
        } else {
          window.location.assign(link.href);
        }
      });
    };
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [completing, router, saveDirtyResponses]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (queue.current.size) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  const restoreHandbookInteractions = useCallback(() => {
    if (!page || section !== "learn" || learnMode !== "reader") return;
    const documentRoot = documentRef.current;
    if (!documentRoot) return;

    enhanceHandbookDocument(documentRoot, moduleCode, page.id, {
      knownValues,
      learnerName: snapshot?.profile.displayName,
      labAvailable: moduleLabIsLive,
      referenceOnly:
        !readOnlyMode &&
        !moduleLabIsLive &&
        dayThreeIndex >= 0 &&
        selected > dayThreeIndex,
      edition: programme?.edition ?? snapshot?.profile.deliveryEdition,
      programmeDay: page.programmeDay,
      formativeCheckTarget: sessionDesign?.checkTarget,
      enableFormativeLearningChecks: Boolean(sessionDesign),
      facilitatorMode,
      facilitatorGuidance: facilitatorGuide ? {
        discussionMove: facilitatorGuide.facilitatorMoves[0],
      } : undefined,
    });
    documentRoot
      .querySelectorAll<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>("[data-field-id]")
      .forEach((field) => {
        const id = field.dataset.fieldId;
        if (!id) return;
        if (facilitatorMode) {
          if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
            field.checked = false;
          } else {
            field.value = "";
          }
          field.disabled = true;
          if ("placeholder" in field) field.placeholder = "Learners write here";
          return;
        }
        const savedValue = drafts[id] ?? snapshot?.workbookResponses?.[id]?.value ?? "";
        if (field instanceof HTMLInputElement && field.type === "checkbox") {
          field.checked = savedValue === "true" || savedValue === field.value;
        } else if (field instanceof HTMLInputElement && field.type === "radio") {
          field.checked = savedValue === field.value;
        } else {
          field.value = savedValue;
        }
        if (field.dataset.purpose === "FORMAL_LAB_REFERENCE") {
          field.disabled = true;
          if ("placeholder" in field) field.placeholder = "Captured in the live Lab";
        }
      });
  }, [
    drafts,
    knownValues,
    learnMode,
    moduleCode,
    moduleLabIsLive,
    page,
    programme?.edition,
    facilitatorGuide,
    facilitatorMode,
    readOnlyMode,
    selected,
    dayThreeIndex,
    section,
    snapshot?.profile.deliveryEdition,
    snapshot?.profile.displayName,
    snapshot?.workbookResponses,
    sessionDesign,
  ]);

  useLayoutEffect(() => {
    restoreHandbookInteractions();
  }, [restoreHandbookInteractions]);

  useEffect(() => {
    if (!page || section !== "learn" || learnMode !== "reader") return;
    const documentRoot = documentRef.current;
    if (!documentRoot || typeof MutationObserver === "undefined") return;

    let repairQueued = false;
    const observer = new MutationObserver((mutations) => {
      const contentChanged = mutations.some((mutation) => mutation.type === "childList");
      if (!contentChanged || repairQueued) return;
      repairQueued = true;
      queueMicrotask(() => {
        repairQueued = false;
        restoreHandbookInteractions();
      });
    });

    observer.observe(documentRoot, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [learnMode, page, restoreHandbookInteractions, section]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(() => void saveDirtyResponses(), 900);
    return () => clearTimeout(timer);
  }, [saveDirtyResponses, saveState]);

  function onDocumentInput(event: FormEvent<HTMLElement>) {
    if (facilitatorMode) return;
    const target = event.target;
    if (
      !(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement) ||
      !target.dataset.fieldId ||
      target.dataset.purpose === "FORMAL_LAB_REFERENCE"
    ) {
      return;
    }
    if (!page || !target.dataset.sourceKey) return;
    const value = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked ? (target.value || "true") : ""
      : target.value;
    if (previewMode) {
      setDrafts((current) => ({ ...current, [target.dataset.fieldId!]: value }));
      return;
    }
    queue.current.edit({
      semanticFieldId: target.dataset.fieldId,
      semanticStepId: page.id,
      sourceFieldKey: target.dataset.sourceKey,
      value,
      purpose: target.dataset.purpose,
      checkId: target.dataset.checkId,
      checkKind: target.dataset.checkKind,
      privacyClass: target.dataset.privacyClass,
    });
    setDrafts((current) => ({ ...current, [target.dataset.fieldId!]: value }));
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
    if (!page || saving || completing) return;
    if (readOnlyMode) {
      if (programme && selected < programme.treatment.pages.length - 1) {
        goToProgrammePage(selected + 1);
      }
      return;
    }
    if (!release) return;
    if (labSequenceLocked) {
      setError(
        moduleLabIsLive
          ? `Record today’s Investigation 7 evidence in ${moduleLabTitle} before continuing the programme.`
          : `${moduleLabTitle} is the next programme step. The live Lab is still being prepared.`,
      );
      return;
    }

    setCompleting(true);
    if (!(await saveDirtyResponses())) { setCompleting(false); return; }
    setSaving(true);
    setError("");

    let nextPageIndex: number | null = null;
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
        nextPageIndex = selected + 1;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Programme progress could not be saved.");
    } finally {
      setSaving(false);
      setCompleting(false);
    }

    if (nextPageIndex !== null) {
      window.setTimeout(() => goToProgrammePage(nextPageIndex!), 0);
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

  const isLabHandoffDay =
    page.programmeDay === BIS_MODULE_TEMPLATE.handoffProgrammeDay || page.key === "Day 3";
  const dayThree = isLabHandoffDay ? splitDayThree(page) : null;
  const learningReturnTo = `${pathname}?section=learn&page=${selected + 1}`;
  const moduleLabHref = moduleLabIsLive && resolvedLabHref
    ? labHrefWithReturn(resolvedLabHref, learningReturnTo)
    : null;
  const moduleLabTitle = moduleDefinition?.title ?? `${programme.title} Lab`;

  return (
    <EditionLanguageScope edition={snapshot.profile.deliveryEdition}>
    <div className={`prototype-player ${facilitatorMode ? "facilitator-viewer" : ""}`} data-edition={snapshot.profile.deliveryEdition}>
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
          {facilitatorMode && facilitatorContext ? (
            <>
              <strong>Facilitator view · {facilitatorContext.cohortName}</strong>
              <Link className="prototype-facilitator-return" href={facilitatorContext.returnTo}><ArrowLeft /> Back to group</Link>
            </>
          ) : previewMode ? (
            <strong>Preview mode · nothing here is saved to learner records</strong>
          ) : labExperimentStarted && experimentDay ? (
            <strong>Experiment Day {experimentDay} of {experimentTotalDays}</strong>
          ) : null}
        </div>
      </header>

      <main className="prototype-main">
        {section === "today" ? (
          <section className="prototype-page prototype-today">
            <div className="prototype-today-hero">
              <div>
                <p className="prototype-eyebrow">Today · {programme.title}</p>
                <h1>{facilitatorMode ? "Learner experience." : `Good to see you, ${firstName}.`}</h1>
                <p>
                  {facilitatorMode
                    ? "This is the same learning environment your group uses. Facilitation cues are added only for you; learner answers remain private."
                    : "Your programme, Lab and field experiment are one journey. This screen tells you what needs your attention now; it does not create another navigation system."}
                </p>
              </div>
              <div className="prototype-today-status">
                <span>{page.programmeDay ? `Programme Day ${page.programmeDay} of 10` : page.key}</span>
                <strong>{page.label}</strong>
                {facilitatorMode ? (
                  <small>Individual learner progress is not shown in facilitator view.</small>
                ) : (
                  <>
                    <div className="prototype-progress-track">
                      <i style={{ width: `${progressPercent}%` }} />
                    </div>
                    <small>{progressPercent}% of this handbook reviewed</small>
                  </>
                )}
              </div>
            </div>

            <div className="prototype-dashboard-grid">
              {facilitatorMode && facilitatorGuide ? (
                <article className="prototype-card facilitator-dashboard-cue facilitator-run-sheet">
                  <div className="facilitator-run-sheet-head">
                    <div>
                      <p className="prototype-eyebrow">Facilitation plan · Day {page.programmeDay}</p>
                      <h2>{facilitatorGuide.dayPurpose}</h2>
                      <p>{facilitatorGuide.description}</p>
                    </div>
                    <span>{facilitatorGuide.minutes} min</span>
                  </div>

                  <div className="facilitator-run-sheet-outcome">
                    <span>By the end</span>
                    <strong>{facilitatorGuide.learnerOutcome}</strong>
                  </div>

                  <div className="facilitator-run-sheet-flow" aria-label="45-minute facilitation flow">
                    {facilitatorGuide.beats.map((beat) => (
                      <div key={beat.label}>
                        <strong>{beat.minutes} min</strong>
                        <span>{beat.label}</span>
                      </div>
                    ))}
                  </div>

                  <details className="facilitator-run-sheet-details">
                    <summary>How to lead this session</summary>
                    <div className="facilitator-run-sheet-detail-grid">
                      <section>
                        <span>Start here</span>
                        <p>{facilitatorGuide.openingMove}</p>
                      </section>
                      <section>
                        <span>Facilitator moves</span>
                        {facilitatorGuide.facilitatorMoves.map((move) => <p key={move}>{move}</p>)}
                      </section>
                      <section>
                        <span>Watch for</span>
                        {facilitatorGuide.watchFor.map((warning) => <p key={warning}>{warning}</p>)}
                      </section>
                      <section>
                        <span>Context</span>
                        <p>{facilitatorGuide.applicationFrame}</p>
                        <p>{facilitatorGuide.readingTreatment}</p>
                      </section>
                    </div>
                  </details>

                  <div className="facilitator-run-sheet-privacy">
                    <ShieldCheck />
                    <span>The learner page stays read-only here. Responses remain private; you see the same content plus facilitation cues only.</span>
                  </div>
                </article>
              ) : facilitatorMode ? (
                <article className="prototype-card facilitator-dashboard-cue">
                  <p className="prototype-eyebrow">Facilitator view</p>
                  <h2>Lead from the page they are using.</h2>
                  <p>Open the learning page below. Green facilitator cues appear only for you.</p>
                </article>
              ) : null}
              <article className="prototype-card prototype-journey-card">
                <p className="prototype-eyebrow">Continue your programme</p>
                <h2>{page.label}</h2>
                <p>{page.experimentPosition || "Your handbook is ready where you left off."}</p>
                {facilitatorMode && sessionDesign ? <small>{sessionDesign.minutes}-minute learning session · learn, check, apply and reflect</small> : null}
                <button type="button" className="prototype-btn primary" onClick={() => openLearn("reader")}>
                  Continue learning <ArrowRight />
                </button>
              </article>

              {isLabHandoffDay ? (
                <article className="prototype-card prototype-action-card">
                  <FlaskConical />
                  <p className="prototype-eyebrow">Day 3 · Lab handover</p>
                  <h3>
                    {moduleLabHref
                      ? `${moduleLabTitle} is ready.`
                      : `${moduleLabTitle} is the next step.`}
                  </h3>
                  <p>
                    {moduleLabHref
                      ? "Move from the handbook into the practical Lab, then return here to continue your programme."
                      : "This is still the programme’s Lab handover point. The live Lab is being prepared, so continue with today’s learning for now."}
                  </p>
                  {moduleLabHref ? (
                    <Link className="prototype-btn primary" href={moduleLabHref}>
                      {moduleCode === "HAB" && labExperimentStarted ? "Return to Habit Lab" : `Open ${moduleLabTitle}`}
                      <ArrowRight />
                    </Link>
                  ) : (
                    <span className="prototype-btn soft prototype-btn-disabled">Lab coming soon</span>
                  )}
                </article>
              ) : null}

              {labCompleted ? (
                <article className="prototype-card prototype-action-card prototype-experiment-status" role="status">
                  <Check />
                  <div>
                    <p className="prototype-eyebrow">Lab complete</p>
                    <h3>Your evidence record is ready.</h3>
                    <p>
                      BIS has connected your recorded evidence to the measures it can calculate. Your private wording stays in the Lab; the portfolio shows the evidence structure and derived results.
                    </p>
                  </div>
                  <Link className="prototype-btn soft" href="/profile#evidence-portfolio">
                    View my evidence portfolio <ArrowRight />
                  </Link>
                </article>
              ) : labReviewReady && moduleLabIsLive ? (
                <article className="prototype-card prototype-action-card prototype-evidence-due" role="status">
                  <FlaskConical />
                  <div>
                    <p className="prototype-eyebrow">Phase B complete · Evidence Review</p>
                    <h3>Your real-world test is ready to review.</h3>
                    <p>
                      Review what actually happened, compare it with your prediction, complete the post-measures, and close the Lab before the final programme handback.
                    </p>
                  </div>
                  <Link
                    className="prototype-btn primary"
                    href={
                      moduleCode === "HAB"
                        ? labHrefWithReturn("/habit-lab", learningReturnTo)
                        : labHrefWithStep(moduleLabHref ?? "/labs", programmeHandoff?.reviewInvestigation ?? 8)
                    }
                  >
                    Review my evidence <ArrowRight />
                  </Link>
                </article>
              ) : labExperimentStarted
                && moduleLabIsLive
                && experimentTotalDays > 0
                && programmeHandoff
                && programmeHandoff.currentDay > 0
                && programmeHandoff.currentDay <= programmeHandoff.totalDays
                && !programmeHandoff.todayEvidenceRecorded ? (
                <article className="prototype-card prototype-action-card prototype-evidence-due" role="status">
                  <CalendarDays />
                  <div>
                    <p className="prototype-eyebrow">Today’s Lab evidence · Investigation 7</p>
                    <h3>Experiment Day {experimentDay ?? programmeHandoff.currentDay} is ready.</h3>
                    <p>
                      {programmeHandoff.evidenceWindowCount ? "Record your observations for the current week. The next weekly entry opens on its calendar date; missed entries remain missing." : "Record only what happened today. Tomorrow’s evidence opens tomorrow; an unrecorded past day remains missing evidence."}
                    </p>
                  </div>
                  <Link
                    className="prototype-btn primary"
                    href={
                      moduleCode === "HAB"
                        ? labHrefWithReturn("/habit-lab/experiment", learningReturnTo)
                        : moduleLabHref ?? "/labs"
                    }
                  >
                    {programmeHandoff.evidenceWindowCount ? "Capture this week’s evidence" : "Capture today’s evidence"} <ArrowRight />
                  </Link>
                </article>
              ) : labExperimentStarted && moduleLabIsLive && experimentTotalDays > 0 ? (
                <article className="prototype-card prototype-action-card prototype-experiment-status">
                  <CalendarDays />
                  <p className="prototype-eyebrow">Real-world test</p>
                  <h3>{experimentRecordedDays}/{programmeHandoff?.evidenceWindowCount ?? experimentTotalDays} {programmeHandoff?.evidenceWindowCount ? "weekly entries" : "observation days"} recorded.</h3>
                  <p>
                    {programmeHandoff?.todayEvidenceRecorded
                      ? `Experiment Day ${experimentDay ?? programmeHandoff.currentDay} is recorded. Your next evidence window opens on its calendar day.`
                      : "The experiment has its own clock. Only the current calendar day can be recorded."}
                  </p>
                  <Link
                    className="prototype-btn soft"
                    href={
                      moduleCode === "HAB"
                        ? labHrefWithReturn("/habit-lab/experiment", learningReturnTo)
                        : moduleLabHref ?? "/labs"
                    }
                  >
                    Review experiment <ArrowRight />
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
            <Link className="prototype-back-link" href={facilitatorMode && facilitatorContext ? facilitatorContext.returnTo : previewMode ? "/content-studio" : "/learn"}>
              {facilitatorMode ? <><ArrowLeft /> Back to facilitator</> : <><ArrowLeft /> Exit reader</>}
            </Link>

            <div className="prototype-reader-hero prototype-reader-hero-compact">
              <div className="prototype-reader-compact-head">
                <div>
                  <p className="prototype-eyebrow">{programme.subtitle}</p>
                  <h1>{page.programmeDay ? `Day ${page.programmeDay} of 10` : page.key}</h1>
                </div>
                <strong>{facilitatorMode ? "VIEW" : `${progressPercent}%`}</strong>
              </div>
              {page.experimentPosition ? (
                <p className="prototype-reader-position">{page.experimentPosition}</p>
              ) : null}
              {!facilitatorMode ? (
                <div className="prototype-progress-track light">
                  <i style={{ width: `${progressPercent}%` }} />
                </div>
              ) : null}
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
                    onClick={() => goToProgrammePage(index)}
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
              {facilitatorMode
                ? "Facilitator view · learner responses are private and are not shown or saved here"
                : previewMode
                  ? "Preview mode · test answers stay in this browser only"
                : saveState === "saving"
                  ? "Saving workbook responses…"
                  : saveState === "dirty"
                    ? "Changes waiting to save…"
                    : saveState === "error" ? "Not saved — retry before leaving" : "Workbook responses saved"}
              {!readOnlyMode && saveState === "error" ? <button type="button" onClick={() => void saveDirtyResponses()}>Retry save</button> : null}
            </div>

            {labSequenceLocked && selected > dayThreeIndex ? (
              <section className="prototype-sequence-notice" role="note">
                <LockKeyhole />
                <div>
                  <strong>Reference view</strong>
                  <p>
                    {moduleLabIsLive
                      ? `This page belongs after the first Investigation 7 evidence in ${moduleLabTitle}. You can read it now, but programme progress resumes after that Lab handback.`
                      : `This page belongs after ${moduleLabTitle}. Digital Lab access is not enabled for this programme yet, so this page is shown for reference only.`}
                  </p>
                </div>
              </section>
            ) : null}

            {facilitatorMode && facilitatorGuide ? (
              <aside className="facilitator-inline-cue facilitator-inline-cue-start" role="note">
                <span>Facilitator cue</span>
                <strong>Read together, then ask before you explain.</strong>
                <p>{facilitatorGuide.openingMove}</p>
                <small>Invite one learner to read the next short section aloud. Stop at the key idea and ask the room what they noticed first.</small>
              </aside>
            ) : null}

            <fieldset className="workbook-fields" disabled={completing || (labSequenceLocked && selected > dayThreeIndex)}>
            <article key={page.id} ref={documentRef} className="prototype-document" onInput={onDocumentInput} onChange={onDocumentInput}>
              {dayThree ? (
                <>
                  <div dangerouslySetInnerHTML={{ __html: dayThree.intro }} />
                  <ProgrammeLabHandoff
                    title={moduleLabTitle}
                    href={moduleLabHref}
                    status={moduleDefinition?.labStatus ?? "catalogued"}
                    isHabit={moduleCode === "HAB"}
                    habitPhaseAComplete={labExperimentStarted}
                  />
                  <details className="prototype-reference">
                    <summary>{moduleLabHref ? "Open the full Day 3 reference" : "Continue with the Day 3 learning"}</summary>
                    <p>
                      {moduleLabHref
                        ? `Use this as your learning reference while you work through ${moduleLabTitle}.`
                        : "The practical Lab connects at this point. Continue with today’s learning material here until digital Lab access is enabled."}
                    </p>
                    <div dangerouslySetInnerHTML={{ __html: dayThree.reference }} />
                  </details>
                  {!labHandoffComplete ? (
                    <section className="prototype-after-lab">
                      <LockKeyhole />
                      <div>
                        <strong>
                          {moduleLabIsLive
                            ? `Record today’s Investigation 7 evidence in ${moduleLabTitle} to continue.`
                            : "The practical Lab completes this Day 3 sequence."}
                        </strong>
                        <p>
                          {moduleLabIsLive
                            ? "Only one experiment day is open at a time. Save today’s finding in the Lab and BIS will return you here to finish Day 3."
                            : "Until digital Lab access is enabled, later programme pages remain available as reference rather than completed programme progress."}
                        </p>
                      </div>
                    </section>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: dayThree.tail }} />
                  )}
                </>
              ) : isLabHandoffDay ? (
                <>
                  <ProgrammeLabHandoff
                    title={moduleLabTitle}
                    href={moduleLabHref}
                    status={moduleDefinition?.labStatus ?? "catalogued"}
                    isHabit={moduleCode === "HAB"}
                    habitPhaseAComplete={labExperimentStarted}
                  />
                  <div dangerouslySetInnerHTML={{ __html: page.html }} />
                </>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: page.html }} />
              )}
            </article>
            </fieldset>

            {facilitatorMode && facilitatorGuide ? (
              <aside className="facilitator-inline-cue facilitator-inline-cue-close" role="note">
                <span>Facilitator cue · close</span>
                <strong>End with the learner, not with another explanation.</strong>
                <p>{facilitatorGuide.closeMove}</p>
              </aside>
            ) : null}

            {page.key === "Certificate" && completed.has(page.id) ? (
              <section className="handbook-next" aria-label="Continue learning">
                <h2>Choose your next handbook</h2>
                <p>Your page review is saved. All five handbooks are open; choose any one.</p>
                <div>{BIS_MODULES.filter((item) => item.learningStatus === "live" && item.code !== moduleCode).map((item) => <Link key={item.code} href={item.learningHref!}>{item.title}<ArrowRight /></Link>)}</div>
              </section>
            ) : null}
            {error ? (
              <p className="prototype-error" role="alert">
                {error}
              </p>
            ) : null}

            <footer className="prototype-reader-footer">
              <button
                type="button"
                onClick={() => goToProgrammePage(selected - 1)}
                disabled={selected === 0 || completing}
              >
                <ArrowLeft /> Previous
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void completePage()}
                disabled={saving || completing || labSequenceLocked}
              >
                {facilitatorMode
                  ? selected === programme.treatment.pages.length - 1 ? "End of learner experience" : "Next page"
                  : previewMode
                    ? selected === programme.treatment.pages.length - 1 ? "Preview complete" : "Next preview page"
                    : labSequenceLocked
                    ? moduleLabIsLive ? "Record Lab evidence first" : "Continue after the Lab"
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
              <small>{facilitatorMode ? "Facilitator learner view" : "Learner menu"}</small>
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
            onClick={() => {
              if (facilitatorMode) {
                openLearn("library");
                return;
              }
              void saveDirtyResponses().then((saved) => { if (saved) router.push("/learn"); });
            }}
          >
            <BookOpen />
            <span><strong>Learn</strong><small>{facilitatorMode ? "Stay in this programme" : "Browse handbooks"}</small></span>
          </button>
          <Link href={moduleLabHref ?? "/labs"}>
            <FlaskConical />
            <span>
              <strong>Lab</strong>
              <small>{moduleLabHref ? moduleLabTitle : "Browse investigations"}</small>
            </span>
          </Link>
          {moduleCode === "HAB" ? (
            <Link href={labHrefWithReturn("/habit-lab/experiment", learningReturnTo)}>
              <CalendarDays />
              <span><strong>Experiment</strong><small>Seven-day real-world test</small></span>
            </Link>
          ) : moduleLabHref ? (
            <Link href={moduleLabHref}>
              <CalendarDays />
              <span><strong>Practice</strong><small>Continue the live Lab</small></span>
            </Link>
          ) : null}
          {hasStaffAccess ? (
            <Link href={facilitatorMode && facilitatorContext ? facilitatorContext.returnTo : "/workspace"}>
              <BriefcaseBusiness />
              <span><strong>{facilitatorMode ? "Back to facilitator" : "Staff workspace"}</strong><small>{facilitatorMode ? "Return to your group" : "Tools for your programme role"}</small></span>
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
    </EditionLanguageScope>
  );
}

