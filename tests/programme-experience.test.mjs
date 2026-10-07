import test from 'node:test';
import assert from 'node:assert/strict';
import { experienceEvidence, initialExperience, restoreExperience, illustrativeCohort, illustrativeParticipants, cohortEvidence, explainExperience, sponsorFindings } from '../lib/experience/programme-experience.mjs';

test('simulation calculates with canonical Habit metrics and keeps no opportunity distinct', () => {
  const used = experienceEvidence(initialExperience);
  assert.equal(used.opportunityCount, 6); assert.equal(used.replacementCount, 4); assert.equal(used.adherence, 67);
  const noOpportunity = experienceEvidence({ ...initialExperience, observation: 'none' });
  assert.equal(noOpportunity.opportunityCount, 5); assert.equal(noOpportunity.adherence, 60);
  const notUsed = experienceEvidence({ ...initialExperience, observation: 'not-used', post: 2 });
  assert.equal(notUsed.adherence, 50); assert.equal(notUsed.controlShift, -2);
  assert.equal(illustrativeCohort.enrolled, 20);
});
test('refresh restores only versioned bounded values and preserves privacy defaults', () => {
  assert.deepEqual(restoreExperience('broken'), initialExperience);
  assert.deepEqual(restoreExperience(JSON.stringify({ version: 2, state: { shared: true } })), initialExperience);
  const result = restoreExperience(JSON.stringify({ version: 1, state: { baseline: 11, post: -3, prediction: null, reflection: 'x'.repeat(2001), observation: 'invalid', shared: false, attested: true, supportRequested: false, supportAcknowledged: true, unexpected: 'value' } }));
  assert.equal(result.baseline, 4); assert.equal(result.post, 6); assert.equal(result.prediction, 70);
  assert.equal(result.attested, false); assert.equal(result.supportAcknowledged, false); assert.equal(result.observation, 'used');
  assert.equal(result.unexpected, undefined); assert.equal(result.reflection, initialExperience.reflection);
});
test('cohort fixture reconciles evidence coverage and allows mixed results', () => {
  assert.equal(illustrativeCohort.sufficient + illustrativeCohort.limited + illustrativeCohort.none, illustrativeCohort.enrolled);
  assert.ok(illustrativeCohort.completed < illustrativeCohort.enrolled);
  assert.ok(illustrativeCohort.support > 0);
});

test('illustrative outcomes derive from varied records and stay separate from visitor practice', () => {
  assert.deepEqual(cohortEvidence(illustrativeParticipants), illustrativeCohort);
  assert.equal(illustrativeCohort.improved + illustrativeCohort.otherDirection + illustrativeCohort.same, illustrativeCohort.sufficient);
  assert.equal(illustrativeCohort.observations, illustrativeParticipants.reduce((sum, row) => sum + row.events.length, 0));
  const before = sponsorFindings();
  experienceEvidence({ ...initialExperience, observation: 'none', post: 1 });
  assert.deepEqual(sponsorFindings(), before);
  assert.ok(before.every(item => item.observation && item.meaning && item.action && item.basis && item.limit));
  assert.match(before[0].observation, /5 of 12/);
  assert.match(before[2].action, /BIS owns improvements to programme delivery/);
});

test('participant meaning follows edits and does not equate perceived control with competence', () => {
  assert.match(explainExperience(initialExperience).followThrough, /4 of 6 opportunities/);
  assert.match(explainExperience({ ...initialExperience, observation: 'none' }).followThrough, /3 of 5/);
  assert.match(explainExperience({ ...initialExperience, post: 2 }).control, /2 points lower/);
  assert.match(explainExperience({ ...initialExperience, post: 4 }).control, /stayed at 4\/10/);
  assert.match(explainExperience(initialExperience).control, /does not measure job readiness/);
});

test('restored sharing cannot resurrect a hidden or empty facilitator review', () => {
  const hidden = restoreExperience(JSON.stringify({version:1,state:{shared:false,attested:true,note:'Old private review'}}));
  assert.equal(hidden.attested, false);
  assert.equal(hidden.note, '');
  const blank = restoreExperience(JSON.stringify({version:1,state:{shared:true,attested:true,note:'  '}}));
  assert.equal(blank.attested, false);
});

test('DGMT findings reuse the fixed evidence with an appropriate partner context', () => {
  const findings = sponsorFindings(illustrativeCohort, 'DGMT');
  assert.deepEqual(findings.map(row => row.observation), sponsorFindings().map(row => row.observation));
  assert.ok(findings.every(row => !row.action.includes('Leap9')));
  assert.match(findings[0].action, /DGMT/);
  assert.match(findings[2].limit, /does not certify competence/);
});
