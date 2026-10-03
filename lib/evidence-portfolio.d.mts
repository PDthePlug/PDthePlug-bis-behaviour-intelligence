export type EvidencePortfolioAnchor = {
  id: "BASELINE" | "PHASE_A" | "EXPERIMENT" | "REVIEW" | "PROFILE";
  label: string;
  description: string;
  status: "RECORDED" | "WITHDRAWN" | "NOT_YET";
  evidenceCount: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
};

export type EvidencePortfolioMetric = {
  code: string;
  label: string;
  value: string;
  evidenceStrength: string;
  formulaVersion: string;
  sourceCount: number;
  calculatedAt: string | null;
};

export type EvidencePortfolioLab = {
  enrolmentId: string;
  labCode: string;
  labVersion: string;
  title: string;
  status: string;
  currentInvestigation: number;
  startedAt: string | null;
  phaseACompletedAt: string | null;
  experimentStartedAt: string | null;
  completedAt: string | null;
  anchors: EvidencePortfolioAnchor[];
  metrics: EvidencePortfolioMetric[];
  summary: {
    recordedAnchors: number;
    totalAnchors: number;
    activeEvidenceItems: number;
    derivedMeasures: number;
    sourceLinks: number;
  };
};

export function humanMetricLabel(code: string): string;
export function displayMetricValue(value: unknown): string;
export function buildEvidencePortfolio(input: {
  enrolments?: Array<Record<string, any>>;
  evidence?: Array<Record<string, any>>;
  measurements?: Array<Record<string, any>>;
  measurementSources?: Array<Record<string, any>>;
  labTitles?: Record<string, string>;
}): EvidencePortfolioLab[];
