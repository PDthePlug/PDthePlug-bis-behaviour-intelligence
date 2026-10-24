import type { UniversalAuthoredDocumentDefinition } from "./universal-authored-document.mjs";

export type ProgrammePhase =
  | "ORIENTATION"
  | "LEARN"
  | "LAB"
  | "LEARN_EXPERIMENT"
  | "EXPERIMENT"
  | "REVIEW"
  | "TRANSFER"
  | "INTEGRATE"
  | "CERTIFICATE";

export type ProgrammePage = {
  id: string;
  key: string;
  label: string;
  phase: ProgrammePhase;
  programmeDay: number | null;
  experimentPosition: string | null;
  html: string;
  document?: UniversalAuthoredDocumentDefinition;
  labHandoff?: {
    startMarker: string;
    endMarker: string;
  };
};

export type HabitProgramme = {
  experimentSchedule?: {
    durationDays: number;
    startsAfterProgrammeDay: number;
    interimReviewProgrammeDays: number[];
    finalReviewAfterExperimentDay: number;
    continuesAfterTouchpoints: boolean;
    observationWindows?: Array<{ window: number; startDay: number; endDay: number }>;
  };
  schemaVersion: "2.0";
  handbookId: string;
  labCode: string;
  slug: string;
  title: string;
  subtitle: string;
  contentVersion: string;
  runtimeVersion: string;
  sourceTrace: {
    authority: string;
    prototype: string;
    rule: string;
  };
  edition: "school" | "emerging_adult" | "workplace";
  treatment: {
    label: string;
    sourceId: string;
    contentHash: string;
    privacySummary: string;
    pages: ProgrammePage[];
  };
};

