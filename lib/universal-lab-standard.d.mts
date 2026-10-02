export type HabitLabStageKey =
  | "HOOK"
  | "PATTERN"
  | "REVELATION"
  | "MAPPING"
  | "EQUATION"
  | "CONTRACT"
  | "EXPERIMENT"
  | "EVIDENCE_REVIEW"
  | "PROFILE";

export type HabitLabStandardStage = {
  number: number;
  key: HabitLabStageKey;
  label: string;
  role: string;
};

export type UniversalEditorialIssue = {
  code: "STAGE_COUNT" | "MISSING_STAGE" | "REPEATED_QUESTION" | "LOW_INFORMATION_PROMPT" | "LEGACY_PREDICTION_STAGE";
  severity: "ERROR" | "REVIEW";
  investigation?: number;
  promptId?: string;
  message: string;
};

export type UniversalNormalizationNote = {
  code: "TRANSFER_SUBSTAGE_FOLDED";
  sourceInvestigation: number;
  targetInvestigation: number;
  message: string;
};

export type UniversalEditorialAudit = {
  standardVersion: string;
  status: "PASS" | "REVIEW" | "BLOCKED";
  issues: UniversalEditorialIssue[];
};

export const HABIT_LAB_STANDARD_VERSION: string;
export const HABIT_LAB_STAGES: readonly HabitLabStandardStage[];
export function auditUniversalLabEditorialQuality(definition: Record<string, unknown>): UniversalEditorialAudit;
export function applyHabitLabStandard<T extends Record<string, unknown>>(source: T): T & {
  standardVersion: string;
  editorialAudit: UniversalEditorialAudit;
  normalizationNotes: UniversalNormalizationNote[];
};
