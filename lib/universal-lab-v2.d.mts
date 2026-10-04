import type { UniversalEditorialAudit } from "./universal-lab-standard.mjs";

export type UniversalComputedOperation =
  | "PRODUCT"
  | "DIFFERENCE"
  | "COUNT_TRUE"
  | "COUNT_PRESENT"
  | "MAX"
  | "COPY"
  | "COLLECTION"
  | "PAIR";

export type UniversalComputedField = {
  id: string;
  label: string;
  investigation: number;
  operation: UniversalComputedOperation;
  inputs: string[];
  legacyInputs?: string[];
  precision?: number;
};

export type UniversalExperimentContract = {
  investigation: number;
  startAfterInvestigation: number;
  days: number;
  cadence?: "WEEKLY";
  reviewInvestigation: number;
  scheduledPromptIds: Array<{ day: number; endDay?: number; promptId: string }>;
};

export type UniversalProfileEntry = {
  label: string;
  promptId: string;
  mode: "PROJECTION" | "INPUT";
};

export type UniversalIndicatorBinding = {
  code: string;
  label: string;
  investigationNumbers: number[];
  promptIds: string[];
  computedPromptIds: string[];
  primaryPromptId: string | null;
  status: "BOUND" | "UNBOUND" | "NOT_COLLECTED";
};

export type UniversalV2Additions = {
  standardVersion: string;
  editorialAudit: UniversalEditorialAudit;
  schemaVersion: "universal-lab-v2";
  runtimeProfile: "UNIVERSAL_V2";
  computedFields: UniversalComputedField[];
  indicatorRegistry: UniversalIndicatorBinding[];
  experiment: UniversalExperimentContract | null;
  profile: null | { investigation: number; entries: UniversalProfileEntry[] };
};

export function upgradeUniversalLabV2<T extends Record<string, unknown>>(source: T): T & UniversalV2Additions;
export function validateUniversalCalculations(definition: Record<string, unknown>): void;
export function evaluateUniversalComputed(
  definition: { computedFields?: UniversalComputedField[] },
  responseValues: Record<string, unknown>,
): Record<string, unknown>;
export function universalComputedLeafInputs(
  definition: { computedFields?: UniversalComputedField[] },
  computationId: string,
  responseValues?: Record<string, unknown>,
): string[];
export function experimentCalendarDay(startedAt: string | null | undefined, todayIso: string, totalDays: number, timeZone?: string): number;
export function universalExperimentEvidenceProgress(
  definition: {
    experiment?: UniversalExperimentContract | null;
    investigations?: Array<{
      number: number;
      prompts?: Array<{
        id: string;
        required?: boolean;
        readOnly?: boolean;
      }>;
    }>;
  },
  responses: Record<string, { status?: string }>,
  availableExperimentDay?: number,
): {
  experimentStarted: boolean;
  currentDay: number;
  totalDays: number;
  evidenceDaysRecorded: number;
  todayEvidenceRecorded: boolean;
  evidenceWindowCount?: number;
};
export function universalExperimentReviewReady(
  definition: Parameters<typeof universalExperimentEvidenceProgress>[0],
  responses: Record<string, { status?: string }>,
  availableExperimentDay?: number,
): boolean;
export function v2RequiredPromptIds(
  definition: { investigations?: unknown[] },
  investigationNumber: number,
  availableExperimentDay?: number,
): string[];
