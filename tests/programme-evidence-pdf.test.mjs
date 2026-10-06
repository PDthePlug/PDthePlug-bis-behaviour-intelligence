import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {buildProgrammeReport} from '../lib/programme-intelligence.mjs';
const dir=await mkdtemp(new URL('../.pdf-proof-',import.meta.url));
const src=await readFile(new URL('../lib/programme-report-pdf.ts',import.meta.url),'utf8');
const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('"./programme-intelligence.mjs"',JSON.stringify(new URL('../lib/programme-intelligence.mjs',import.meta.url).href)).replace('"./experience/programme-experience.mjs"',JSON.stringify(new URL('../lib/experience/programme-experience.mjs',import.meta.url).href));
await writeFile(join(dir,'programme-report-pdf.mjs'),code);
const {renderProgrammeOutcomePdf}=await import(pathToFileURL(join(dir,'programme-report-pdf.mjs')).href);
const leap9Source = await readFile(new URL('../lib/experience/leap9-report.ts', import.meta.url), 'utf8');
await writeFile(join(dir, 'leap9-report.mjs'), ts.transpileModule(leap9Source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace("'./programme-experience.mjs'", JSON.stringify(new URL('../lib/experience/programme-experience.mjs', import.meta.url).href)));
const { leap9IllustrativeReport } = await import(pathToFileURL(join(dir, 'leap9-report.mjs')).href);
test.after(()=>rm(dir,{recursive:true,force:true}));
const outcome={cohort:{id:'group',name:'Universal report specimen – Réfiloë Dlamini',labCode:'RES',labVersion:'1',startsOn:null,endsOn:null},participantCount:6,suppressed:false,minimumReportableCohortSize:5,metrics:null,evidenceFlow:{runtimeMode:'DYNAMIC',participantCount:6,suppressed:false,stages:[{investigation:7,participants:3,responses:24,suppressed:false},{investigation:8,participants:null,responses:null,suppressed:true}],totals:{recordedResponses:24,anchoredMeasures:9,startedExperiment:3,completed:null},privacyNote:'Counts describe recorded evidence, not proof of change.'}};
async function inspect(bytes){const pdf=await getDocument({data:bytes,useSystemFonts:false}).promise;let text='';const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();const items=content.items.filter(item=>'str'in item);text+=items.map(item=>item.str).join(' ')+'\n';pages.push(items);}return {pdf,text,pages};}
const normalise=s=>s.replace(/\s+/g,' ').trim();
test('Universal report includes executive findings, graphics, actions, Unicode and every canonical insight',async()=>{
 const bytes=await renderProgrammeOutcomePdf(outcome);assert.ok(bytes.length>1000);assert.match(Buffer.from(bytes.slice(0,8)).toString(),/%PDF/);
 const {pdf,text,pages}=await inspect(bytes);
 assert.match(text,/Réfiloë Dlamini/);assert.match(text,/Applied Commerce®/);assert.match(text,/Executive summary/);assert.match(text,/Programme review/);assert.match(text,/24 responses and 9 measures/);assert.match(text,/Unavailable/);
 for(const insight of buildProgrammeReport(outcome).insights)for(const key of ['observation','context','interpretation','action','boundary'])assert.ok(normalise(text).includes(normalise(insight[key])),`${insight.id}:${key} absent from PDF`);
 assert.doesNotMatch(text,/Observed adherence|Prediction accuracy|SECRET_PRIVATE/);
 // Actual glyph geometry, rather than source-code snapshots.
 pages.forEach(items=>{assert.ok(items.length>2);for(const item of items){assert.ok(item.transform[4]>=47&&item.transform[4]+item.width<=548,`horizontal clipping: ${item.str}`);assert.ok(item.transform[5]>=30&&item.transform[5]<800,`vertical clipping: ${item.str}`);}});
 assert.equal(pages.length,pdf.numPages);await pdf.cleanup();
});
test('suppressed report withholds all findings and totals before any cover rendering',async()=>{
 const {pdf,text}=await inspect(await renderProgrammeOutcomePdf({...outcome,participantCount:4,evidenceFlow:{...outcome.evidenceFlow,totals:{...outcome.evidenceFlow.totals,recordedResponses:987654}}}));assert.match(text,/Report withheld/);assert.doesNotMatch(text,/987654|24 responses|Programme review|recorded experiment start/);await pdf.cleanup();
});
test('illustrative status repeats on every page and long decisions paginate with table headers',async()=>{
 const long={...outcome,decisionRegister:{decisions:Array.from({length:14},(_,i)=>({sourceTitle:`Decision ${i+1}`,decisionText:'Review the conditions and follow up with the facilitator. '.repeat(12),expectedOutcome:'A reportable observation next time.',ownerLabel:'Programme team',reviewOn:null,status:'OPEN',reviewOutcome:null,reviewNote:null}))}};
 const {pdf,text,pages}=await inspect(await renderProgrammeOutcomePdf(long,new Date('2026-10-05'),{illustrative:true}));assert.match(text,/Decision 14/);
 for(const items of pages)assert.ok(items.some(i=>i.str.includes('ILLUSTRATIVE SIMULATION')));
 assert.ok(pdf.numPages<40);await pdf.cleanup();
});

test('Leap9 sponsor report leads with practical meaning from the same fictional records as the page', async () => {
 const { pdf, text, pages } = await inspect(await renderProgrammeOutcomePdf(leap9IllustrativeReport, new Date('2026-10-06'), { illustrative: true, leap9Experience: true }));
 assert.match(text, /5 of 12 participants/);
 assert.match(text, /relevant application or workplace task/);
 assert.match(text, /programme design and evidence quality remain BIS/);
 assert.match(text, /does not certify competence or job readiness/);
 assert.match(text, /Prepared by P.D./);
 assert.doesNotMatch(text, /Strengthen the Day 3 handover|No programme decision is recorded|What did the organisation decide to change/);
 for (const items of pages) {
   assert.ok(items.some(item => item.str.includes('ILLUSTRATIVE SIMULATION')));
   for (const item of items) { assert.ok(item.transform[4] >= 47 && item.transform[4] + item.width <= 548, `horizontal clipping: ${item.str}`); assert.ok(item.transform[5] >= 30 && item.transform[5] < 800, `vertical clipping: ${item.str}`); }
 }
 assert.ok(pdf.numPages <= 5);
 await pdf.cleanup();
});
