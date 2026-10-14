// Report only derived, current human review metadata. Machine proposals, rubric
// presence and contract ceilings do not establish a learner achievement stage.
const clean = value => String(value ?? '').trim();
const validCount = value => Number.isInteger(value) && value >= 0;
export const REVIEWED_BOUNDARY = 'Human review confirms that shared work was reviewed. It does not by itself establish a competency stage, acquired skill, sustained behaviour, transfer or programme causation.';

export function buildReviewedLearnerEvidence(history, competencies = []) {
  if (!Array.isArray(history)) return { status: 'UNAVAILABLE', areas: [], boundary: REVIEWED_BOUNDARY };
  const seen = new Set(), groups = new Map();
  for (const item of history) {
    if (!item || item.reviewStatus !== 'REVIEWED' || !clean(item.evidenceId) || seen.has(item.evidenceId)) continue;
    const at = new Date(item.occurredAt);
    if (!Number.isFinite(at.getTime())) continue;
    const ids = Array.isArray(item.competencyIds) ? [...new Set(item.competencyIds)] : [];
    const definitions = ids.map(id => competencies.find(c => c.id === id)).filter(Boolean);
    if (!definitions.length) continue;
    seen.add(item.evidenceId);
    for (const definition of definitions) {
      const area = groups.get(definition.id) ?? { competencyId: definition.id, title: definition.title, reviewedRecords: 0, firstEvidenceAt: at.toISOString(), latestEvidenceAt: at.toISOString(), achievementStatus: 'NOT_ASSESSED', nextStep: 'Use the authored task criteria and the learner’s shared evidence to agree the next practice and a later review.' };
      area.reviewedRecords++;
      area.firstEvidenceAt = area.firstEvidenceAt < at.toISOString() ? area.firstEvidenceAt : at.toISOString();
      area.latestEvidenceAt = area.latestEvidenceAt > at.toISOString() ? area.latestEvidenceAt : at.toISOString();
      groups.set(definition.id, area);
    }
  }
  const areas = [...groups.values()].sort((a,b) => a.title.localeCompare(b.title));
  return { status: areas.length ? 'AVAILABLE' : 'NO_REVIEWED_EVIDENCE', areas, boundary: REVIEWED_BOUNDARY };
}

export function sanitizeReviewedProgrammeEvidence(raw, { cohortId, participantCount, competencies = [] } = {}) {
  const unavailable = status => ({ status, cohortId, participantCount, evidenceBasis: 'HUMAN_REVIEWED_TASK_COVERAGE', competencies: [], boundary: REVIEWED_BOUNDARY });
  if (!raw || raw.cohortId !== cohortId || !validCount(participantCount) || raw.participantCount !== participantCount) return unavailable('UNAVAILABLE');
  if (participantCount < 5 || raw.reportingStatus === 'SUPPRESSED_SMALL_COHORT') return unavailable('SUPPRESSED');
  if (raw.evidenceBasis !== 'HUMAN_REVIEWED_TASK_COVERAGE' || !Array.isArray(raw.competencies)) return unavailable('UNAVAILABLE');
  const min = Math.max(3, validCount(raw.minimumReportableCellSize) ? raw.minimumReportableCellSize : 3);
  const seen = new Set(), rows = [];
  for (const item of raw.competencies) {
    const definition = competencies.find(c => c.id === item.competencyId);
    const sample = item.reportableParticipants;
    if (!definition || seen.has(definition.id) || !validCount(sample) || sample < min || sample > participantCount || (participantCount - sample > 0 && participantCount - sample < min)) continue;
    // The current contracts authorise task review, not attained stages. Fail
    // closed if a stale adapter or model tries to report an achievement.
    const stages = item.stageDistribution;
    if (!stages || Object.keys(stages).some(k => k !== 'NOT_YET_EVIDENCED') || stages.NOT_YET_EVIDENCED !== sample) continue;
    const strengths = item.evidenceStrengthDistribution;
    if (!strengths || Object.keys(strengths).some(k => k !== 'WEAK') || strengths.WEAK !== sample) continue;
    seen.add(definition.id);
    rows.push({ competencyId: definition.id, title: definition.title, reviewedParticipants: sample, denominator: participantCount, achievementStatus: 'NOT_ASSESSED' });
  }
  return { ...unavailable(rows.length ? 'AVAILABLE' : 'NO_REPORTABLE_REVIEWED_EVIDENCE'), competencies: rows };
}
