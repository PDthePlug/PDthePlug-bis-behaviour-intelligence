export type ComparisonCoverage = {
  status: 'AVAILABLE' | 'SUPPRESSED' | 'UNAVAILABLE' | 'NO_COMPARABLE_PAIR';
  pairedParticipants: number | null; withoutComparablePair: number | null; cohortParticipants: number | null;
};
export function pairedComparisonCoverage(input?: { cohortParticipants?: number | null; pairedParticipants?: number | null; averagePre?: number | null; averagePost?: number | null; minimumCell?: number; suppressed?: boolean }): ComparisonCoverage;
export function sanitizeLearningComparisons(summary: unknown, cohortParticipants: number, minimumCell?: number): unknown;
export function programmeAggregateScopeMatches(outcome: unknown, flow: unknown): boolean;
