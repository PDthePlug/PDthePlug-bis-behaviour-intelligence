import { safePartition } from './development-evidence.mjs';

export function programmeAggregateScopeMatches(outcome, flow) {
  const valid = value => Number.isInteger(value) && value >= 0;
  const minimum = Math.max(5, valid(outcome?.minimumReportableCohortSize) ? outcome.minimumReportableCohortSize : 5,
    valid(flow?.minimumReportableCohortSize) ? flow.minimumReportableCohortSize : 5);
  return Boolean(outcome && flow && !outcome.suppressed && !flow.suppressed
    && valid(outcome.participantCount) && valid(flow.participantCount)
    && outcome.participantCount === flow.participantCount && flow.participantCount >= minimum);
}

export function pairedComparisonCoverage({ cohortParticipants, pairedParticipants, averagePre, averagePost, minimumCell = 3, suppressed = false } = {}) {
  const validCount = value => Number.isInteger(value) && value >= 0;
  const unavailable = { status: 'UNAVAILABLE', pairedParticipants: null, withoutComparablePair: null, cohortParticipants: validCount(cohortParticipants) ? cohortParticipants : null };
  if (suppressed) return { ...unavailable, status: 'SUPPRESSED' };
  if (!validCount(cohortParticipants) || !validCount(pairedParticipants) || pairedParticipants > cohortParticipants) return unavailable;
  const rows = safePartition([
    { code: 'PAIRED', count: pairedParticipants },
    { code: 'WITHOUT_PAIR', count: cohortParticipants - pairedParticipants },
  ], cohortParticipants, Number.isInteger(minimumCell) && minimumCell >= 3 ? minimumCell : 3);
  if (suppressed || rows.some(row => row.suppressed)) return { ...unavailable, status: 'SUPPRESSED' };
  if (pairedParticipants === 0) return { status: 'NO_COMPARABLE_PAIR', pairedParticipants: 0, withoutComparablePair: cohortParticipants, cohortParticipants };
  if (![averagePre, averagePost].every(value => typeof value === 'number' && Number.isFinite(value))) return unavailable;
  return { status: 'AVAILABLE', pairedParticipants, withoutComparablePair: cohortParticipants - pairedParticipants, cohortParticipants };
}

// Apply the same complementary-cell protection before API serialization. A UI
// mask alone would leave the averages accessible in the network response.
export function sanitizeLearningComparisons(summary, cohortParticipants, minimumCell = 3) {
  if (!summary || typeof summary !== 'object') return null;
  if (summary.suppressed) return { ...summary, learningJourney: null };
  if (Number.isInteger(summary.participantCount) && summary.participantCount !== cohortParticipants) {
    return { cohortId: summary.cohortId, participantCount: cohortParticipants, suppressed: true, learningJourney: null };
  }
  if (!summary.learningJourney || typeof summary.learningJourney !== 'object') return summary;
  const skillShifts = (Array.isArray(summary.learningJourney.skillShifts) ? summary.learningJourney.skillShifts : []).map(shift => {
    const coverage = pairedComparisonCoverage({ cohortParticipants, pairedParticipants: shift?.pairedParticipants,
      averagePre: shift?.averagePre, averagePost: shift?.averagePost, minimumCell, suppressed: shift?.suppressed === true });
    const available = coverage.status === 'AVAILABLE';
    return { id: shift?.id, label: shift?.label, pairedParticipants: coverage.pairedParticipants,
      averagePre: available ? shift.averagePre : null, averagePost: available ? shift.averagePost : null,
      averageShift: available && typeof shift.averageShift === 'number' && Number.isFinite(shift.averageShift) ? shift.averageShift : null,
      suppressed: coverage.status === 'SUPPRESSED', comparisonStatus: coverage.status };
  });
  return { ...summary, learningJourney: { ...summary.learningJourney, skillShifts } };
}
