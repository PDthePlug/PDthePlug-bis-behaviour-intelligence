import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const root=new URL('../supabase/migrations/',import.meta.url);
const uid='00000000-0000-0000-0000-000000000001';
const tables=['learners','consent_records','lab_enrollments','responses','evidence_records','hypotheses','experiments','measurement_values','measurement_sources','audit_events'];
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
create function private.current_app_user_id() returns text language sql as $$select auth.uid()::text$$;
create function public.learner_bis_lab_runtime(text) returns table(version text,runtime_mode text) language sql as $$select 'v1'::text,'DYNAMIC'::text where current_setting('test.published',true)='yes'$$;
grant usage on schema auth,private to authenticated;grant execute on all functions in schema auth,private to authenticated;`);
const schema=await readFile(new URL('20260909000000_bis_production.sql',root),'utf8');
for(const table of tables){const sql=schema.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`,'i'));assert.ok(sql,table);await db.exec(sql[0]);}
// Canonical response metadata columns; publication/runtime authentication is separately
// exercised by continuity tests. This fixture isolates actual write constraints/RLS.
await db.exec(`alter table learners add column delivery_edition text not null default 'school';
alter table responses add column lab_code text not null default 'HAB',add column delivery_edition text not null default 'school',add column prompt_version text not null default '1',add column privacy_class text not null default 'P2',add column provenance text not null default 'SR';`);
await db.exec(await readFile(new URL('20261001103000_universal_lab_measurement_scope.sql',root),'utf8'));
for(const table of tables){
 const owner=table==='learners'?'user_id':table==='audit_events'?'actor_id':'user_id';
 await db.exec(`alter table ${table} enable row level security;grant select,insert,update,delete on ${table} to authenticated;
 create policy own on ${table} for all to authenticated using(${owner}=private.current_app_user_id()) with check(${owner}=private.current_app_user_id());`);
}
await db.exec(await readFile(new URL('20261004120033_atomic_universal_evidence_writes.sql',root),'utf8'));
test.after(()=>db.close());
test.beforeEach(async()=>{
 await db.exec(`reset role;truncate ${tables.join(',')} cascade;set test.user_id='${uid}';set test.published='yes';
 insert into learners(user_id,email,display_name,age_band) values('${uid}','test@example.invalid','Local specimen','ADULT');
 insert into consent_records(id,user_id,policy_version,scope,status) values('consent','${uid}','1','product','GRANTED');
 insert into lab_enrollments(id,user_id,lab_code,lab_version,current_investigation) values('enrolment','${uid}','HAB','v1',7);set role authenticated;`);
});
const entry=(id='HAB.I1.A',value=1)=>({semanticFieldId:id,value:JSON.stringify(value),responseStatus:'ANSWERED',sensitivity:'P2',type:'INTEGER'});
const save=(items=[entry()],enrolment='enrolment')=>db.query('select bis_save_universal_responses($1,1,$2::jsonb)',[enrolment,JSON.stringify(items)]);
const rows=async(table)=>(await db.query(`select * from ${table} order by id`)).rows;
async function plan(value=1){const [r]=await rows('responses');return {code:'HAB.MEASURE',value:JSON.stringify(value),formulaVersion:'test1',sources:[{semanticFieldId:r.semantic_field_id,responseId:r.id,value:r.value}]};}
const sync=plans=>db.query('select bis_sync_universal_measurements($1,$2::jsonb)',['enrolment',JSON.stringify(plans)]);
test('a failed page leaves every raw response, evidence record and audit unchanged',async()=>{
 await assert.rejects(save([entry(),{...entry('HAB.I1.B'),value:'invalid JSON'}]));
 for(const table of ['responses','evidence_records','audit_events'])assert.deepEqual(await rows(table),[]);
});
test('identical retries retain one response and corrections preserve both linked histories',async()=>{
 await save();const original=await rows('responses');await save();assert.deepEqual(await rows('responses'),original);
 await save([entry('HAB.I1.A',2)]);const responses=await rows('responses'),evidence=await rows('evidence_records');
 assert.equal(responses.length,2);assert.equal(evidence.length,2);
 const current=responses.find(r=>r.response_status==='ANSWERED');assert.equal(current.supersedes_response_id,original[0].id);
 assert.equal(evidence.find(e=>e.source_object_id===original[0].id).status,'SUPERSEDED');
 assert.equal(evidence.find(e=>e.source_object_id===current.id).status,'ACTIVE');
});
test('passed private answers replace current evidence with withdrawn records',async()=>{
 await save();await save([{...entry(),responseStatus:'PASS',value:'null'}]);
 assert.deepEqual((await rows('evidence_records')).map(r=>r.status).sort(),['SUPERSEDED','WITHDRAWN']);
});
test('wrong ownership, withdrawn consent, inactive learner and offline title cannot write',async()=>{
 await assert.rejects(save([entry()],'other'),/own Lab/);
 await db.query("update consent_records set status='WITHDRAWN'");await assert.rejects(save(),/consent/);
 await db.query("update consent_records set status='GRANTED'");await db.query("update learners set status='INACTIVE'");await assert.rejects(save(),/consent/);
 await db.query("update learners set status='ACTIVE'");await db.exec("set test.published='no'");await assert.rejects(save(),/not available/);
 assert.deepEqual(await rows('responses'),[]);
});
test('measurement values and source links commit together with exact current source values',async()=>{
 await save();const first=await plan();await sync([first]);
 assert.equal((await rows('measurement_values'))[0].evidence_strength,'LIMITED');
 assert.equal((await rows('measurement_sources'))[0].source_object_id,first.sources[0].responseId);
 const before=await rows('measurement_values'),links=await rows('measurement_sources');
 await assert.rejects(sync([{...first,value:'2'},{...first,code:'HAB.OTHER',sources:[{...first.sources[0],value:'999'}]}]),/inputs changed/);
 assert.deepEqual(await rows('measurement_values'),before);assert.deepEqual(await rows('measurement_sources'),links);
});
test('stale and foreign response sources cannot create a measurement snapshot',async()=>{
 await save();const first=await plan();await save([entry('HAB.I1.A',2)]);
 await assert.rejects(sync([first]),/inputs changed/);
 await assert.rejects(sync([{...first,sources:[{...first.sources[0],responseId:'foreign'}]}]),/inputs changed/);
 assert.deepEqual(await rows('measurement_values'),[]);
});
test('failure inserting a source restores the previous measurement and all previous links',async()=>{
 await save();const first=await plan();await sync([first]);const before=await rows('measurement_values'),links=await rows('measurement_sources');
 await db.exec("reset role;alter table measurement_sources add constraint injected_failure check(input_value<>'1') not valid;set role authenticated;");
 await assert.rejects(sync([{...first,value:'2'}]),/injected_failure/);
 assert.deepEqual(await rows('measurement_values'),before);assert.deepEqual(await rows('measurement_sources'),links);
 await db.exec('reset role;alter table measurement_sources drop constraint injected_failure;set role authenticated;');
});
