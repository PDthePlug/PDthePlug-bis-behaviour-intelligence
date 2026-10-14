export const REVIEWED_BOUNDARY: string;
export type ReviewedLearnerEvidence = { status: string; boundary: string; areas: Array<{ competencyId: string; title: string; reviewedRecords: number; firstEvidenceAt: string; latestEvidenceAt: string; achievementStatus: string; nextStep: string }> };
export type ReviewedProgrammeEvidence = { status: string; cohortId: string; participantCount: number; evidenceBasis: string; boundary: string; competencies: Array<{ competencyId: string; title: string; reviewedParticipants: number; denominator: number; achievementStatus: string }> };
export function buildReviewedLearnerEvidence(history: unknown, competencies?: Array<{id:string;title:string}>): ReviewedLearnerEvidence;
export function sanitizeReviewedProgrammeEvidence(raw: unknown, scope: { cohortId: string; participantCount: number; competencies?: Array<{id:string;title:string}> }): ReviewedProgrammeEvidence;
