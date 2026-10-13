import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDevelopmentEvidence, experimentMeasures, safePartition, reportSections } from '../lib/development-evidence.mjs';
import { decorateCohortCompetencySummary } from '../lib/development-profile.mjs';
import { buildProgrammeReport } from '../lib/programme-intelligence.mjs';
const competencies = [{id:'AC-C04',title:'Self-management'}];
const record = (id, kind, extra={}) => ({id, evidence_class:kind, competency:'AC-C04', status:'ACTIVE',sensitivity:'P1',classification_status:'APPROVED',semantic_field_id:`HAB.${id}`,lab_code:'HAB',lab_version:'1',recorded_at:'2026-10-01T12:00:00Z',value:'PRIVATE_TEXT',...extra});
test('a plan creates a facilitation question, never a capability or transfer judgement',()=>{
 const result=buildDevelopmentEvidence({competencies,records:[record('plan','PLAN')]});
 assert.match(result.areas[0].gap,/recorded practice is not yet visible/);
 assert.equal(result.areas[0].assessmentStatus,'NOT_ESTABLISHED');
 assert.equal(result.areas[0].cells.find(c=>c.id==='OBSERVATION').count,0);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_TEXT|APPLY|stageCode/);
});
test('deduplicates record IDs; excludes private, revoked, missing sensitivity, unmapped and unapproved records',()=>{
 const good=record('a','OBSERVATION');
 const result=buildDevelopmentEvidence({competencies,records:[good,good,record('b','PLAN',{sensitivity:'P3'}),record('c','PLAN',{status:'WITHDRAWN'}),record('d','PLAN',{sensitivity:null}),record('e','PLAN',{classification_status:'STRUCTURAL'}),record('f','PLAN',{competency:'UNKNOWN'}),record('g','PRIVATE_REFLECTION')]});
 assert.equal(result.evidenceCount,1);assert.equal(result.areas[0].recordCount,1);
 assert.match(result.areas[0].nextStep,/compare the prediction/);
});
test('transfer task presence cannot establish independent transfer',()=>{
 const result=buildDevelopmentEvidence({competencies,records:[record('t','TRANSFER')]});
 assert.match(result.areas[0].gap,/independent use is not yet established/);
});
test('histories order occurrence dates and keep invalid dates out',()=>{
 const result=buildDevelopmentEvidence({competencies,records:[record('c','OUTCOME',{occurred_at:'2026-10-03'}),record('a','PLAN',{occurred_at:'2026-10-01'}),record('b','OBSERVATION',{occurred_at:'invalid'})]});
 assert.deepEqual(result.areas[0].timeline.map(x=>x.at),['2026-10-01','2026-10-03']);assert.equal(result.areas[0].undatedRecords,1);
});
test('suppresses siblings so small cells cannot be recovered from a partition total',()=>{
 const r=safePartition([{code:'A',count:9},{code:'B',count:1},{code:'C',count:0}],10);
 assert.ok(r.every(x=>x.count===null && x.suppressed));
 assert.deepEqual(safePartition([{code:'A',count:3},{code:'B',count:7}],10).map(x=>x.count),[3,7]);
 assert.ok(safePartition([{code:'A',count:3}],3).every(x=>x.count===null));
});
test('cohort structural records never retain inferred progression or small complementary totals',()=>{
 const summary=decorateCohortCompetencySummary({status:'AVAILABLE',participantCount:10,competencies:[{competency:'AC-C04',reportableParticipants:9,participantsWithRecordedProgression:8,distribution:[{code:'APPLY',count:9},{code:'NOT_YET_EVIDENCED',count:1}]}]},{competencies});
 assert.equal(summary.evidenceBasis,'STRUCTURAL_ONLY');assert.equal(summary.competencies[0].participantsWithRecordedProgression,null);assert.equal(summary.competencies[0].reportableParticipants,null);assert.ok(summary.competencies[0].distribution.every(x=>x.count===null));
});
test('experiment measures preserve no opportunity and authored denominators',()=>{
 assert.deepEqual(experimentMeasures({opportunities:0,completedPauses:0,predictedPercent:80}),{status:'NO_OPPORTUNITY',adherence:null,predictionAccuracy:null,secondaryRate:null});
 assert.deepEqual(experimentMeasures({opportunities:5,completedPauses:2,predictedPercent:70,secondaryEvents:1}),{status:'AVAILABLE',adherence:40,predictionAccuracy:70,secondaryRate:50});
 assert.equal(experimentMeasures({opportunities:5,completedPauses:6}).status,'INVALID_COUNTS');
 assert.equal(experimentMeasures({opportunities:5,completedPauses:0,predictedPercent:0}).predictionAccuracy,100);
 assert.equal(experimentMeasures({opportunities:5,completedPauses:0,secondaryEvents:0}).secondaryRate,null);
});
test('every finding and graphic belongs to one reporting section only',()=>{
 const report=buildProgrammeReport({participantCount:10,metrics:{action:{startedExperiment:5},completionContext:{completed:3}},learningSummary:{suppressed:false,learningJourney:{days:[],skillShifts:[{id:'control',label:'Control',pairedParticipants:5,averagePre:3,averagePost:5}],baselineThemes:[]}}});
 const sections=reportSections(report);const ids=sections.flatMap(x=>x.insights.map(i=>i.id));const charts=sections.flatMap(x=>x.charts.map(i=>i.id));
 assert.equal(ids.length,new Set(ids).size);assert.equal(ids.length,report.insights.length);assert.equal(charts.length,new Set(charts).size);assert.equal(charts.length,report.charts.length);
 assert.ok(sections.find(x=>x.id==='change').charts.some(x=>x.id==='paired-control'));
});

test('context-only evidence is visible without establishing ability',()=>{
 const result=buildDevelopmentEvidence({competencies,records:[record('context','CONTEXT')]});
 assert.equal(result.areas[0].cells.find(x=>x.id==='CONTEXT').count,1);
 assert.match(result.areas[0].gap,/Only a starting point/);
});
test('repeat-response partitions with small, missing or inconsistent cells are hidden in full',()=>{
 for(const counts of [[8,1,1],[8,null,2],[8,3,0]]) {
  const report=buildProgrammeReport({participantCount:20,metrics:{change:{repeatOpportunityParticipants:10,improvedLaterResponse:counts[0],sameLaterResponse:counts[1],changedOtherDirection:counts[2]}}});
  assert.ok(report.charts.find(x=>x.id==='repeat-response').rows.every(x=>x.value===null));
 }
 const report=buildProgrammeReport({participantCount:20,metrics:{change:{repeatOpportunityParticipants:10,improvedLaterResponse:4,sameLaterResponse:3,changedOtherDirection:3}}});
 assert.deepEqual(report.charts.find(x=>x.id==='repeat-response').rows.map(x=>x.value),[4,3,3]);
});
