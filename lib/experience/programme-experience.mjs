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
// One reproducible, varied fictional dataset supplies the screen and report.
// This is deliberately separate from visitor answers and live enrolments.
export const illustrativeParticipants = Object.freeze(Array.from({ length: 20 }, (_, index) => {
  const names = ['Naledi Mokoena', 'Bongani Nkosi', 'Neo Molefe', 'Lindiwe Mthembu', 'Kabelo Mokoena', 'Keitumetse Phiri', 'Zanele Ndlovu', 'Tshepo Mokoena', 'Nokuthula Zulu', 'Mpho Radebe', 'Fatima Jacobs', 'Sibusiso Khumalo', 'Thabo Maseko', 'Nomsa Dube', 'Sipho Dlamini', 'Ayanda Mkhize', 'Amina Petersen', 'Refilwe Modise', 'Lerato Khumalo', 'Tendai Ncube'];
  const used = index < 6 ? [false, false, true, true, true, true]
    : index < 10 ? [true, true, true, true, false, false]
      : index < 12 ? [true, false, true, true, false, true]
        : index < 16 ? [index % 2 === 0, index % 2 !== 0] : [];
  const events = index === 0 ? experienceEvidence(initialExperience).events : used.map((alternativeUsed, day) => ({ day: day + 1, eligibleOpportunity: true, alternativeUsed }));
  const baseline = index === 0 ? initialExperience.baseline : 3 + index % 3;
  return Object.freeze({ id: `example-${index + 1}`, name: names[index], active: index < 18, completed: index < 12,
    supportRequested: index < 5, baseline, post: index < 12 ? baseline + (index < 6 ? 2 : index < 10 ? -1 : 0) : null,
    prediction: index === 0 ? initialExperience.prediction : 50 + (index % 4) * 10, events });
}));

export function cohortEvidence(rows = illustrativeParticipants) {
  const assessed = rows.map(row => ({ ...row, metrics: computeHabitMetrics(row.events, row.prediction) }));
  const started = assessed.filter(row => row.events.length);
  const sufficient = assessed.filter(row => row.metrics.evidenceStrength === 'SUFFICIENT_FOR_LAB');
  const paired = sufficient.filter(row => row.post !== null);
  const mean = values => values.length ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length * 100) / 100 : null;
  const direction = row => {
    const events = row.events.filter(event => event.eligibleOpportunity);
    const mid = Math.floor(events.length / 2);
    const first = computeHabitMetrics(events.slice(0, mid), row.prediction).adherence;
    const last = computeHabitMetrics(events.slice(mid), row.prediction).adherence;
    return last - first;
  };
  return {
    enrolled: rows.length, active: rows.filter(row => row.active).length, completed: rows.filter(row => row.completed).length,
    started: started.length, support: rows.filter(row => row.supportRequested).length,
    sufficient: sufficient.length, limited: assessed.filter(row => row.metrics.evidenceStrength === 'LIMITED').length,
    none: assessed.filter(row => row.metrics.evidenceStrength === 'NONE').length,
    observations: started.reduce((sum, row) => sum + row.events.length, 0),
    opportunities: started.reduce((sum, row) => sum + row.metrics.opportunityCount, 0),
    improved: sufficient.filter(row => direction(row) > 0).length,
    otherDirection: sufficient.filter(row => direction(row) < 0).length,
    same: sufficient.filter(row => direction(row) === 0).length,
    averagePredicted: mean(started.map(row => row.prediction)), averageActual: mean(started.map(row => row.metrics.adherence)),
    averageAccuracy: mean(started.map(row => row.metrics.predictionAccuracy)),
    averageGap: mean(started.map(row => Math.abs(row.prediction - row.metrics.adherence))),
    paired: paired.length, averagePre: mean(paired.map(row => row.baseline)), averagePost: mean(paired.map(row => row.post)),
  };
}
export const illustrativeCohort = Object.freeze(cohortEvidence());

export function explainExperience(state) {
  const evidence = experienceEvidence(state);
  const missed = evidence.opportunityCount - evidence.replacementCount;
  return {
    followThrough: `Naledi tried “${state.alternative}” in ${evidence.replacementCount} of ${evidence.opportunityCount} opportunities. ${missed ? `It was not used in ${missed}. The plan has been used, but it is not yet consistent.` : 'It was used in every recorded opportunity in this short test.'}`,
    nextStep: 'Compare one occasion when the smaller action helped with one when it did not. Test one adjustment before taking on a bigger application task.',
    control: evidence.controlShift === 0 ? `Naledi’s rating of control stayed at ${state.post}/10.`
      : `Naledi rated her control ${Math.abs(evidence.controlShift)} points ${evidence.controlShift > 0 ? 'higher' : 'lower'}: ${state.baseline}/10 before, ${state.post}/10 after. This describes how able she feels to manage this habit; it does not measure job readiness or prove a skill gain.`,
  };
}

export function sponsorFindings(cohort = illustrativeCohort) {
  return [
    { title: 'Are participants following through more often?', observation: `${cohort.improved} of ${cohort.sufficient} participants with enough observations used their planned response more often later in the test.`,
      meaning: 'This is an early sign of follow-through in the situations they chose to test. It does not yet show whether they can sustain it at work or in study.',
      action: 'Leap9 can offer a relevant application or workplace task as the next practice opportunity. BIS should check whether the response carries over.',
      basis: 'Recorded responses in the first and second halves of each sufficiently observed experiment.', limit: 'A short test cannot establish lasting change or attribute it to the programme.' },
    { title: 'Who still needs help putting a plan into practice?', observation: `${cohort.support} of ${cohort.enrolled} participants requested a conversation with a facilitator.`,
      meaning: 'Participants are asking for human support. The request alone does not tell us what the barrier is.',
      action: 'Leap9 can make time for agreed check-ins. BIS facilitators should agree and record the next step with each participant.',
      basis: 'Participant support requests, separate from private reflection.', limit: 'A request is not a failure; silence does not mean support is unnecessary.' },
    { title: 'What can we say about readiness for the next opportunity?', observation: `${cohort.sufficient} of ${cohort.enrolled} participants have enough observations for a Lab review.`,
      meaning: 'There is evidence to discuss how these participants use a plan in real situations. This is not a work-readiness assessment.',
      action: 'Before claiming readiness, ask BIS for reviewed evidence from a relevant practical task and a later follow-up. BIS owns improvements to programme delivery.',
      basis: 'The Habit Lab observation threshold, not attendance or a confidence score.', limit: 'Observation coverage does not certify competence, employment outcomes or sponsor impact.' },
  ];
}
