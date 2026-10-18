import assert from 'node:assert/strict';
import test from 'node:test';
import {buildDevelopmentScenario,scenarioDefinitions} from '../lib/experience/development-scenario.mjs';
import {buildDevelopmentIntelligence} from '../lib/development-intelligence.mjs';
import {buildDevelopmentStory,learnerDevelopmentStory} from '../lib/development-story.mjs';
test('plain-language cohort story reconciles entry, current use, assessed growth and overlapping transfer',()=>{
 const area=buildDevelopmentScenario().outcomes[0].developmentIntelligence.areas.find(a=>a.competencyId==='AC-C04');
 const story=buildDevelopmentStory(area,24);
 assert.match(story.startingPoint,/6 of 24/);assert.match(story.startingPoint,/may be after programme entry/);
 assert.match(story.change,/15 of 24/);assert.match(story.practice,/18 of 24/);assert.equal(story.explained,6);
 assert.match(story.transfer,/6 of 24/);assert.equal(story.strong,18);
 assert.deepEqual(story.changeRows.map(r=>r.count),[15,6,3]);
 assert.match(story.effectiveness,/cannot establish cause/);
});
test('mixed and missing evidence never turns self-report into demonstrated behaviour or missing history into no change',()=>{
 const area=buildDevelopmentScenario().outcomes[0].developmentIntelligence.areas[0];
 const story=buildDevelopmentStory({...area,baselineDistribution:null,sourceDistribution:[{code:'SELF_REPORT',count:24}],assessedGrowthParticipants:null,changeDistribution:[{code:'INSUFFICIENT_HISTORY',count:24}]},24);
 assert.equal(story.allTasks,false);assert.match(story.practice,/must not all be described as demonstrated/);
 assert.match(story.change,/not enough comparable assessed work/);assert.match(story.startingPoint,/not available/);
 assert.deepEqual(story.changeRows,[{label:'Need another comparable review',count:24}]);
});
test('facilitator recommendation targets practical support and a lower later result without judging the learner',()=>{
 const scenario=buildDevelopmentScenario();
 const profile=index=>buildDevelopmentIntelligence(scenario.learners[index].facts,scenarioDefinitions).areas.find(a=>a.competencyId==='AC-C04');
 assert.match(learnerDevelopmentStory(profile(9)).focus,/explaining.*trying/);
 assert.match(learnerDevelopmentStory(profile(15)).focus,/task harder.*supported retry/);
 const own={...profile(9),sourceNature:'SELF_REPORT'};
 assert.match(learnerDevelopmentStory(own).summary,/own report/);
 assert.match(learnerDevelopmentStory(own).next,/review/);
});
