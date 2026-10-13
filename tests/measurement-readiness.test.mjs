import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMeasurementReadiness} from '../lib/measurement-readiness.mjs';
const definition={identity:{code:'HAB',version:'authored-2'},investigations:[{number:7,prompts:[{id:'day',type:'BOOLEAN'},{id:'days',label:'Days recorded',type:'INTEGER'},{id:'pre',type:'INTEGER'},{id:'post',type:'INTEGER'},{id:'shift',type:'INTEGER'},{id:'profile',type:'TEXT'}]}],computedFields:[{id:'days',label:'Days recorded',operation:'COUNT_PRESENT',inputs:['day']},{id:'shift',label:'Reported shift',operation:'DIFFERENCE',inputs:['post','pre']},{id:'profile',label:'Earlier rating',operation:'COPY',inputs:['pre']}],indicatorRegistry:[{code:'BEI-06',label:'Experiment Adherence Rate',promptIds:['day','days'],primaryPromptId:null,status:'BOUND'},{code:'BEI-07',label:'Reported shift',promptIds:['shift'],primaryPromptId:'shift',status:'BOUND'}]};
test('day counts and registered indicator fields never masquerade as opportunity rates',()=>{
 const audit=auditMeasurementReadiness(definition);
 assert.equal(audit.status,'REVIEW');assert.equal(audit.calculationCount,2);assert.equal(audit.projectionCount,1);
 assert.equal(audit.indicators[0].status,'NEEDS_FORMULA');assert.equal(audit.indicators[1].status,'CALCULATED');
 assert.match(audit.issues[0].message,/numerator, denominator/);
 assert.deepEqual(audit.calculations.find(x=>x.id==='shift').sourceFieldIds,['post','pre']);
});
test('invalid, cyclic and unregistered calculation graphs remain blocked',()=>{
 for(const fields of [[{id:'days',operation:'COUNT_PRESENT',inputs:['unknown']}],[{id:'days',operation:'COPY',inputs:['days']}]]){
  const audit=auditMeasurementReadiness({...definition,computedFields:fields});assert.equal(audit.status,'BLOCKED');assert.equal(audit.calculationCount,0);assert.ok(audit.calculations.every(x=>x.status==='UNRESOLVED'));
 }
});
test('prediction inputs and copied profiles remain source evidence, with no permission to expose private values',()=>{
 const audit=auditMeasurementReadiness({...definition,learnerResponses:{pre:'SECRET PRIVATE VALUE'},indicatorRegistry:[{code:'BEI-P',label:'Predicted adherence rate',promptIds:['pre'],primaryPromptId:'pre',status:'BOUND'},{code:'BEI-X',label:'Earlier rating',promptIds:['profile'],primaryPromptId:'profile',status:'BOUND'}]});
 assert.equal(audit.status,'SUPPORTED');assert.equal(audit.indicators[0].status,'SOURCE_ONLY');assert.equal(audit.indicators[1].status,'PROJECTED');assert.doesNotMatch(JSON.stringify(audit),/SECRET PRIVATE VALUE|learnerResponses/);assert.match(audit.boundary,/appropriate consent/);
});
