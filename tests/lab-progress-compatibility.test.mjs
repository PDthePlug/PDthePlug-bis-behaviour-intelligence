import test from "node:test";
import assert from "node:assert/strict";
import { labCompletionRequirements, labSubmissionDefinition, labStageCompleted } from "../lib/lab-progress-compatibility.mjs";
import { validateLabSubmission } from "../lib/lab-interaction-contract.mjs";
const field = (id, type = "TEXT") => ({id,label:id,prompt:id,type,required:true});
const definition = { runtimeProfile:"UNIVERSAL_V2", experiment:{investigation:7}, presentationBaseline:{items:[field("baseline", "BOOLEAN")],metric:null}, investigations:Array.from({length:9},(_,i)=>({number:i+1,prompts:[field(`I${i+1}.original`),field(`I${i+1}.recovered`)]})) };
test("schema repair cannot reopen already accepted stages for a day-seven learner",()=>{
  const enrolment={currentInvestigation:7,status:"IN_PROGRESS"};
  const required=labCompletionRequirements(definition,enrolment);
  assert.deepEqual(required,["I8.original","I8.recovered","I9.original","I9.recovered"]);
  assert.equal(labStageCompleted(enrolment,0),true);
  assert.equal(labStageCompleted(enrolment,7),false);
  assert.equal(labStageCompleted(enrolment,8),false,"calendar review availability does not prove a saved review");
});
test("new and unfinished stages still require every corrected field",()=>{
  const enrolment={currentInvestigation:1,status:"IN_PROGRESS"};
  assert.ok(labCompletionRequirements(definition,enrolment).includes("baseline"));
  assert.throws(()=>validateLabSubmission(labSubmissionDefinition(definition,enrolment,1),1,0,[{semanticFieldId:"I1.original",value:"answer"}]),/I1.recovered/);
  assert.equal(labStageCompleted(enrolment,0,true),true,"persisted baseline save is accepted before I1");
});
test("editing completed stages validates actual edits without requiring invented historical answers",()=>{
  const adapted=labSubmissionDefinition(definition,{currentInvestigation:7,status:"IN_PROGRESS"},4);
  assert.equal(validateLabSubmission(adapted,4,0,[]).length,0);
  assert.equal(validateLabSubmission(adapted,4,0,[{semanticFieldId:"I4.original",value:"revised evidence"}]).length,1);
  assert.throws(()=>validateLabSubmission(adapted,4,0,[{semanticFieldId:"I5.original",value:"wrong step"}]),/outside/);
  assert.equal(definition.investigations[3].prompts[1].required,true,"canonical new-learner contract remains required");
});
test("completion still validates the last unfinished stage",()=>{
  assert.deepEqual(labCompletionRequirements(definition,{currentInvestigation:9,status:"IN_PROGRESS"}),["I9.original","I9.recovered"]);
});
