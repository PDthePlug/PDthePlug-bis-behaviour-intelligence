export type CompetencyReportItem = {
  competencyId: string;
  title: string;
  progression: { level: number; code: string; evidenceIds: string[]; rationale: string };
  label: string;
  reportable: boolean;
  evidenceCount: number;
  evidenceClasses: string[];
  contexts: string[];
  externalFrameworkAreas: string[];
  progressionPath: Array<{ level: number; code: string; label: string; at: string | null; evidenceId: string | null; authoredAnchor: string | null }>;
  change: { firstEvidencedLevel: number; currentLevel: number; levelDifference: number; description: string };
  nextEvidenceNeeded: string | null;
  evidence: Array<Record<string, unknown>>;
  narrative: { classificationStatus: string; statement: string; boundary: string };
};
export function buildProgressionPath(rows?: Array<Record<string, unknown>>): Array<Record<string, unknown>>;
export function buildLearnerCompetencyReport(input?: Record<string, unknown>): {
  modelVersion: string;
  reportClassification: Record<string, unknown>;
  learnerId: string | null;
  labCode: string | null;
  status: "AVAILABLE" | "LIMITED_EVIDENCE";
  competencies: CompetencyReportItem[];
  boundary: string;
};
export function buildCohortCompetencySummary(input?: Record<string, unknown>): Record<string, unknown>;
export function buildLongitudinalCompetencyPathway(input?: Record<string, unknown>): Record<string, unknown>;
