import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema private; create schema auth;
create table role_assignments(user_id text,principal_email text,role text,status text,scope_type text,scope_id text);
create table crm_organisations(id uuid primary key); create table crm_opportunities(id uuid primary key,stage text);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function private.current_email() returns text language sql as $$ select current_setting('test.email',true) $$;
create function private.current_app_user_id() returns text language sql as $$ select auth.uid()::text $$;
create function private.has_staff_role(text) returns boolean language sql as $$ select $1='SYSTEM_ADMIN' and current_setting('test.admin',true)='true' $$;
create function private.has_commercial_access() returns boolean language sql as $$ select auth.uid() is not null and exists(select 1 from public.role_assignments where principal_email=private.current_email() and status='ACTIVE' and scope_type='COMMERCIAL' and scope_id='GLOBAL') $$;
grant usage on schema auth,private to authenticated; grant select on role_assignments,crm_opportunities to authenticated; grant update on crm_opportunities to authenticated;`);
const files = ['20261006232429_bis_commercial_intelligence_v1.sql','20261006232449_bis_commercial_intelligence_v1_indexes.sql','20261006233844_bis_commercial_intelligence_v1_least_privilege.sql','20261006234315_bis_commercial_intelligence_v1_immutable_audit.sql','20261007085251_bis_commercial_intelligence_atomic_operations.sql'];
for (const name of files) await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
test.after(()=>db.close());
const opp='00000000-0000-0000-0000-000000000002';
const run={run_type:'MORNING_BRIEF',input_fingerprint:'fixture',summary:'Synthetic QA brief'};
const rec={opportunity_id:opp,signal_key:'synthetic',kind:'FOLLOW_UP',priority:'HIGH',title:'Synthetic',rationale:'Fixture only',recommended_action:'Review',evidence:[],confidence:80,score:80};
const artifact={artifact_type:'FOUNDER_BRIEF',title:'Synthetic brief',content:'Fixture only'};
async function commit(recommendations=[rec],doc=artifact,reuse=false,spec=run){return (await db.query('select bis_commit_commercial_run($1,$2,$3,$4,$5) as result',[JSON.stringify(spec),JSON.stringify(recommendations),'[]',JSON.stringify(doc),reuse])).rows[0].result;}
const decide=(id,decision='APPROVED')=>db.query('select bis_decide_commercial_recommendation($1,$2,null) as result',[id,decision]);
const count=async table=>(await db.query('select count(*)::int as n from '+table)).rows[0].n;
test.beforeEach(async()=>{await db.exec(`reset role; truncate crm_agent_runs,crm_recommendations,crm_approvals,crm_generated_artifacts,crm_signal_events,role_assignments,crm_opportunities cascade;
set test.email='qa@example.invalid';set test.uid='00000000-0000-0000-0000-000000000001';set test.admin='false';
insert into crm_opportunities values ('${opp}','DRAFT_READY');
insert into role_assignments values ('00000000-0000-0000-0000-000000000001','qa@example.invalid','COMMERCIAL_LEAD','ACTIVE','COMMERCIAL','GLOBAL');set role authenticated;`);});
test('failed replacement rolls back every row and keeps the preceding open recommendations',async()=>{
 const original=await commit();
 await assert.rejects(commit([rec],{...artifact,content:null}));
 assert.equal(await count('crm_agent_runs'),1); assert.equal(await count('crm_generated_artifacts'),1);
 assert.equal((await db.query('select status from crm_recommendations where id=$1',[original.recommendations[0].id])).rows[0].status,'OPEN');
 await assert.rejects(commit([rec,rec])); assert.equal(await count('crm_agent_runs'),1);
});
test('automatic concurrent refreshes reuse the same complete run and preserve stamped identity',async()=>{
 const [a,b]=await Promise.all([commit([rec],artifact,true),commit([rec],artifact,true)]);
 assert.equal(a.run.id,b.run.id); assert.equal(await count('crm_agent_runs'),1);
 assert.equal(a.run.requested_by,'qa@example.invalid'); assert.equal(a.recommendations[0].created_by,'qa@example.invalid');
 const c=await commit([rec],artifact,false,{...run,input_fingerprint:'changed'});
 assert.notEqual(c.run.id,a.run.id); assert.equal(await count('crm_agent_runs'),2);
 assert.equal((await db.query('select status from crm_recommendations where id=$1',[a.recommendations[0].id])).rows[0].status,'EXPIRED');
});
test('one human decision is committed with its audit and a racing second decision is rejected',async()=>{
 const a=await commit();const id=a.recommendations[0].id;
 const results=await Promise.allSettled([decide(id),decide(id,'DISMISSED')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await count('crm_approvals'),1);
 assert.equal((await db.query('select decided_by from crm_approvals')).rows[0].decided_by,'qa@example.invalid');
 await db.exec('reset role; revoke insert on crm_approvals from authenticated;set role authenticated;');
 const b=await commit([rec],artifact,false,{...run,input_fingerprint:'next'});
 await assert.rejects(decide(b.recommendations[0].id));
 assert.equal((await db.query('select status from crm_recommendations where id=$1',[b.recommendations[0].id])).rows[0].status,'OPEN');
 await db.exec('reset role;grant insert on crm_approvals to authenticated;set role authenticated;');
});
test('outreach draft and run commit together and a held opportunity remains untouched',async()=>{
 const doc={...artifact,artifact_type:'OUTREACH_DRAFT',opportunity_id:opp};const spec={...run,run_type:'DRAFT'};
 await assert.rejects(commit([],{...doc,content:null},false,spec));assert.equal(await count('crm_agent_runs'),0);
 const a=await commit([],doc,false,spec); assert.equal(a.artifact.status,'DRAFT');
 await db.exec(`reset role;update crm_opportunities set stage='HOLD';set role authenticated;`);
 await assert.rejects(commit([],doc,false,spec));assert.equal(await count('crm_agent_runs'),1);
});
test('anonymous, unrelated, scoped, revoked and read-only identities cannot create runs or decisions',async()=>{
 const a=await commit();
 for(const [role,status,scope,email] of [['COMMERCIAL_READ_ONLY','ACTIVE','GLOBAL','qa@example.invalid'],['COMMERCIAL_LEAD','REVOKED','GLOBAL','qa@example.invalid'],['COMMERCIAL_LEAD','ACTIVE','OTHER','qa@example.invalid'],['COMMERCIAL_LEAD','ACTIVE','GLOBAL','other@example.invalid']]){
  await db.query('reset role');await db.query('update role_assignments set role=$1,status=$2,scope_id=$3,principal_email=$4',[role,status,scope,email]);await db.exec('set role authenticated');
  await assert.rejects(commit());await assert.rejects(decide(a.recommendations[0].id));
 }
 await db.exec('reset role;set role anon');await assert.rejects(commit());
 await db.exec('reset role;set role authenticated'); assert.equal(await count('crm_agent_runs'),0,'RLS hides rows from the unrelated identity');
});

test('a reviewed draft is a new saved artifact and retains the original wording and author',async()=>{
 const spec={...run,run_type:'DRAFT'};const original=await commit([],{artifact_type:'OUTREACH_DRAFT',opportunity_id:opp,title:'Initial message',content:'Initial programme-specific wording.'},false,spec);
 const revised=await commit([],{artifact_type:'OUTREACH_DRAFT',opportunity_id:opp,title:'Reviewed message',content:'Reviewed programme-specific wording.'},false,{...spec,provider:'HUMAN',summary:`Revision of draft ${original.artifact.id}`});
 assert.notEqual(original.artifact.id,revised.artifact.id);assert.equal(await count('crm_generated_artifacts'),2);
 const saved=(await db.query('select content,created_by from crm_generated_artifacts where id=$1',[original.artifact.id])).rows[0];
 assert.equal(saved.content,'Initial programme-specific wording.');assert.equal(saved.created_by,'qa@example.invalid');
 assert.equal(revised.artifact.content,'Reviewed programme-specific wording.');assert.equal(revised.artifact.status,'DRAFT');
});
