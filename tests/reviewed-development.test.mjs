import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReviewedLearnerEvidence,sanitizeReviewedProgrammeEvidence} from '../lib/reviewed-development.mjs';
import {buildProgrammeReport} from '../lib/programme-intelligence.mjs';
import {reportSections} from '../lib/development-evidence.mjs';
const competencies=[{id:'AC-C04',title:'Self-management'}];
const row={evidenceId:'ev',occurredAt:'2026-10-01',competencyIds:['AC-C04'],reviewStatus:'REVIEWED',stage:'EXPLAIN',meaningSummary:'SECRET PRIVATE NARRATIVE',learnerText:'SECRET PRIVATE NARRATIVE'};
const raw={cohortId:'group',participantCount:10,evidenceBasis:'HUMAN_REVIEWED_TASK_COVERAGE',minimumReportableCellSize:3,reportingStatus:'AVAILABLE',competencies:[{competencyId:'AC-C04',reportableParticipants:7,stageDistribution:{NOT_YET_EVIDENCED:7},evidenceStrengthDistribution:{WEAK:7},label:'SECRET PRIVATE NARRATIVE'}],privateResponse:'SECRET PRIVATE NARRATIVE'};
const scope={cohortId:'group',participantCount:10,competencies};
test('learner summary uses current review metadata, deduplicates evidence and never infers achievement or serializes wording',()=>{
 const result=buildReviewedLearnerEvidence([row,row,{...row,evidenceId:'unreviewed',reviewStatus:'PROPOSED'},{...row,evidenceId:'invalid',occurredAt:'bad'}],competencies);
 assert.equal(result.areas[0].reviewedRecords,1);assert.equal(result.areas[0].achievementStatus,'NOT_ASSESSED');assert.doesNotMatch(JSON.stringify(result),/SECRET|EXPLAIN|learnerText|evidenceId/);
 assert.equal(buildReviewedLearnerEvidence(null).status,'UNAVAILABLE');assert.equal(buildReviewedLearnerEvidence([]).status,'NO_REVIEWED_EVIDENCE');
});
test('programme serialization preserves exact cohort/population and withholds unsafe cells and complements',()=>{
 const result=sanitizeReviewedProgrammeEvidence(raw,scope);assert.equal(result.competencies[0].reviewedParticipants,7);assert.doesNotMatch(JSON.stringify(result),/SECRET|privateResponse|label/);
 for(const count of [1,2,8,9,11]){const unsafe={...raw,competencies:[{...raw.competencies[0],reportableParticipants:count,stageDistribution:{NOT_YET_EVIDENCED:count},evidenceStrengthDistribution:{WEAK:count}}]};assert.equal(sanitizeReviewedProgrammeEvidence(unsafe,scope).competencies.length,0);}
 for(const mutation of [{cohortId:'other'},{participantCount:9},{evidenceBasis:'MODEL_PROPOSAL'}])assert.equal(sanitizeReviewedProgrammeEvidence({...raw,...mutation},scope).status,'UNAVAILABLE');
 assert.equal(sanitizeReviewedProgrammeEvidence({...raw,participantCount:4},{...scope,participantCount:4}).status,'SUPPRESSED');
});
test('stage overclaim, inconsistent partitions, unknown competencies and duplicated rows fail closed',()=>{
 for(const patch of [{stageDistribution:{EXPLAIN:7}},{stageDistribution:{NOT_YET_EVIDENCED:6}},{evidenceStrengthDistribution:{STRONG:7}},{competencyId:'invented'}])assert.equal(sanitizeReviewedProgrammeEvidence({...raw,competencies:[{...raw.competencies[0],...patch}]},scope).competencies.length,0);
 assert.equal(sanitizeReviewedProgrammeEvidence({...raw,competencies:[raw.competencies[0],raw.competencies[0]]},scope).competencies.length,1);
});
test('shared report model puts reviewed coverage in task review once with actionable boundaries and no achievement claim',()=>{
 const reviewedDevelopment=sanitizeReviewedProgrammeEvidence(raw,scope);
 const report=buildProgrammeReport({cohort:{id:'group'},participantCount:10,suppressed:false,reviewedDevelopment});
 const finding=report.insights.find(i=>i.id==='reviewed-AC-C04');assert.match(finding.observation,/7 of 10/);assert.match(finding.boundary,/does not by itself establish/);
 const sections=reportSections(report);assert.equal(sections.find(s=>s.id==='review').charts[0].rows[0].value,7);assert.equal(sections.flatMap(s=>s.insights).filter(i=>i.id==='reviewed-AC-C04').length,1);
 assert.equal(buildProgrammeReport({cohort:{id:'other'},participantCount:10,reviewedDevelopment}).insights.some(i=>i.id.startsWith('reviewed-')),false);
});
