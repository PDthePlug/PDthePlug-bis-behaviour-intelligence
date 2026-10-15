import assert from 'node:assert/strict';
import test from 'node:test';
import { developmentAssessmentReadiness } from '../lib/development-readiness.mjs';

test('readiness never borrows criteria from another Lab or edition', () => {
  const contracts = [
    { lab_code: 'HAB', lab_version: '4.5.3', source_nature: 'SELF_REPORT', stage_ceiling: 'NOTICE' },
    { lab_code: 'DEC', lab_version: '4.5.2', source_nature: 'ASSESSED_TASK', stage_ceiling: 'TRANSFER' },
  ];
  assert.deepEqual(developmentAssessmentReadiness({ contracts }, 'HAB', '4.5.2'), { learnerReport: false, practicalUse: false, transfer: false });
  assert.deepEqual(developmentAssessmentReadiness({ contracts }, 'HAB', '4.5.3'), { learnerReport: true, practicalUse: false, transfer: false });
});

test('a failed or malformed lookup stays unknown, rather than becoming missing criteria', () => {
  for (const workspace of [null, undefined, {}, { contracts: null }]) assert.equal(developmentAssessmentReadiness(workspace, 'HAB', '1'), null);
});

test('only authorised assessed-task stages establish practical and transfer readiness', () => {
  const contract = { lab_code: 'HAB', lab_version: '1', source_nature: 'ASSESSED_TASK', stage_ceiling: 'EXPLAIN', private_metadata: 'not returned' };
  assert.deepEqual(developmentAssessmentReadiness({ contracts: [contract] }, 'HAB', '1'), { learnerReport: false, practicalUse: false, transfer: false });
  assert.deepEqual(developmentAssessmentReadiness({ contracts: [{ ...contract, stage_ceiling: 'APPLY' }] }, 'HAB', '1'), { learnerReport: false, practicalUse: true, transfer: false });
  assert.deepEqual(developmentAssessmentReadiness({ contracts: [{ ...contract, stage_ceiling: 'TRANSFER' }] }, 'HAB', '1'), { learnerReport: false, practicalUse: true, transfer: true });
});
