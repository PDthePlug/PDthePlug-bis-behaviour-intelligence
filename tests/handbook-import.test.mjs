import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root=new URL('../public/handbooks/v1/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const decode=raw=>JSON.parse(gunzipSync(Buffer.from(raw,'base64')));
for(const item of manifest.handbooks)test(`${item.code} ${item.edition}: complete authored pages and stable fields`,async()=>{
 const bytes=gunzipSync(Buffer.from(await readFile(new URL(item.asset,root),'utf8'),'base64'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
 const p=JSON.parse(bytes);assert.equal(p.labCode,item.code);assert.equal(p.edition,item.edition);assert.equal(p.treatment.pages.length,13);
 const ids=p.treatment.pages.flatMap(p=>[...p.html.matchAll(/data-field-id="([^"]+)"/g)].map(m=>m[1]));assert.equal(ids.length,item.fields);assert.equal(new Set(ids).size,ids.length);
 assert.equal(p.treatment.pages[0].key,'Welcome');assert.equal(p.treatment.pages.at(-1).key,'Certificate');
 if(item.code==='HAB'){
  const dir=new URL('../public/programmes/chunks/',import.meta.url);const names=(await readdir(dir)).filter(n=>n.startsWith('habit-'+item.edition)).sort();
  const old=decode((await Promise.all(names.map(n=>readFile(new URL(n,dir),'utf8')))).join(''));
  const previous=old.treatment.pages.flatMap(p=>[...p.html.matchAll(/data-field-id="([^"]+)"/g)].map(m=>m[1]));assert.deepEqual(ids,previous);
  const handoff=p.treatment.pages.find(p=>p.key==='Day 3');for(const marker of Object.values(handoff.labHandoff))assert.ok(handoff.html.includes(marker));
  const day2=p.treatment.pages.find(p=>p.key==='Day 2').html;assert.match(day2,/<th scope="col">Kind of Evidence<\/th>/);assert.match(day2,/<td data-label="Kind of Evidence">Written observation<\/td>/);
 }
});
test('five supplied learning handbooks open directly; unprovided handbooks remain honest',async()=>{
 const c=JSON.parse(await readFile(new URL('../lib/bis-catalogue.json',import.meta.url),'utf8'));
 assert.deepEqual(c.modules.filter(m=>m.learningStatus==='live').map(m=>m.code),['HAB','DEC','MON','IDN','ATT']);
 for(const m of c.modules.filter(m=>m.learningStatus==='live'))assert.ok(m.learningHref);
});
