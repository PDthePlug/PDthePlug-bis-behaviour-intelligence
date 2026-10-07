import type { BisReportClassification } from "./report-classification.mjs";
export type ReportInsight = {
  id: string; ruleVersion: number; domain: string; title: string; observation: string;
  context: string; interpretation: string; evidence: { basis: string; sample: number | null; population: number; coverage: string; strength: string };
  action: string; owner: string; boundary: string; sourceRefs: string[];
};
export type ReportChart = { id: string; title: string; unit: string; note: string; rows: Array<{ label: string; value: number | null; secondaryValue?: number | null; secondaryLabel?: string; denominator?: number | null }> };
export type ProgrammeReport = { modelVersion: string; reportClassification: BisReportClassification; status: "AVAILABLE" | "SUPPRESSED"; participantCount: number | null; minimumReportableCohortSize: number; profile: { name: string; labCode: string; labVersion: string }; decisions: Array<{ title: string; decision: string; expectedOutcome: string; owner: string; reviewOn: string | null; status: string; reviewOutcome: string | null; reviewNote: string | null }>; period: { startsOn: string | null; endsOn: string | null }; insights: ReportInsight[]; charts: ReportChart[]; boundary: string };
export const REPORT_MODEL_VERSION: string;
export function buildProgrammeReport(outcome: unknown): ProgrammeReport;
export function buildFacilitatorBrief(participants: Array<{ userId: string; displayName: string; enrolment: null | { status: string; currentInvestigation: number; experimentStartedAt?: string | null }; experiment: null | { recordedDays: number; opportunityCount: number } }>): { modelVersion: string; actions: Array<{ userId: string; displayName: string; observation: string; action: string; boundary: string }>; chart: ReportChart };
