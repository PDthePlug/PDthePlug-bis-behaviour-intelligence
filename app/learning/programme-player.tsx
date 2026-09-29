"use client";

import { BisMark } from "@/components/brand/bis-mark";

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
  X,
} from "lucide-react";
import { BIS_MODULES, BIS_MODULE_TEMPLATE } from "../../lib/bis-catalogue";
import { WorkbookSaveQueue } from "../../lib/workbook-save-queue";
import { enhanceHandbookDocument, type HandbookKnownValue } from "./handbook-document-enhancements";
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

function ProgrammeLabHandoff({
  title,
  href,
  isHabit,
  habitPhaseAComplete,
}: {
  title: string;
  href: string | null;
  isHabit: boolean;
  habitPhaseAComplete: boolean;
}) {
  return (
    <section className={`prototype-lab-handoff ${href ? "live" : "planned"}`}>
      <div>
        <p>DAY 3 · LAB HANDOVER</p>
        <h2>{href ? `Continue into ${title}.` : `${title} is the next step.`}</h2>
        <span>
          {href
            ? isHabit
              ? "The handbook stays here as your learning reference. You’ll set your plan, start the seven-day test and record your observations once inside Habit Lab."
              : "Day 3 is where the learning moves into the practical Lab. Begin the Lab here, then return to this learning module to continue the programme."
            : "Day 3 is still the Lab handover point in this programme. The live Lab is being prepared, so continue with the Day 3 learning material for now."}
        </span>
      </div>
      {href ? (
        <Link href={href}>
          {isHabit
            ? habitPhaseAComplete ? "Return to Habit Lab" : "Open Habit Lab Phase A"
            : `Open ${title}`}
          <ArrowRight />
        </Link>
      ) : (
        <span className="prototype-lab-status">Lab coming soon</span>
      )}
    </section>
  );
}

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

async function loadProgramme(edition: Edition, code: string): Promise<HabitProgramme> {
  const dynamic = await fetch(
    `/api/runtime-content?kind=LEARNING_MODULE&code=${encodeURIComponent(code)}&edition=${edition}`,
    { cache: "no-store" },
  );
  if (dynamic.ok) {
    const result = await dynamic.json() as { payload: HabitProgramme };
    return result.payload;
  }

  const slug = ({ HAB: "habit", DEC: "decision", MON: "money", IDN: "identity", ATT: "attention" } as Record<string, string>)[code];
  if (!slug) {
    const detail = await dynamic.json().catch(() => null) as { error?: string } | null;
    throw new Error(detail?.error || "The active learning module could not be loaded.");
  }

  const response = await fetch(`/handbooks/v1/${slug}-${edition}.json.gz.b64`, {
    cache: "force-cache",
  });
  if (!response.ok) throw new Error("The complete handbook material could not be loaded.");
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("This browser cannot open the compressed programme material.");
  }
  const binary = atob((await response.text()).trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const stream = new Blob([bytes.buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as HabitProgramme;
}

export function ProgrammePlayer({
  moduleCode = "HAB",
  initialSection = "today",
  initialLearnMode = "library",
  previewVersionId,
  previewEdition,
}: {
  moduleCode?: string;
  initialSection?: AppSection;
  initialLearnMode?: LearnMode;
  previewVersionId?: string;
  previewEdition?: Edition;
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

        if (previewVersionId && previewEdition) {
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
          const moduleRuntimePromise = ["DEC", "MON"].includes(moduleCode)
            ? fetch(`/api/labs?lab=${encodeURIComponent(moduleCode)}`, {
                cache: "no-store",
                signal: controller.signal,
              })
                .then(async (response) => response.ok ? await response.json() as Runtime : null)
                .catch(() => null)
            : Promise.resolve<Runtime | null>(null);

          const [learningResponse, runtimeResponse, moduleRuntimeResult] = await Promise.all([
            fetch(`/api/learning?lab=${moduleCode}`, { cache: "no-store", signal: controller.signal }),
            fetch("/api/bis", { cache: "no-store", signal: controller.signal }),
            moduleRuntimePromise,
          ]);
          learning = (await learningResponse.json()) as LearningSnapshot & { error?: string };
          if (!learningResponse.ok) {
            throw new Error((learning as LearningSnapshot & { error?: string }).error || "Your learning record could not be loaded.");
          }

          live = runtimeResponse.ok
            ? await runtimeResponse.json() as Runtime
            : emptyRuntime();
          moduleLive = moduleCode === "HAB" ? live : moduleRuntimeResult;
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
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "The programme could not be opened.",
          );
        }
      }
    })();
    return () => controller.abort();
  }, [moduleCode, previewEdition, previewVersionId]);

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
  const activeModuleRuntime = moduleCode === "HAB" ? runtime : moduleRuntime;
  const experimentDay = currentExperimentDay(activeModuleRuntime?.experiment ?? null);
  const labPhaseAComplete =
    previewMode ||
    Boolean(activeModuleRuntime?.enrolment?.phaseACompletedAt || activeModuleRuntime?.experiment);
  const dayThreeIndex = programme?.treatment.pages.findIndex((item) => item.key === "Day 3") ?? -1;
  const labSequenceLocked =
    !previewMode &&
    !labPhaseAComplete &&
    dayThreeIndex >= 0 &&
    selected >= dayThreeIndex;
  const knownValues = useMemo<HandbookKnownValue[]>(() => {
    const source = activeModuleRuntime;
    if (!source?.experiment) return [];

    const values: HandbookKnownValue[] = [];
    const add = (labels: string[], value: number | string | null, suffix = "", note = "From your Lab") => {
      if (value === null || value === undefined || value === "") return;
      values.push({ labels, value: `${value}${suffix}`, source: note });
    };

    const observedDays = new Set(source.events.map((event) => event.dayNumber)).size;
    const missingDays = Math.max(0, 7 - observedDays);
    const eligible = metricNumber(source, `${moduleCode}.EXPERIMENT.OPPORTUNITY_COUNT`)
      ?? source.events.filter((event) => event.eligibleOpportunity).length;
    const completed = moduleCode === "HAB"
      ? metricNumber(source, "HAB.EXPERIMENT.REPLACEMENT_COUNT")
      : metricNumber(source, `${moduleCode}.EXPERIMENT.PAUSE_COUNT`);
    const adherence = metricNumber(source, `${moduleCode}.BEI06`);
    const accuracy = metricNumber(source, `${moduleCode}.BEI03`);
    const predicted = Number(source.experiment.predictedValue);
    const predictedValue = Number.isFinite(predicted) ? predicted : null;

    add(["Observation days completed"], observedDays, " / 7");
    add(["Missing / unrecorded days", "Missing days"], missingDays, " / 7");
    add(
      [
        "Eligible target opportunities observed",
        "Eligible opportunities observed",
        "Eligible spending moments observed",
        "Eligible decision opportunities observed",
      ],
      eligible,
    );

    if (moduleCode === "HAB") {
      add(
        ["Completed replacements", "Replacement routine completed", "Successful replacements"],
        completed,
      );
      add(["Adherence Rate", "Habit Adherence Rate"], adherence, "%");
      add(["Prediction Accuracy", "Habit Prediction Accuracy"], accuracy, " / 100");
      add(["Predicted Adherence Rate", "Predicted Replacement Rate"], predictedValue, "%");
    }

    if (moduleCode === "DEC") {
      add(
        ["Decision Pauses Completed", "Decision process checks completed", "Pauses completed"],
        completed,
      );
      add(["Decision Process Adherence Rate", "Pause Initiation Rate"], adherence, "%");
      add(["Decision Process Prediction Accuracy", "Prediction Accuracy"], accuracy, " / 100");
      add(["Predicted Decision Pause Rate", "Predicted Outcome Rate"], predictedValue, "%");
      add(["Option Expansion Count"], metricNumber(source, "DEC.OPTION_EXPANSION_COUNT"));
      add(["Option Expansion Rate"], metricNumber(source, "DEC.OPTION_EXPANSION_RATE"), "%");
    }

    if (moduleCode === "MON") {
      const full = metricNumber(source, "MON.FULL_PAUSE_COUNT");
      const minimum = metricNumber(source, "MON.MINIMUM_PAUSE_COUNT");
      const fullRate = eligible > 0 && full !== null ? Math.round((full / eligible) * 100) : null;
      add(["Pauses initiated (Minimum or Full)", "Attention Checks completed (Minimum or Full)"], completed);
      add(["Pause Initiation Rate"], adherence, "%");
      add(["Full Pauses completed"], full);
      add(["Minimum Pauses completed"], minimum);
      add(["Full Pause Completion Rate"], fullRate, "%");
      add(["Spending Pause Prediction Accuracy", "Prediction Accuracy"], accuracy, " / 100");
      add(["Predicted Pause Rate", "Predicted Outcome Rate"], predictedValue, "%");
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
  const firstName = snapshot?.profile.displayName?.split(" ")[0] || "Investigator";
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
    if (previewMode) return true;
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
  }, [mergeSnapshot, previewMode, programme, release]);

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
      workbookId: programme?.handbookId,
    });
    documentRoot
      .querySelectorAll<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>("[data-field-id]")
      .forEach((field) => {
        const id = field.dataset.fieldId;
        if (!id) return;
        const savedValue = drafts[id] ?? snapshot?.workbookResponses?.[id]?.value ?? "";
        if (field instanceof HTMLInputElement && field.type === "checkbox") {
          field.checked = savedValue === "true" || savedValue === field.value;
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
    page,
    programme?.handbookId,
    section,
    snapshot?.profile.displayName,
    snapshot?.workbookResponses,
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
  }, [learnMode, page?.id, restoreHandbookInteractions, section]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(() => void saveDirtyResponses(), 900);
    return () => clearTimeout(timer);
  }, [saveDirtyResponses, saveState]);

  function onDocumentInput(event: FormEvent<HTMLElement>) {
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
    queue.current.edit({ semanticFieldId: target.dataset.fieldId, semanticStepId: page.id, sourceFieldKey: target.dataset.sourceKey, value });
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
    if (previewMode) {
      if (programme && selected < programme.treatment.pages.length - 1) {
        goToProgrammePage(selected + 1);
      }
      return;
    }
    if (!release) return;
    if (labSequenceLocked) {
      setError(
        moduleLabIsLive
          ? `Complete ${moduleLabTitle} Phase A before continuing the programme.`
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

  const moduleDefinition = BIS_MODULES.find((item) => item.code === moduleCode) ?? null;
  const isLabHandoffDay =
    page.programmeDay === BIS_MODULE_TEMPLATE.handoffProgrammeDay || page.key === "Day 3";
  const dayThree = isLabHandoffDay ? splitDayThree(page) : null;
  const moduleLabIsLive = moduleDefinition?.labStatus === "live" && Boolean(moduleDefinition.labHref);
  const learningReturnTo = `${pathname}?section=learn&page=${selected + 1}`;
  const moduleLabHref = moduleLabIsLive && moduleDefinition?.labHref
    ? labHrefWithReturn(moduleDefinition.labHref, learningReturnTo)
    : null;
  const moduleLabTitle = moduleDefinition?.title ?? `${programme.title} Lab`;

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
          {previewMode ? (
            <strong>Preview mode · nothing here is saved to learner records</strong>
          ) : runtime.experiment?.status === "ACTIVE" && experimentDay ? (
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
                <p>{page.experimentPosition || "Your handbook is ready where you left off."}</p>
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
                      {moduleCode === "HAB" && labPhaseAComplete ? "Return to Habit Lab" : `Open ${moduleLabTitle}`}
                      <ArrowRight />
                    </Link>
                  ) : (
                    <span className="prototype-btn soft prototype-btn-disabled">Lab coming soon</span>
                  )}
                </article>
              ) : null}

              {moduleCode === "HAB" && runtime.experiment ? (
                <article className="prototype-card prototype-action-card">
                  <CalendarDays />
                  <p className="prototype-eyebrow">Real-world test</p>
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
            <Link className="prototype-back-link" href={previewMode ? "/content-studio" : "/learn"}>
              <ArrowLeft /> Exit reader
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
              {previewMode
                ? "Preview mode · test answers stay in this browser only"
                : saveState === "saving"
                  ? "Saving workbook responses…"
                  : saveState === "dirty"
                    ? "Changes waiting to save…"
                    : saveState === "error" ? "Not saved — retry before leaving" : "Workbook responses saved"}
              {!previewMode && saveState === "error" ? <button type="button" onClick={() => void saveDirtyResponses()}>Retry save</button> : null}
            </div>

            {labSequenceLocked && selected > dayThreeIndex ? (
              <section className="prototype-sequence-notice" role="note">
                <LockKeyhole />
                <div>
                  <strong>Reference view</strong>
                  <p>
                    {moduleLabIsLive
                      ? `This page belongs after ${moduleLabTitle} Phase A. You can read it now, but programme progress resumes after the Lab.`
                      : `This page belongs after ${moduleLabTitle}. The live Lab is still being prepared, so this page is shown for reference only.`}
                  </p>
                </div>
              </section>
            ) : null}

            <fieldset className="workbook-fields" disabled={completing}>
            <article key={page.id} ref={documentRef} className="prototype-document" onInput={onDocumentInput} onChange={onDocumentInput}>
              {dayThree ? (
                <>
                  <div dangerouslySetInnerHTML={{ __html: dayThree.intro }} />
                  <ProgrammeLabHandoff
                    title={moduleLabTitle}
                    href={moduleLabHref}
                    isHabit={moduleCode === "HAB"}
                    habitPhaseAComplete={labPhaseAComplete}
                  />
                  <details className="prototype-reference">
                    <summary>Open the full Day 3 reference</summary>
                    <p>
                      {moduleLabHref
                        ? `Use this as your learning reference while you work through ${moduleLabTitle}.`
                        : "Use this as your Day 3 learning reference while the live Lab is being prepared."}
                    </p>
                    <div dangerouslySetInnerHTML={{ __html: dayThree.reference }} />
                  </details>
                  {!labPhaseAComplete ? (
                    <section className="prototype-after-lab">
                      <LockKeyhole />
                      <div>
                        <strong>
                          {moduleLabIsLive
                            ? `Finish ${moduleLabTitle} Phase A to continue.`
                            : `${moduleLabTitle} is required before the programme continues.`}
                        </strong>
                        <p>
                          {moduleLabIsLive
                            ? "Your seven-day investigation begins when the live Lab phase is complete."
                            : "The live Lab is being prepared. The remaining programme pages stay available as reference only for now."}
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
                    isHabit={moduleCode === "HAB"}
                    habitPhaseAComplete={labPhaseAComplete}
                  />
                  <div dangerouslySetInnerHTML={{ __html: page.html }} />
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
                {previewMode
                  ? selected === programme.treatment.pages.length - 1 ? "Preview complete" : "Next preview page"
                  : labSequenceLocked
                    ? moduleLabIsLive ? "Complete the Lab first" : "Lab coming soon"
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
            <Link href="/workspace">
              <BriefcaseBusiness />
              <span><strong>Staff workspace</strong><small>Tools for your programme role</small></span>
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


