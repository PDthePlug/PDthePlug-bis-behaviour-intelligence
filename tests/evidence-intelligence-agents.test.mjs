import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  clampEvidenceStage,
  evidenceAiEnabled,
  humanReviewRequired,
  minimiseLearnerText,
  modelAssistedQuestionEligible,
  programmeInsightInputIsAggregateOnly,
  sensitivityMayReachModel,
  stableEvidenceFingerprint,
} from '../lib/evidence-intelligence/core.mjs';

const root = new URL('../', import.meta.url);

test('evidence AI is disabled by default and only explicit true enables it', () => {
  assert.equal(evidenceAiEnabled({}), false);
  assert.equal(evidenceAiEnabled({ BIS_EVIDENCE_AI_ENABLED: 'false' }), false);
  assert.equal(evidenceAiEnabled({ BIS_EVIDENCE_AI_ENABLED: 'TRUE' }), true);
});

test('only P0-P2 evidence may reach the model', () => {
  assert.equal(sensitivityMayReachModel('P0'), true);
  assert.equal(sensitivityMayReachModel('P1'), true);
  assert.equal(sensitivityMayReachModel('P2'), true);
  assert.equal(sensitivityMayReachModel('P3'), false);
  assert.equal(sensitivityMayReachModel(undefined), false);
});

test('model-assisted eligibility requires active governed text and excludes P3', () => {
  const valid = {
    status: 'ACTIVE',
    aggregate_policy: 'MODEL_ASSISTED',
    answer_model: 'TEXT',
    sensitivity: 'P2',
  };
  assert.equal(modelAssistedQuestionEligible(valid), true);
  assert.equal(modelAssistedQuestionEligible({ ...valid, status: 'CANDIDATE' }), false);
  assert.equal(modelAssistedQuestionEligible({ ...valid, aggregate_policy: 'STRUCTURED_ONLY' }), false);
  assert.equal(modelAssistedQuestionEligible({ ...valid, answer_model: 'CATEGORICAL' }), false);
  assert.equal(modelAssistedQuestionEligible({ ...valid, sensitivity: 'P3' }), false);
});

test('learner text minimisation removes common direct contact identifiers', () => {
  const input = 'Email me at learner@example.com or call +27 82 555 1234. See https://example.com/me. Student ID ABC123456.';
  const output = minimiseLearnerText(input);
  assert.doesNotMatch(output, /learner@example\.com/);
  assert.doesNotMatch(output, /82 555 1234/);
  assert.doesNotMatch(output, /example\.com\/me/);
  assert.doesNotMatch(output, /ABC123456/);
  assert.match(output, /\[EMAIL_REDACTED\]/);
  assert.match(output, /\[PHONE_REDACTED\]/);
  assert.match(output, /\[URL_REDACTED\]/);
  assert.match(output, /\[IDENTIFIER_REDACTED\]/);
});

test('evidence stage can never exceed its authored ceiling', () => {
  assert.equal(clampEvidenceStage('TRANSFER', 'NOTICE'), 'NOTICE');
  assert.equal(clampEvidenceStage('APPLY', 'EXPLAIN'), 'EXPLAIN');
  assert.equal(clampEvidenceStage('NOTICE', 'APPLY'), 'NOTICE');
  assert.equal(clampEvidenceStage('TRANSFER', 'TRANSFER'), 'TRANSFER');
  assert.equal(clampEvidenceStage('UNKNOWN', 'TRANSFER'), 'NOT_YET_EVIDENCED');
});

test('low confidence, uncertainty, contradiction and P3 force human review', () => {
  assert.equal(humanReviewRequired({ confidence: 0.91 }), false);
  assert.equal(humanReviewRequired({ confidence: 0.6 }), true);
  assert.equal(humanReviewRequired({ confidence: 0.91, uncertainty: true }), true);
  assert.equal(humanReviewRequired({ confidence: 0.91, contradiction: true }), true);
  assert.equal(humanReviewRequired({ confidence: 0.91, sensitivity: 'P3' }), true);
  assert.equal(humanReviewRequired({ confidence: Number.NaN }), true);
});

test('programme insight input accepts aggregates but rejects individual or raw response material recursively', () => {
  const aggregate = {
    cohortId: 'group',
    participantCount: 12,
    competencies: [{ competencyId: 'AC-C04', stageDistribution: { APPLY: 6 } }],
    limitations: ['Self-report remains self-report.'],
  };
  assert.equal(programmeInsightInputIsAggregateOnly(aggregate), true);
  assert.equal(programmeInsightInputIsAggregateOnly({ ...aggregate, learnerUserId: 'learner1' }), false);
  assert.equal(programmeInsightInputIsAggregateOnly({ ...aggregate, Learner_User_ID: 'learner1' }), false);
  assert.equal(programmeInsightInputIsAggregateOnly({ ...aggregate, nested: { response: 'private words' } }), false);
  assert.equal(programmeInsightInputIsAggregateOnly({ ...aggregate, nested: [{ learnerName: 'Student' }] }), false);
  assert.equal(programmeInsightInputIsAggregateOnly({ ...aggregate, nested: [{ evidence_id: 'ev-private' }] }), false);
});

test('evidence fingerprints are deterministic for governed source metadata', () => {
  const input = {
    evidenceId: 'ev-1',
    labCode: 'HAB',
    labVersion: '1',
    semanticFieldId: 'HAB.DAY1.REFLECTION',
    occurredAt: '2026-10-13T12:00:00Z',
  };
  assert.equal(stableEvidenceFingerprint(input), stableEvidenceFingerprint({ ...input }));
  assert.notEqual(stableEvidenceFingerprint(input), stableEvidenceFingerprint({ ...input, evidenceId: 'ev-2' }));
});

test('API accepts only an evidence id and returns model output as non-reportable', async () => {
  const route = await readFile(new URL('app/api/evidence-intelligence/route.ts', root), 'utf8');
  assert.match(route, /requestSchema\s*=\s*z\.object\(\{\s*evidenceId:\s*id\s*\}\)\.strict\(\)/s);
  assert.match(route, /reportable:\s*false/);
  assert.match(route, /bis_evidence_agent_context/);
  assert.doesNotMatch(route, /requestSchema[\s\S]{0,500}learnerText/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE/);
});

test('programme agent rejects unsafe raw payloads before Zod can strip unknown fields', async () => {
  const agents = await readFile(new URL('lib/evidence-intelligence/agents.ts', root), 'utf8');
  const guard = agents.indexOf('programmeInsightInputIsAggregateOnly(rawAggregate)');
  const parse = agents.indexOf('ProgrammeAggregateSchema.parse(rawAggregate)');
  assert.ok(guard >= 0, 'aggregate-only raw-input guard must exist');
  assert.ok(parse > guard, 'raw aggregate guard must run before schema parsing');
  assert.match(agents, /reviewStatus === "REVIEWED"/);
  assert.match(agents, /stageOverclaim/);
  assert.match(agents, /provenanceMismatch/);
});

test('database context requires consent, learner-authored text, exact governed model policy and excludes privileged bypasses', async () => {
  const migration = await readFile(
    new URL('supabase/migrations/20261013150000_evidence_intelligence_agents.sql', root),
    'utf8',
  );
  assert.match(migration, /provenance\s*=\s*'LR'/);
  assert.match(migration, /source_object_type\s*=\s*'RESPONSE'/);
  assert.match(migration, /value_type\s*=\s*'TEXT'/);
  assert.match(migration, /sensitivity\s+in\s*\('P0','P1','P2'\)/);
  assert.match(migration, /aggregate_policy\s*=\s*'MODEL_ASSISTED'/);
  assert.match(migration, /answer_model\s*=\s*'TEXT'/);
  assert.match(migration, /consent_type\s*=\s*'LEARNER_PRODUCT'/);
  assert.match(migration, /=\s*'GRANTED'/);
  assert.match(migration, /le\.lab_code\s*=\s*e\.lab_code/);
  assert.match(migration, /le\.lab_version\s*=\s*e\.lab_version/);
  assert.match(migration, /private\.submission_is_current\(s\.id\)/);
  assert.doesNotMatch(migration, /has_staff_role\('SYSTEM_ADMIN'\)/);
  assert.doesNotMatch(migration, /service_role/i);
});
