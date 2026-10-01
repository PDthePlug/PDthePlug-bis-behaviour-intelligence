export type UniversalComputedOperation =
  | "PRODUCT"
  | "DIFFERENCE"
  | "COUNT_TRUE"
  | "COUNT_PRESENT"
  | "MAX"
  | "COPY"
  | "PAIR";

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

export type UniversalIndicatorBinding = {
  code: string;
  label: string;
  investigationNumbers: number[];
  promptIds: string[];
  computedPromptIds: string[];
  primaryPromptId: string | null;
  status: "BOUND" | "UNBOUND";
};

export type UniversalV2Additions = {
  schemaVersion: "universal-lab-v2";
  runtimeProfile: "UNIVERSAL_V2";
  computedFields: UniversalComputedField[];
  indicatorRegistry: UniversalIndicatorBinding[];
  experiment: UniversalExperimentContract | null;
  profile: null | { investigation: number; entries: UniversalProfileEntry[] };
};

export function upgradeUniversalLabV2<T extends Record<string, unknown>>(source: T): T & UniversalV2Additions;
export function evaluateUniversalComputed(
  definition: { computedFields?: UniversalComputedField[] },
  responseValues: Record<string, unknown>,
): Record<string, unknown>;
export function universalComputedLeafInputs(
  definition: { computedFields?: UniversalComputedField[] },
  computationId: string,
): string[];
export function experimentCalendarDay(startedAt: string | null | undefined, todayIso: string, totalDays: number): number;
export function v2RequiredPromptIds(
  definition: { investigations?: unknown[] },
  investigationNumber: number,
  availableExperimentDay?: number,
): string[];
