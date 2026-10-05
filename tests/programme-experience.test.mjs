import test from 'node:test';
import assert from 'node:assert/strict';
import { experienceEvidence, initialExperience, restoreExperience, illustrativeCohort } from '../lib/experience/programme-experience.mjs';

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
