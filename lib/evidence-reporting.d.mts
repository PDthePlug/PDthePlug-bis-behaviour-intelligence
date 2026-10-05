export function structuralSupport(enrolment: { status: string; phaseACompletedAt?: string | null; experimentStartedAt?: string | null } | null | undefined, experiment: { recordedDays: number } | null | undefined): string;
export function programmeEvidenceGuidance(outcome: {
  evidenceFlow?: import("./programme-evidence-flow").ProgrammeEvidenceFlow | null;
  suppressed: boolean; participantCount: number; minimumReportableCohortSize?: number;
  metrics: null | { experiment: { observationsRecorded: number; eligibleOpportunities: number }; evidence: { sufficient: number } };
}): null | { modelVersion: string; classificationStatus: string; confidence: null; title: string; summary: string; nextAction: string; sourceRefs: string[] };
