import test from 'node:test';import assert from 'node:assert/strict';
import {pairedComparisonCoverage,sanitizeLearningComparisons,programmeAggregateScopeMatches} from '../lib/comparison-coverage.mjs';
import {buildProgrammeReport} from '../lib/programme-intelligence.mjs';
const input={cohortParticipants:20,pairedParticipants:8,averagePre:3,averagePost:4};
const outcome=shift=>({cohort:{id:'group',labCode:'HAB',labVersion:'1'},participantCount:20,learningSummary:{suppressed:false,learningJourney:{days:[],baselineThemes:[],skillShifts:[{id:'control',label:'Perceived control',...shift}]}}});
test('comparable pairs retain the cohort denominator and unmatched remainder without pooling samples',()=>{
 assert.deepEqual(pairedComparisonCoverage(input),{status:'AVAILABLE',pairedParticipants:8,withoutComparablePair:12,cohortParticipants:20});
 const report=buildProgrammeReport(outcome({...input,pairedParticipants:8}));assert.equal(report.comparisons[0].withoutComparablePair,12);assert.ok(report.charts.some(x=>x.id==='paired-control'));
});
test('small complementary cells suppress counts, averages and differences together',()=>{
 for(const pairedParticipants of [1,2,18,19]){
  const report=buildProgrammeReport(outcome({pairedParticipants,averagePre:123456,averagePost:234567}));
  assert.equal(report.comparisons[0].status,'SUPPRESSED');assert.equal(report.comparisons[0].pairedParticipants,null);assert.equal(report.comparisons[0].withoutComparablePair,null);assert.ok(!report.charts.some(x=>x.id==='paired-control'));assert.doesNotMatch(JSON.stringify(report),/123456|234567/);
 }
});
test('zero, unavailable, inconsistent and explicitly withheld pairs are different states',()=>{
 assert.equal(pairedComparisonCoverage({...input,pairedParticipants:0}).status,'NO_COMPARABLE_PAIR');
 for(const value of [undefined,null,-1,21,1.5])assert.equal(pairedComparisonCoverage({...input,pairedParticipants:value}).status,'UNAVAILABLE');
 assert.equal(pairedComparisonCoverage({...input,averagePre:null}).status,'UNAVAILABLE');
 assert.equal(pairedComparisonCoverage({...input,suppressed:true}).status,'SUPPRESSED');
 assert.equal(buildProgrammeReport({...outcome(input),participantCount:4}).comparisons.length,0);
});

test('API projection removes withheld averages and unknown fields without mutating source aggregates',()=>{
 const source={suppressed:false,learningJourney:{days:[],skillShifts:[{id:'control',label:'Perceived control',pairedParticipants:19,averagePre:123456,averagePost:234567,averageShift:111111,privateText:'SECRET'}]}};
 const before=structuredClone(source);const result=sanitizeLearningComparisons(source,20);
 assert.equal(result.learningJourney.skillShifts[0].comparisonStatus,'SUPPRESSED');
 assert.doesNotMatch(JSON.stringify(result),/123456|234567|111111|SECRET|privateText/);assert.deepEqual(source,before);
 assert.equal(buildProgrammeReport({cohort:{id:'group'},participantCount:20,learningSummary:result}).comparisons[0].status,'SUPPRESSED');
});

test('inconsistent or suppressed RPC populations fail closed before serialization',()=>{
 const good={participantCount:20,suppressed:false,minimumReportableCohortSize:5};assert.equal(programmeAggregateScopeMatches(good,good),true);
 for(const other of [{...good,participantCount:19},{...good,suppressed:true},{...good,participantCount:null},{...good,minimumReportableCohortSize:25}])assert.equal(programmeAggregateScopeMatches(good,other),false);
 const result=sanitizeLearningComparisons({participantCount:21,learningJourney:{skillShifts:[{averagePre:123456}]}},20);assert.equal(result.suppressed,true);assert.doesNotMatch(JSON.stringify(result),/123456/);
});
