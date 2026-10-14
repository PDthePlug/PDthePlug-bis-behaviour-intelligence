import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDevelopmentScenario,scenarioDefinitions} from '../lib/experience/development-scenario.mjs';
import {buildDevelopmentIntelligence} from '../lib/development-intelligence.mjs';
import {buildProgrammeReport} from '../lib/programme-intelligence.mjs';

for(const scenario of ['habit','habit-decision'])test(`${scenario}: cohort findings reconcile with every fictional learner and subgroup`,()=>{
 const data=buildDevelopmentScenario(scenario);
 assert.equal(data.learners.length,24);assert.equal(data.completedLabs,scenario==='habit'?1:2);
 assert.match(data.boundary,/fictional|Fictional/);assert.match(data.boundary,/not measured/);
 for(const outcome of data.outcomes){
  const learners=outcome.participantCount===24?data.learners:data.learners.filter(l=>l.group===outcome.cohort.id.at(-1));
  const profiles=learners.map(l=>buildDevelopmentIntelligence(l.facts,scenarioDefinitions));
  const report=outcome.developmentIntelligence;
  assert.equal(report.status,'AVAILABLE');assert.equal(report.areas.length,scenario==='habit'?3:5);
  assert.equal(report.assessmentCount,learners.reduce((n,l)=>n+l.facts.length,0));
  for(const area of report.areas){
   const rows=profiles.map(p=>p.areas.find(a=>a.competencyId===area.competencyId));
   for(const [field,key]of [['distribution','stage'],['strengthDistribution','strength'],['changeDistribution','trend'],['sourceDistribution','sourceNature']]){assert.equal(area[field].reduce((n,r)=>n+r.count,0),learners.length);for(const cell of area[field]){assert.ok(cell.count===0||cell.count>=3);assert.equal(cell.count,rows.filter(r=>r[key]===cell.code).length);}}
   for(const [field,key]of [['transferParticipants','transfer'],['repeatedApplicationParticipants','repeatedApplication'],['followupParticipants','followup'],['alignmentParticipants','alignment']])assert.equal(area[field],rows.filter(r=>r[key]).length);
   for(const field of ['baselineDistribution','alignmentDistribution','alignmentChangeDistribution']){assert.ok(area[field]);assert.equal(area[field].reduce((n,r)=>n+r.count,0),learners.length);}
   assert.equal(area.assessedGrowthParticipants,rows.filter(r=>r.sourceNature==='ASSESSED_TASK'&&r.trend==='HIGHER_REVIEWED_STAGE').length);
   assert.equal(area.evidenceCount,rows.reduce((n,r)=>n+r.evidenceCount,0));assert.ok(area.trajectory.every(t=>t.assessedApplicationParticipants!==null));
  }
  assert.equal(outcome.learningSummary.learningJourney.days.length,10);assert.equal(outcome.evidenceFlow.stages.length,9);
  const model=buildProgrammeReport(outcome);
  assert.equal(model.status,'AVAILABLE');assert.equal(model.comparisons.length,1);
  for(const area of report.areas)for(const prefix of ['competency-assessed-','paired-development-','competency-strength-','competency-baseline-','competency-basis-','competency-alignment-current-','competency-alignment-change-','competency-trajectory-','competency-acquisition-'])assert.ok(model.charts.some(c=>c.id===prefix+area.competencyId));
  assert.doesNotMatch(JSON.stringify(outcome),/fictional-learner-|"facts"|"privateReflection"/);
 }
});
test('completing the same programme does not force the same outcome or manufacture framework coverage',()=>{
 const data=buildDevelopmentScenario('habit-decision');
 const a=data.outcomes[0].developmentIntelligence.areas.find(a=>a.competencyId==='AC-C04');
 for(const code of ['HIGHER_REVIEWED_STAGE','SAME_REVIEWED_STAGE','LOWER_REVIEWED_STAGE'])assert.ok(a.changeDistribution.some(r=>r.code===code&&r.count>=3));
 assert.ok(a.transferParticipants>0&&a.transferParticipants<24);assert.ok(a.repeatedApplicationParticipants>0&&a.repeatedApplicationParticipants<24);
 assert.ok(a.strengthDistribution.some(r=>r.code==='MODERATE'&&r.count>0));
 const profile=buildDevelopmentIntelligence(data.learners[0].facts,scenarioDefinitions);
 const common=profile.areas.find(a=>a.competencyId==='AC-C03');
 assert.deepEqual(common.sourceLabs,['HAB','DEC']);assert.equal(new Set(common.timeline.filter(t=>t.sourceNature==='ASSESSED_TASK').map(t=>t.comparisonKey)).size,1);
 assert.ok(profile.areas.every(a=>a.sourceBaseline&&a.alignmentChange));
 assert.equal(data.outcomes[0].developmentIntelligence.areas.some(a=>a.competencyId==='AC-C01'),false);
 assert.throws(()=>buildDevelopmentScenario('production'));
});
