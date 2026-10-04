import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {readDocxTable} from '../lib/docx-table.mjs';
import {loadLearningLabRuntime,universalLearningKnownValues} from '../lib/learning-lab-runtime.mjs';
import {buildEvidencePortfolio} from '../lib/evidence-portfolio.mjs';
const cell=(text,props='')=>`<w:tc><w:tcPr>${props}</w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
const row=(...cells)=>`<w:tr>${cells.join('')}</w:tr>`;
test('Word preserves blank response rows and authored worked examples',()=>{
 const result=readDocxTable(`<w:tbl>${row(cell('Situation'),cell('Your response'))}${row(cell(''),cell(''))}${row(cell('Example'),cell('Keep this answer'))}</w:tbl>`);
 assert.deepEqual(result.tableRows,[['Situation','Your response'],['',''],['Example','Keep this answer']]);
 assert.equal(result.complex,false);assert.match(result.html,/<thead>/);assert.match(result.html,/data-label="Your response"/);assert.match(result.html,/Keep this answer/);
});
test('Word merged geometry and paragraph breaks survive rendering',()=>{
 const result=readDocxTable(`<w:tbl>${row(cell('Group','<w:gridSpan w:val="2"/><w:vMerge w:val="restart"/>'),cell('Value'))}${row(cell('','<w:gridSpan w:val="2"/><w:vMerge/>'),'<w:tc><w:p><w:r><w:t>First</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p></w:tc>')}</w:tbl>`);
 assert.equal(result.complex,true);assert.match(result.html,/colspan="2" rowspan="2"/);assert.match(result.html,/First<br\/>Second/);assert.doesNotMatch(result.html,/data-label/);
});
for(const code of ['HAB','DEC','MON','RES']) test(`${code} Universal learning loads the governed API`,async()=>{
 const urls=[];const fetcher=async url=>{urls.push(url);return Response.json(url.includes('lab-runtime')?{runtimeMode:'DYNAMIC',roles:[]}:{enrolment:{status:'IN_PROGRESS'},programmeHandoff:{totalDays:14}});};
 const result=await loadLearningLabRuntime(code,fetcher);assert.equal(result.runtimeMode,'DYNAMIC');assert.equal(result.programmeHandoff.totalDays,14);assert.deepEqual(urls,[`/api/lab-runtime?lab=${code}`,`/api/universal-lab?lab=${code}`]);
});
test('offline learning and failed availability never guess a compatibility API',async()=>{
 const urls=[];assert.equal(await loadLearningLabRuntime('HAB',async url=>{urls.push(url);return Response.json({runtimeMode:null});}),null);assert.equal(urls.length,1);
 await assert.rejects(loadLearningLabRuntime('HAB',async()=>Response.json({}, {status:503})),/availability/);
 await assert.rejects(loadLearningLabRuntime('HAB',async url=>Response.json(url.includes('lab-runtime')?{runtimeMode:'DYNAMIC'}:{},{status:url.includes('lab-runtime')?200:409})),/published Lab/);
});
test('Universal projections use only named source fields and preserve pending results',()=>{
 const runtime={definition:{identity:{code:'RES'},computedFields:[{id:'RES.RESULT',label:'Source result'},{id:'RES.PENDING',label:'Pending result'}],indicatorRegistry:[]},measurements:{'RES.RESULT':{status:'VALUE',value:7},'RES.PENDING':{status:'NA',value:0},'RES.BEI06':{status:'VALUE',value:99}}};
 assert.deepEqual(universalLearningKnownValues(runtime).map(x=>[x.labels[0],x.value,x.exact]),[['Source result','7',true],['Pending result','Not available yet',true]]);
});
test('daily coverage uses the authored duration and never treats weekly windows as days',()=>{
 const runtime={definition:{experiment:{days:14}},programmeHandoff:{experimentStarted:true,totalDays:14,evidenceDaysRecorded:3}};
 assert.deepEqual(universalLearningKnownValues(runtime).map(value=>value.value),['3 / 14','11 / 14']);
 assert.deepEqual(universalLearningKnownValues({...runtime,definition:{experiment:{days:14,cadence:'WEEKLY'}}}),[]);
 assert.deepEqual(universalLearningKnownValues({...runtime,programmeHandoff:{...runtime.programmeHandoff,totalDays:7}}),[]);
 assert.equal(universalLearningKnownValues({...runtime,programmeHandoff:{...runtime.programmeHandoff,experimentStarted:false}})[0].value,'Not available yet');
});
test('private photo counts attach to the precise enrolment and investigation without manufacturing measurements',()=>{
 const labs=buildEvidencePortfolio({enrolments:[{id:'mine',labCode:'RES',labVersion:'1'},{id:'old',labCode:'RES',labVersion:'0'}],attachments:[{enrolmentId:'mine',investigation:7,photoCount:2},{enrolmentId:'mine',investigation:0,photoCount:1},{enrolmentId:'other',investigation:7,photoCount:5}]});
 assert.equal(labs[0].summary.photos,3);assert.equal(labs[0].anchors.find(a=>a.id==='EXPERIMENT').photoCount,2);assert.equal(labs[0].summary.activeEvidenceItems,0);assert.equal(labs[0].metrics.length,0);assert.equal(labs[1].summary.photos,0);
});
test('legacy endpoints are version guarded and learning assets fail closed',async()=>{
 for(const file of ['app/api/bis/route.ts','app/api/labs/route.ts']) assert.match(await readFile(new URL('../'+file,import.meta.url),'utf8'),/legacyLabGuard/);
 const player=await readFile(new URL('../app/learning/programme-player.tsx',import.meta.url),'utf8');assert.doesNotMatch(player,/fetch\(`\/handbooks/);assert.match(player,/runtimeMode === "DYNAMIC"\) return universalLearningKnownValues/);
});
