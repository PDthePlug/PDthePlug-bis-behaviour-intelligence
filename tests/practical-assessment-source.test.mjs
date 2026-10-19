import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('the installed assessment source, criteria and evidence classes match the immutable published pack',async()=>{
 const raw=await readFile(new URL('../content/curriculum/applied-commerce/practical-assessment-v1.json',import.meta.url),'utf8');
 const sql=await readFile(new URL('../supabase/migrations/20261019142154_assessed_practice_and_transfer.sql',import.meta.url),'utf8');
 const pack=JSON.parse(raw),installed=JSON.parse(sql.match(/\$pack\$([\s\S]*?)\$pack\$::jsonb/)[1]);
 assert.deepEqual(installed,pack);assert.match(sql,new RegExp(createHash('sha256').update(raw).digest('hex')));
 assert.equal(pack.competencyId,'AC-C03');assert.deepEqual(pack.tasks.map(t=>t.stage),['APPLY','TEST_AND_REVISE','TRANSFER']);
 assert.deepEqual(pack.tasks[1].fields.map(f=>f.evidenceClass),['PREDICTION','OBSERVATION','INTERPRETATION']);
 assert.ok(pack.tasks[2].fields.some(f=>f.evidenceClass==='TRANSFER'));
 assert.match(pack.tasks[2].instruction,/earlier application has been reviewed/);
 assert.match(pack.scope,/private investigation/);assert.match(pack.boundary,/cannot establish independent real-world action/);
});
