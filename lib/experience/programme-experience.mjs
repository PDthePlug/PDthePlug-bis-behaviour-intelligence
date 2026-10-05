import { computeHabitMetrics } from '../bis-metrics.mjs';

// Fictional identities and observations: never enrolments or production evidence.
export const leap9Experience = Object.freeze({
  id: 'leap9', organisation: 'Leap9', title: 'Leap9 × BIS Programme Experience',
  participant: 'Naledi Mokoena', facilitator: 'Lerato Dlamini',
  storageKey: 'bis.programme-experience.leap9.v1',
  steps: ['welcome', 'starting-point', 'learning', 'mapping', 'contract', 'experiment', 'review', 'facilitator', 'profile', 'outcomes'],
});
export const initialExperience = Object.freeze({
  baseline: 4, post: 6, prediction: 70,
  cue: 'After arriving home from the taxi rank',
  routine: 'Scroll on my phone before starting my application',
  reward: 'A break from worrying about the application',
  alternative: 'Open the application and complete one field before using my phone',
  reflection: 'Starting with one field helped. When I arrived home tired, I still reached for my phone.',
  observation: 'used', shared: false, supportRequested: false, supportAcknowledged: false,
  attested: false, note: '',
});
export const sampleWeek = Object.freeze([
  { day: 1, eligibleOpportunity: true, alternativeUsed: true },
  { day: 2, eligibleOpportunity: true, alternativeUsed: false },
  { day: 3, eligibleOpportunity: false, alternativeUsed: null },
  { day: 4, eligibleOpportunity: true, alternativeUsed: true },
  { day: 5, eligibleOpportunity: true, alternativeUsed: true },
  { day: 6, eligibleOpportunity: true, alternativeUsed: false },
]);
export function experienceEvidence(state) {
  const finalEvent = { day: 7, eligibleOpportunity: state.observation !== 'none', alternativeUsed: state.observation === 'none' ? null : state.observation === 'used' };
  const events = [...sampleWeek, finalEvent];
  return { events, ...computeHabitMetrics(events, state.prediction), controlShift: state.post - state.baseline };
}
export function restoreExperience(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.state || typeof data.state !== 'object') return { ...initialExperience };
    const result = { ...initialExperience };
    for (const key of Object.keys(result)) {
      const value = data.state[key];
      if (typeof value === typeof result[key] && (typeof value !== 'string' || value.length <= 2000)) result[key] = value;
    }
    for (const key of ['baseline', 'post']) if (!Number.isInteger(result[key]) || result[key] < 1 || result[key] > 10) result[key] = initialExperience[key];
    if (!Number.isFinite(result.prediction) || result.prediction < 0 || result.prediction > 100) result.prediction = initialExperience.prediction;
    if (!['used', 'not-used', 'none'].includes(result.observation)) result.observation = 'used';
    if (!result.shared) result.attested = false;
    if (!result.supportRequested) result.supportAcknowledged = false;
    return result;
  } catch { return { ...initialExperience }; }
}
// A reproducible aggregate fixture; the visitor's exercise never changes this cohort.
export const illustrativeCohort = Object.freeze({ enrolled: 20, active: 18, completed: 14, started: 16, support: 5, sufficient: 12, limited: 4, none: 4 });
