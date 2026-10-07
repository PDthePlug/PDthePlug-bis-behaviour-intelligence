export type DevelopmentArea = {
  competencyId: string;
  title: string;
  stageCode: string;
  stageLabel: string;
  evidenceCount: number;
  sourceLabs: string[];
  externalFrameworkAreas: string[];
  summary: string;
  growth: string;
  nextStep: string | null;
  reportable: boolean;
};

export type LearnerDevelopmentProfile = {
  modelVersion: string;
  reportClassification: Record<string, unknown>;
  status: "AVAILABLE" | "LIMITED_EVIDENCE";
  title: string;
  heading: string;
  summary: string;
  areas: DevelopmentArea[];
  boundary: string;
};

export function resolveCompetencyId(value: unknown, competencies?: Array<{id:string;title:string}>): string | null;
export function buildLearnerDevelopmentProfile(input?: Record<string, unknown>): LearnerDevelopmentProfile;
export function decorateCohortCompetencySummary(input: Record<string, unknown> | null | undefined, options?: Record<string, unknown>): Record<string, unknown>;
