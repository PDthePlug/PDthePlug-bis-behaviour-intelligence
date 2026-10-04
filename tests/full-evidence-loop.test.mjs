import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {loadContentTools} from "../scripts/lib/load-content-tools.mjs";
import {prepareUniversalLabPresentation} from "../lib/universal-lab-presentation.mjs";
import {availableLabPrompts,validateLabSubmission} from "../lib/lab-interaction-contract.mjs";
import {evaluateUniversalComputed,universalComputedLeafInputs,universalExperimentEvidenceProgress,universalExperimentReviewReady} from "../lib/universal-lab-v2.mjs";
import {buildEvidencePortfolio} from "../lib/evidence-portfolio.mjs";
const tools=await loadContentTools();
const definitions=new Map();
try{
  for(const volume of [1,2])for(const draft of await tools.adaptBisVolumeSource(await readFile(new URL(`../content/sources/volume-${volume}.docx`,import.meta.url)),volume,"certification")){
    const raw=JSON.parse(new TextDecoder().decode(draft.packageBytes));
    if (!["HAB","DEC","MON","RSK","IDN"].includes(raw.identity.code))continue;
    definitions.set(raw.identity.code,prepareUniversalLabPresentation(JSON.parse((await tools.compileUniversalLab(draft.packageBytes,raw.identity.code,"certification")).content)));
  }
}finally{await tools.dispose();}
function value(prompt,specimen,stage,day){
  if(prompt.type==="INTEGER")return String((prompt.min??1)+(specimen+stage)%((prompt.max??10)-(prompt.min??1)+1));
  if(prompt.type==="BOOLEAN")return prompt.allowNoOpportunity && day===3 && specimen%2===0 ? "No opportunity":(specimen+day)%3===0?"No":"Yes";
  if(prompt.type==="CATEGORICAL")return prompt.options[specimen%prompt.options.length];
  if(prompt.type==="MULTI_SELECT")return JSON.stringify([prompt.options[specimen%prompt.options.length]]);
  if(prompt.type==="DATE")return "2026-10-"+String(day||1).padStart(2,"0");
  return `Synthetic specimen ${specimen}: I noticed the planned cue, recorded this observation, and will check it against the next opportunity.`;
}
for(const [code,definition] of definitions)for(let specimen=1;specimen<=4;specimen++){
  test(`${code} specimen ${specimen}: baseline, Phase A, seven calendar days, Review, Profile and five private portfolio anchors`,()=>{
    assert.equal(definition.experiment.days,7);
    const responses={},evidence=[];
    const save=(stage,day=0)=>{
      const prompts=availableLabPrompts(definition,stage,day).filter(p=>!p.readOnly);
      const items=prompts.map((prompt,index)=>({semanticFieldId:prompt.id,value:value(prompt,specimen,stage,day),responseStatus:specimen===4 && index===0 && stage===5?"PASS":"ANSWERED"}));
      const saved=validateLabSubmission(definition,stage,day,items,responses);
      for(const response of saved){
        responses[response.semanticFieldId]={value:response.value,status:response.responseStatus,responseId:`${code}:${specimen}:${response.semanticFieldId}`};
        evidence.push({labCode:code,labVersion:"certification",investigationId:stage?`${code}.I${stage}`:`${code}.BASELINE`,status:response.responseStatus==="PASS"?"WITHDRAWN":"ACTIVE",sourceObjectId:responses[response.semanticFieldId].responseId});
      }
      assert.ok(saved.every(r=>!definition.computedFields.some(f=>f.id===r.semanticFieldId)),"calculated values are not re-entered");
    };
    save(0);for(let stage=1;stage<=6;stage++)save(stage);
    for(let day=1;day<=7;day++){
      if(day<7){const future=availableLabPrompts(definition,7,day+1).find(p=>!p.readOnly);assert.throws(()=>validateLabSubmission(definition,7,day,[{semanticFieldId:future.id,value:value(future,specimen,7,day+1)}],responses),/outside/);}
      save(7,day);
      const progress=universalExperimentEvidenceProgress(definition,responses,day);
      assert.equal(progress.evidenceDaysRecorded,day);
      assert.equal(progress.todayEvidenceRecorded,true);
      assert.equal(universalExperimentReviewReady(definition,responses,day),day===7);
    }
    save(8,8);save(9,8);
    const raw=Object.fromEntries(Object.entries(responses).filter(([,r])=>r.status==="ANSWERED").map(([id,r])=>[id,r.value]));
    const computed=evaluateUniversalComputed(definition,raw);
    const measurements=definition.computedFields.filter(f=>computed[f.id]!=null).map(f=>({id:`metric:${f.id}`,code:f.id,value:JSON.stringify(computed[f.id]),status:"VALUE",enrolmentId:"specimen",formulaVersion:"universal-lab-v2:computed"}));
    const measurementSources=measurements.flatMap(m=>universalComputedLeafInputs(definition,m.code,raw).filter(id=>responses[id]?.status==="ANSWERED").map(id=>({measurementId:m.id,sourceObjectId:responses[id].responseId})));
    const portfolio=buildEvidencePortfolio({enrolments:[{id:"specimen",labCode:code,labVersion:"certification",status:"COMPLETED",currentInvestigation:9}],evidence,measurements,measurementSources});
    assert.equal(portfolio[0].summary.recordedAnchors,5);
    assert.ok(portfolio[0].metrics.every(m=>m.sourceCount>0 && m.sourceAnchors.length>0));
    assert.equal(JSON.stringify(portfolio).includes("Synthetic specimen"),false,"original wording stays private");
    assert.ok(Object.values(responses).some(r=>r.status==="PASS") || specimen!==4);
  });
}

test("missing observation counts stay unavailable rather than becoming invented zeros",()=>{
  for(const definition of definitions.values())for(const field of definition.computedFields.filter(f=>["COUNT_TRUE","COUNT_PRESENT"].includes(f.operation)))assert.equal(evaluateUniversalComputed(definition,{})[field.id],null);
});
