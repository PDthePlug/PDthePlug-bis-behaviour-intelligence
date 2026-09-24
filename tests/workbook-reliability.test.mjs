import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../lib/workbook-save-queue.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const { WorkbookSaveQueue } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const edit = (value, field='HAB.WB.SCHOOL.DAY1.F1', step='HAB.PROGRAMME.DAY1') => ({semanticFieldId:field,semanticStepId:step,sourceFieldKey:'day1-1',value});
test('typing while a save is in flight sends the newer revision before reporting saved', async()=>{
 const q=new WorkbookSaveQueue();q.edit(edit('first'));let release;const received=[];
 const pending=q.flush(async items=>{received.push(items[0].value);if(received.length===1)await new Promise(resolve=>release=resolve)});
 q.edit(edit('newest'));release();assert.equal(await pending,true);assert.deepEqual(received,['first','newest']);assert.equal(q.size,0);
});
test('failure retains edits and blocks a completion gate until retry succeeds',async()=>{
 const q=new WorkbookSaveQueue();q.edit(edit('keep me'));let completed=false;
 if(await q.flush(async()=>{throw new Error('offline')}))completed=true;
 assert.equal(completed,false);assert.equal(q.size,1);
 const sent=[];assert.equal(await q.flush(async items=>sent.push(...items)),true);assert.equal(sent[0].value,'keep me');assert.equal(q.size,0);
});
test('navigation does not discard pending edits from an unmounted page',async()=>{
 const q=new WorkbookSaveQueue();q.edit(edit('page one'));q.edit(edit('page two','HAB.WB.SCHOOL.DAY2.F1','HAB.PROGRAMME.DAY2'));
 const sent=[];await q.flush(async items=>sent.push(...items));assert.deepEqual(sent.map(x=>x.semanticStepId),['HAB.PROGRAMME.DAY1','HAB.PROGRAMME.DAY2']);
});
test('concurrent autosave and completion share a single writer',async()=>{
 const q=new WorkbookSaveQueue();q.edit(edit('one'));let release,calls=0;
 const write=async()=>{calls++;await new Promise(resolve=>release=resolve)};
 const a=q.flush(write),b=q.flush(write);assert.equal(a,b);release();assert.equal(await a,true);assert.equal(await b,true);assert.equal(calls,1);
});
test('large authored pages save in bounded batches without losing fields',async()=>{
 const q=new WorkbookSaveQueue();for(let i=0;i<145;i++)q.edit(edit(String(i),`DEC.WB.SCHOOL.DAY3.F${i}`));
 const sizes=[];await q.flush(async items=>sizes.push(items.length));assert.deepEqual(sizes,[60,60,25]);assert.equal(q.size,0);
});
test('completion stops before posting progress when the flush fails',async()=>{
 const s=await readFile(new URL('../app/learning/programme-player.tsx',import.meta.url),'utf8');
 const fn=s.slice(s.indexOf('async function completePage()'),s.indexOf('  if (error && !programme)'));
 assert.match(fn,/if \(!\(await saveDirtyResponses\(\)\)\) \{ setCompleting\(false\); return; \}/);
 assert.ok(fn.indexOf('await saveDirtyResponses()')<fn.indexOf('action: "saveProgress"'));
});


test('reader navigation keeps previous task in browser history and makes exit explicit', async()=>{
 const s=await readFile(new URL('../app/learning/programme-player.tsx',import.meta.url),'utf8');
 assert.match(s,/useSearchParams/);
 assert.match(s,/params\.set\("page", String\(next \+ 1\)\)/);
 assert.match(s,/router\.push\(/);
 assert.match(s,/<ArrowLeft \/> Exit reader/);
 assert.match(s,/onClick=\{\(\) => goToProgrammePage\(selected - 1\)\}/);
});
