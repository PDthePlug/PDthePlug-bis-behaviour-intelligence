export type UniversalComputedOperation =
  | "PRODUCT"
  | "DIFFERENCE"
  | "COUNT_TRUE"
  | "COUNT_PRESENT"
  | "MAX"
  | "COPY";

export type UniversalComputedField = {
  id: string;
  label: string;
  investigation: number;
  operation: UniversalComputedOperation;
  inputs: string[];
  precision?: number;
};

export type UniversalExperimentContract = {
  investigation: number;
  startAfterInvestigation: number;
  days: number;
  reviewInvestigation: number;
  scheduledPromptIds: Array<{ day: number; promptId: string }>;
};

export type UniversalProfileEntry = {
  label: string;
  promptId: string;
  mode: "PROJECTION" | "INPUT";
};

export type UniversalV2Additions = {
  schemaVersion: "universal-lab-v2";
  runtimeProfile: "UNIVERSAL_V2";
  computedFields: UniversalComputedField[];
  experiment: UniversalExperimentContract | null;
  profile: null | { investigation: number; entries: UniversalProfileEntry[] };
};

export function upgradeUniversalLabV2<T extends Record<string, unknown>>(source: T): T & UniversalV2Additions;
export function evaluateUniversalComputed(
  definition: { computedFields?: UniversalComputedField[] },
  responseValues: Record<string, unknown>,
): Record<string, unknown>;
export function experimentCalendarDay(startedAt: string | null | undefined, todayIso: string, totalDays: number): number;
export function v2RequiredPromptIds(
  definition: { investigations?: unknown[] },
  investigationNumber: number,
  availableExperimentDay?: number,
): string[];
