import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgrammeReport, buildFacilitatorBrief } from '../lib/programme-intelligence.mjs';
export const fixture = {
 cohort: {id:'group',name:'Programme group',labCode:'HAB',labVersion:'1',startsOn:null,endsOn:null},participantCount:20,suppressed:false,minimumReportableCohortSize:5,
 metrics: {action:{startedExperiment:12,reachedExperimentStage:18,readyButNotStarted:6},completionContext:{completed:8},experiment:{observationsRecorded:42},evidence:{sufficient:6},change:{repeatOpportunityParticipants:8,improvedLaterResponse:4,sameLaterResponse:3,changedOtherDirection:1},prediction:{averagePredictionGap:18.25},support:{participantsRequestingHelp:3}},
 learningSummary:{suppressed:false,learningJourney:{days:[{day:1,reached:20,completed:18},{day:2,reached:18,completed:16}],skillShifts:[{id:'control',label:'Perceived control',pairedParticipants:8,averagePre:2.25,averagePost:3.5}],baselineThemes:[]}},
 organisationLearning:{suppressed:false,supportResponse:{requests:4,acknowledged:3,resolved:0},adaptation:{checkpointParticipants:8,adjustedParticipants:3,keptPlanParticipants:5},comparison:{baselineOnly:true,comparableCohorts:0}},
};
test('descriptive findings retain actual denominators, paired sample, action and boundaries',()=>{
 const report=buildProgrammeReport(fixture);
 assert.match(report.insights.find(i=>i.id==='practice-start').observation,/12 of 20/);
 assert.match(report.insights.find(i=>i.id==='practice-start').context,/6 of 18/);
 const paired=report.insights.find(i=>i.id==='paired-control');assert.equal(paired.evidence.sample,8);assert.match(paired.context,/\+1.25 scale points/);assert.match(paired.boundary,/not proof of an acquired skill/);
 for(const i of report.insights)for(const key of ['observation','context','interpretation','action','boundary'])assert.ok(i[key]);
 assert.ok(report.insights.every(i=>i.sourceRefs.length&&i.ruleVersion&&i.evidence.basis&&i.evidence.coverage));
 assert.match(report.boundary,/does not establish what caused/);
});
test('zero starters never generate a repeated-observation success or failure claim',()=>{
 const report=buildProgrammeReport({...fixture,metrics:{...fixture.metrics,action:{startedExperiment:0,reachedExperimentStage:0,readyButNotStarted:0},change:{repeatOpportunityParticipants:0},evidence:{sufficient:0}}});
 assert.equal(report.insights.some(i=>i.id==='repeated-observation'),false);
 assert.match(report.insights.find(i=>i.id==='practice-start').title,/No real-world testing/);
 assert.doesNotMatch(JSON.stringify(report),/useful base|Participation falls|poor/);
});
test('privacy suppression is fail-closed and null never becomes zero or an inferred hidden remainder',()=>{
 for(const input of [{...fixture,participantCount:4},{...fixture,suppressed:true},{...fixture,participantCount:null},{...fixture,evidenceFlow:{suppressed:true}},{...fixture,minimumReportableCohortSize:25}]){
  const report=buildProgrammeReport(input);assert.equal(report.status,'SUPPRESSED');assert.deepEqual(report.insights,[]);assert.deepEqual(report.charts,[]);assert.deepEqual(report.decisions,[]);
 }
 const report=buildProgrammeReport({...fixture,metrics:{...fixture.metrics,action:{...fixture.metrics.action,startedExperiment:2,readyButNotStarted:2}}});
 assert.equal(report.charts.find(c=>c.id==='participation').rows.find(r=>r.label==='Experiment start recorded').value,null);
 assert.equal(report.insights.some(i=>i.id==='practice-start'),false);
 assert.match(report.insights.find(i=>i.id==='practice-unavailable').boundary,/not zero/);
});
test('Universal flow never inherits legacy behaviour, context or organisational-learning measurements',()=>{
 const report=buildProgrammeReport({...fixture,evidenceFlow:{runtimeMode:'DYNAMIC',suppressed:false,totals:{startedExperiment:3,completed:null,recordedResponses:24,anchoredMeasures:9},stages:[{investigation:7,participants:3},{investigation:8,participants:1,suppressed:true}]}});
 assert.match(report.insights.find(i=>i.id==='practice-start').observation,/3 of 20/);
 assert.equal(report.insights.some(i=>['repeated-observation','expectation-observation','support-request','adaptation'].includes(i.id)),false);
 assert.equal(report.charts.find(c=>c.id==='lab-evidence').rows[1].value,null);
 assert.match(report.insights.find(i=>i.id==='evidence-coverage').observation,/24 responses and 9 measures/);
});
test('capability evidence requires a reportable saved authored review, never an inferred competency tier',()=>{
 const report=buildProgrammeReport({...fixture,assessmentSummary:{participants:20,suppressed:false,rubrics:[{rubric_id:'authored-1',title:'Systems Transfer Test',sample:3,average_total:4,maximum_total:5},{rubric_id:'hidden',title:'Hidden',sample:2,average_total:1,maximum_total:5}]}});
 assert.match(report.insights.find(i=>i.id==='assessment-authored-1').observation,/mean authored total is 4 out of 5/);
 assert.equal(report.insights.some(i=>i.id==='assessment-hidden'),false);
 assert.match(report.insights.find(i=>i.id==='assessment-authored-1').boundary,/does not prove a skill was newly acquired/);
});
test('no private response, private support message or machine inference enters the aggregate report',()=>{
 const report=buildProgrammeReport({...fixture,privateReflection:'SECRET_PERSONAL_RESPONSE',questionPatterns:{suppressed:false,questions:[{semanticFieldId:'private',label:'Private text',respondents:10,summary:{type:'TEXT',text:'SECRET_PERSONAL_RESPONSE'}}]}});
 assert.doesNotMatch(JSON.stringify(report),/SECRET_PERSONAL_RESPONSE|privateReflection/);
});
test('facilitator brief suggests a check-in from authorised progress, without a personal judgment',()=>{
 const learner={userId:'learner',displayName:'Thandi',enrolment:{status:'ACTIVE',currentInvestigation:7,experimentStartedAt:null},experiment:null};
 const brief=buildFacilitatorBrief([learner,{...learner,userId:'other',enrolment:{status:'COMPLETED',currentInvestigation:9}}]);
 assert.equal(brief.actions.length,1);assert.equal(brief.actions[0].userId,'learner');assert.match(brief.actions[0].action,/planned date/);assert.match(brief.actions[0].boundary,/do not establish ability/);assert.equal(brief.chart.rows.reduce((n,r)=>n+r.value,0),2);
});
