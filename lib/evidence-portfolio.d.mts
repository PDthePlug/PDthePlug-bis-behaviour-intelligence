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
  sourceAnchors: Array<{
    id: string;
    label: string;
    count: number;
  }>;
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
export function displayMetricValue(value: unknown, code?: string, formulaVersion?: string): string;
export function buildEvidencePortfolio(input: {
  enrolments?: Array<Record<string, unknown>>;
  evidence?: Array<Record<string, unknown>>;
  measurements?: Array<Record<string, unknown>>;
  measurementSources?: Array<Record<string, unknown>>;
  labTitles?: Record<string, string>;
  metricLabels?: Record<string, string>;
}): EvidencePortfolioLab[];
