export type EvidenceCell = { id: string; label: string; question: string; count: number };
export type DevelopmentEvidence = {
 modelVersion: string; status: string; evidenceCount: number; boundary: string;
 areas: Array<{ competencyId: string; title: string; cells: EvidenceCell[]; recordCount: number; sourceLabs: string[]; sourceVersions: string[]; timeline: Array<{ at: string; count: number; classes: string[] }>; undatedRecords: number; gap: string; nextStep: string; assessmentStatus: string }>;
};
export const EVIDENCE_COLUMNS: Array<{ id: string; label: string; question: string }>;
export function buildDevelopmentEvidence(input?: { records?: Array<Record<string, unknown>>; competencies?: Array<{id:string;title:string}> }): DevelopmentEvidence;
export function safePartition(rows: Array<Record<string, unknown>>, population: number, minimumCell?: number): Array<Record<string, unknown>>;
export function experimentMeasures(input?: { opportunities?: number; completedPauses?: number; predictedPercent?: number; secondaryEvents?: number | null }): { status: string; adherence: number|null; predictionAccuracy: number|null; secondaryRate: number|null };
export const STRUCTURAL_LABELS: Record<string,string>;
export function reportSections(report: import('./programme-intelligence.mjs').ProgrammeReport): Array<{ id: string; title: string; insights: import('./programme-intelligence.mjs').ReportInsight[]; charts: import('./programme-intelligence.mjs').ReportChart[] }>;
