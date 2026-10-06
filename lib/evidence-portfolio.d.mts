export type EvidencePortfolioAnchor = {
  id: "BASELINE" | "PHASE_A" | "EXPERIMENT" | "REVIEW" | "PROFILE";
  label: string;
  description: string;
  status: "RECORDED" | "WITHDRAWN" | "NOT_YET";
  evidenceCount: number;
  photoCount: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
};

export type EvidencePortfolioMetric = {
  code: string;
  label: string;
  value: string;
  evidenceStrength: string;
  formulaVersion: string;
  provenanceStatus: "VERIFIED" | "UNVERIFIED";
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
  intelligence: PortfolioIntelligence;
  anchors: EvidencePortfolioAnchor[];
  metrics: EvidencePortfolioMetric[];
  summary: {
    photos: number;
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
  attachments?: Array<{ enrolmentId: string; investigation: number; photoCount: number }>;
  labTitles?: Record<string, string>;
  metricLabels?: Record<string, string>;
}): EvidencePortfolioLab[];

export type PortfolioIntelligence = {
  modelVersion: string; classificationStatus: string; confidence: null;
  summary: string; boundary: string;
  feedback: Array<{ title: string; meaning: string; nextStep: string; codes: string[] }>;
  nextAction: { label: string; investigation: number; reason: string };
  evidenceRefs: Array<{ evidenceId: string | null; sourceObjectId: string; anchorId: string | null }>;
  measurementReview: { verified: number; unverified: number }; gaps: string[];
};
export function explainPortfolioMeasures(metrics: EvidencePortfolioMetric[]): PortfolioIntelligence['feedback'];
export function evidenceAnchorId(investigationId: string): string | null;
export function buildPortfolioIntelligence(input: { enrolment: Record<string, unknown>; anchors: EvidencePortfolioAnchor[]; metrics: EvidencePortfolioMetric[]; evidence: Array<Record<string, unknown>> }): PortfolioIntelligence;
