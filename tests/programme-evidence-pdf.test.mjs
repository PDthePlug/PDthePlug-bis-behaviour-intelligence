import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'bis-report-proof-'));
for(const name of ['programme-evidence-flow','programme-report-pdf']){
 const src=await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
 const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('"./programme-evidence-flow"','"./programme-evidence-flow.mjs"');
 await writeFile(join(dir,`${name}.mjs`),code);
}
const {renderProgrammeOutcomePdf}=await import(pathToFileURL(join(dir,'programme-report-pdf.mjs')).href);
test.after(()=>rm(dir,{recursive:true,force:true}));
const outcome={cohort:{id:'group',name:'Universal report specimen',labCode:'RES',labVersion:'1',startsOn:null,endsOn:null},participantCount:6,suppressed:false,minimumReportableCohortSize:5,metrics:null,evidenceFlow:{runtimeMode:'DYNAMIC',participantCount:6,suppressed:false,stages:[{investigation:7,participants:3,responses:24,suppressed:false},{investigation:8,participants:null,responses:null,suppressed:true}],totals:{recordedResponses:24,anchoredMeasures:9,startedExperiment:3,completed:null},privacyNote:'Counts describe recorded evidence, not proof of change.'}};
test('actual Universal PDF renders source-linked counts without legacy behaviour claims',()=>{
 const bytes=Buffer.from(renderProgrammeOutcomePdf(outcome));const text=bytes.toString('latin1');assert.ok(bytes.length>1000);assert.match(text,/%PDF/);assert.match(text,/RESPONSES RECORDED/);assert.match(text,/24/);assert.match(text,/3 learners; 24 recorded responses/);assert.doesNotMatch(text,/Observed adherence|Prediction accuracy|Private wording/);
});
test('suppressed Universal PDF withholds evidence totals',()=>{
 const text=Buffer.from(renderProgrammeOutcomePdf({...outcome,participantCount:4,evidenceFlow:{...outcome.evidenceFlow,suppressed:true,totals:{...outcome.evidenceFlow.totals,recordedResponses:987654}}})).toString('latin1');assert.match(text,/Report withheld/);assert.doesNotMatch(text,/987654|RESPONSES RECORDED/);
});
