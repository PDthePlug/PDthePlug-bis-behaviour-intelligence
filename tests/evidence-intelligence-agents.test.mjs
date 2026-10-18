import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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

test('model-assisted eligibility is separate from aggregation and requires facilitator-shared governed text', () => {
  const valid = {
    status: 'ACTIVE',
    model_review_policy: 'FACILITATOR_SHARED_ONLY',
    aggregate_policy: 'EXCLUDE',
    answer_model: 'TEXT',
    sensitivity: 'P2',
  };
  assert.equal(modelAssistedQuestionEligible(valid), true);
  assert.equal(modelAssistedQuestionEligible({ ...valid, status: 'CANDIDATE' }), false);
  assert.equal(modelAssistedQuestionEligible({ ...valid, model_review_policy: 'DISABLED' }), false);
  assert.equal(modelAssistedQuestionEligible({ ...valid, aggregate_policy: 'STRUCTURED_ONLY' }), true);
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
    competencies: [{ competencyId: 'AC-C04', stageDistribution: { NOTICE: 6 } }],
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

test('API accepts only an evidence id and returns source-contract-bounded model output as non-reportable', async () => {
  const route = await readFile(new URL('app/api/evidence-intelligence/route.ts', root), 'utf8');
  assert.match(route, /requestSchema\s*=\s*z\.object\(\{\s*evidenceId:\s*id\s*\}\)\.strict\(\)/s);
  assert.match(route, /reportable:\s*false/);
  assert.match(route, /bis_evidence_agent_context/);
  assert.match(route, /contractId/);
  assert.match(route, /allowedInference/);
  assert.match(route, /forbiddenInference/);
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

test('question contract framework separates meaning, aggregation and model-review permission and fails uncontracted questions closed', async () => {
  const framework = await readFile(
    new URL('supabase/migrations/20261013170000_question_evidence_contract_framework.sql', root),
    'utf8',
  );
  const closed = await readFile(
    new URL('supabase/migrations/20261013170075_uncontracted_questions_fail_closed.sql', root),
    'utf8',
  );
  assert.match(framework, /create table public\.question_evidence_contracts/);
  assert.match(framework, /aggregation_policy/);
  assert.match(framework, /model_review_policy/);
  assert.match(framework, /stage_ceiling/);
  assert.match(framework, /measurement_status/);
  assert.match(framework, /source_hash/);
  assert.match(closed, /new\.status := 'CANDIDATE'/);
  assert.match(closed, /new\.aggregate_policy := 'EXCLUDE'/);
  assert.match(closed, /new\.model_review_policy := 'DISABLED'/);
});

test('Volume 1 source contract seeds cover ten supplied Lab titles and the governed meaning set only', async () => {
  const migrationDir = new URL('supabase/migrations/', root);
  const names = (await readdir(migrationDir))
    .filter((name) => /^20261013170(?:100|110|120|130|140|150|200|210|220|230)_volume1_[a-z]+_question_contracts\.sql$/.test(name))
    .sort();
  assert.equal(names.length, 10);

  const counts = new Map([
    ['BASELINE', 0],
    ['LEARNING_CHECK', 0],
    ['INTERPRETATION', 0],
  ]);
  const labs = new Set();
  const seen = new Set();
  const sourceHash = '1bfd88d11bf90ebbe3b7f40321740904e8a8065d3e5294978ffd8a2cbb2b356e';

  for (const name of names) {
    const sql = await readFile(new URL(name, migrationDir), 'utf8');
    assert.match(sql, new RegExp(sourceHash));
    const calls = [...sql.matchAll(/seed_question_evidence_contract_set\(\s*'([^']+)',\s*'([^']*)',\s*'([^']+)'/gs)];
    assert.equal(calls.length, 3, `${name} must contain baseline, learning-check and reflection sets`);
    for (const [, lab, payload, evidenceClass] of calls) {
      labs.add(lab);
      assert.ok(counts.has(evidenceClass), `${name}: unexpected approved evidence class ${evidenceClass}`);
      const entries = payload.split(',').filter(Boolean);
      counts.set(evidenceClass, counts.get(evidenceClass) + entries.length);
      for (const entry of entries) {
        const [family, competency, occurrences] = entry.split('|');
        assert.match(family, /^QF-[A-Z0-9]+$/);
        assert.match(competency, /^AC-C\d{2}$/);
        assert.ok(Number(occurrences) > 0);
        const key = `${lab}:${family}`;
        assert.equal(seen.has(key), false, `duplicate approved source family ${key}`);
        seen.add(key);
      }
    }
  }

  assert.deepEqual([...labs].sort(), ['ATT','DEC','HAB','INF','LEA','MON','PUR','RES','RSK','TIM']);
  assert.equal(counts.get('BASELINE'), 136);
  assert.equal(counts.get('LEARNING_CHECK'), 1131);
  assert.equal(counts.get('INTERPRETATION'), 708);
  assert.equal(seen.size, 1975);
});

test('facilitator evidence context uses source contract model-review policy and contract stage ceiling, not aggregation permission', async () => {
  const migration = await readFile(
    new URL('supabase/migrations/20261013171000_evidence_intelligence_contract_context.sql', root),
    'utf8',
  );
  assert.match(migration, /provenance\s*=\s*'LR'/);
  assert.match(migration, /source_object_type\s*=\s*'RESPONSE'/);
  assert.match(migration, /value_type\s*=\s*'TEXT'/);
  assert.match(migration, /sensitivity\s+in\s*\('P0','P1','P2'\)/);
  assert.match(migration, /model_review_policy\s*=\s*'FACILITATOR_SHARED_ONLY'/);
  assert.match(migration, /'stageCeiling',\s*m\.stage_ceiling/);
  assert.match(migration, /private\.submission_is_current\(s\.id\)/);
  assert.match(migration, /consent_type\s*=\s*'LEARNER_PRODUCT'/);
  assert.doesNotMatch(migration, /aggregate_policy\s*=\s*'MODEL_ASSISTED'/);
  assert.doesNotMatch(migration, /has_staff_role\('SYSTEM_ADMIN'\)/);
  assert.doesNotMatch(migration, /service_role/i);
});

test('Agent 3 adapter consumes only latest human-reviewed derived evidence and never serializes learner wording', async () => {
  const migration = await readFile(
    new URL('supabase/migrations/20261013171100_evidence_intelligence_reviewed_history.sql', root),
    'utf8',
  );
  const route = await readFile(new URL('app/api/evidence-intelligence/longitudinal/route.ts', root), 'utf8');
  assert.match(migration, /a\.disposition = 'REVIEWED'/);
  assert.match(migration, /classification_status = 'APPROVED'/);
  assert.match(migration, /m\.contract_id is not null/);
  assert.match(migration, /private\.submission_is_current\(s\.id\)/);
  assert.match(migration, /then 'EXPLAIN'/);
  assert.match(migration, /else 'NOTICE'/);
  assert.doesNotMatch(migration, /'learnerText'/);
  assert.doesNotMatch(migration, /e\.value/);
  assert.match(route, /bis_agent_reviewed_evidence_history/);
  assert.match(route, /runLongitudinalSynthesisAgent/);
  assert.match(route, /reportable:\s*false/);
  assert.doesNotMatch(route, /learnerText/);
});

test('Agent 5 adapter suppresses small and reconstructable competency cells before programme insight', async () => {
  const migration = await readFile(
    new URL('supabase/migrations/20261013171200_evidence_intelligence_programme_aggregate.sql', root),
    'utf8',
  );
  const route = await readFile(new URL('app/api/evidence-intelligence/programme/route.ts', root), 'utf8');
  assert.match(migration, /v_participants < 5/);
  assert.match(migration, /reportable >= 3/);
  assert.match(migration, /v_participants - reportable = 0 or v_participants - reportable >= 3/);
  assert.match(migration, /notice_count = 0 or notice_count >= 3/);
  assert.match(migration, /explain_count = 0 or explain_count >= 3/);
  assert.match(migration, /a\.disposition = 'REVIEWED'/);
  assert.doesNotMatch(migration, /e\.value/);
  assert.doesNotMatch(migration, /learner_email/);
  assert.match(route, /bis_agent_programme_aggregate/);
  assert.match(route, /runProgrammeInsightAgent/);
  assert.match(route, /reportable:\s*false/);
});

test('programme model input withholds small cells, complements and inconsistent partitions before any gateway call', async () => {
 const {programmeAggregateIsPrivacySafe}=await import('../lib/evidence-intelligence/core.mjs');
 const valid={participantCount:10,competencies:[{reportableParticipants:7,stageDistribution:{NOT_YET_EVIDENCED:7},evidenceStrengthDistribution:{WEAK:7}}]};
 assert.equal(programmeAggregateIsPrivacySafe(valid),true);
 for(const item of [{...valid.competencies[0],reportableParticipants:9},{...valid.competencies[0],stageDistribution:{NOTICE:5,EXPLAIN:2}},{...valid.competencies[0],evidenceStrengthDistribution:{WEAK:6}}])assert.equal(programmeAggregateIsPrivacySafe({...valid,competencies:[item]}),false);
 const agents=await readFile(new URL('lib/evidence-intelligence/agents.ts',root),'utf8');
 assert.match(agents,/programmeAggregateIsPrivacySafe\(aggregate\)/);
 assert.match(agents,/allowedInference: context\.allowedInference/);
 assert.match(agents,/forbiddenInference: context\.forbiddenInference/);
});
