export function structuralSupport(enrolment: { status: string; phaseACompletedAt?: string | null } | null | undefined, experiment: { recordedDays: number } | null | undefined): string;
export function programmeEvidenceGuidance(outcome: {
  suppressed: boolean; participantCount: number; minimumReportableCohortSize?: number;
  metrics: null | { experiment: { observationsRecorded: number; eligibleOpportunities: number }; evidence: { sufficient: number } };
}): null | { modelVersion: string; classificationStatus: string; confidence: null; title: string; summary: string; nextAction: string; sourceRefs: string[] };
