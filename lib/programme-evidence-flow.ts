export type ProgrammeEvidenceFlow = {
  runtimeMode: "STATIC" | "DYNAMIC";
  suppressed: boolean;
  participantCount: number;
  minimumReportableCohortSize: number;
  minimumReportableCellSize: number;
  stages: Array<{ investigation: number; participants: number | null; responses: number | null; suppressed: boolean }>;
  totals: null | { enrolled: number | null; startedExperiment: number | null; completed: number | null; recordedResponses: number | null; anchoredMeasures: number | null };
  privacyNote?: string;
};
export const EVIDENCE_STAGE_LABELS = ["Starting point", "Hook", "Pattern", "Revelation", "Mapping", "Equation", "Contract", "Experiment", "Evidence Review", "Profile"];
