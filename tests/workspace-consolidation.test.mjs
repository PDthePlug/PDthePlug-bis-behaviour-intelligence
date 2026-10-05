import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(), root=new URL('../supabase/migrations/',import.meta.url);
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth',true),'')::uuid$$;
create function private.current_app_user_id() returns text language sql as $$select nullif(current_setting('test.owner',true),'')$$;
create function private.current_email() returns text language sql as $$select nullif(current_setting('test.email',true),'')$$;
grant usage on schema auth,private to authenticated;grant execute on all functions in schema auth,private to authenticated;`);
const base=await readFile(new URL('20260909000000_bis_production.sql',root),'utf8');
const tables=['learners','consent_records','lab_enrollments','role_assignments','pilot_cohorts','cohort_members','safeguarding_cases','lab_assignments','audit_events'];
for(const table of tables)await db.exec(base.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`,'i'))[0]);
await db.exec(`create function private.has_staff_role(requested_role text) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.role_assignments where role=requested_role and status='ACTIVE' and lower(principal_email)=private.current_email())$$;
create table content_library_items(id text primary key,kind text,code text,status text);
create table content_library_versions(id text primary key,item_id text,version text,status text,runtime_status text);
create table content_runtime_activations(id text primary key,item_id text,version_id text,status text,runtime_mode text,activated_at timestamptz default now());
`);
for(const name of ['20260912090000_bis_commercial_workspace.sql','20261001123500_programme_onboarding.sql','20261005151940_workspace_consolidation_integrity.sql','20261005160300_staff_access_transactions.sql'])await db.exec(await readFile(new URL(name,root),'utf8'));
test.after(()=>db.close());
const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
const actor=async(email='admin@local.invalid',owner='')=>db.exec(`reset role;set test.auth='00000000-0000-0000-0000-000000000001';set test.owner='${owner}';set test.email='${email}';set role authenticated;`);
const rpc=async(name,args=[])=> (await query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args))[0].result;
const payload=()=>({id:'group',name:'Systems programme',facilitatorEmail:'facilitator@local.invalid',programmeFormat:'SINGLE_LAB',labPlan:[{code:'SYS',version:'v1'}],emails:['learner@local.invalid','pending@local.invalid']});
test.beforeEach(async()=>{
 await db.exec(`reset role;set test.auth='';set timezone='UTC';truncate crm_organisations,crm_audit_events,content_runtime_activations,content_library_versions,content_library_items,${tables.join(',')} cascade;
 insert into learners(user_id,email,display_name,age_band) values('learner','learner@local.invalid','Learner','ADULT'),('pending','pending@local.invalid','Pending','ADULT');
 update learners set status='PENDING' where user_id='pending';
 insert into consent_records(id,user_id,policy_version,scope,status) values('consent','learner','1','product','GRANTED'),('pending-consent','pending','1','product','GRANTED');
 insert into role_assignments(id,principal_email,role,scope_type,scope_id,assigned_by) values('a','admin@local.invalid','SYSTEM_ADMIN','GLOBAL','GLOBAL','admin'),('r','read@local.invalid','COMMERCIAL_READ_ONLY','COMMERCIAL','GLOBAL','admin'),('w','write@local.invalid','COMMERCIAL_RESEARCH','COMMERCIAL','GLOBAL','admin'),('wrong','wrong@local.invalid','COMMERCIAL_LEAD','COHORT','other','admin');
 insert into content_library_items values('sys','LAB','SYS','ACTIVE'),('dec','LAB','DEC','ACTIVE');
 insert into content_library_versions values('sys1','sys','v1','PUBLISHED','LIVE'),('dec1','dec','v2','PUBLISHED','LIVE');
 insert into content_runtime_activations(id,item_id,version_id,status,runtime_mode) values('s','sys','sys1','ACTIVE','STATIC'),('d','dec','dec1','ACTIVE','DYNAMIC');
 insert into crm_organisations(id,name,organisation_type) values('00000000-0000-0000-0000-000000000011','Test organisation','OTHER');
 insert into crm_opportunities(id,code,organisation_id,opportunity_name,lane,edition,buyer_group,opportunity_type) values('00000000-0000-0000-0000-000000000012','TEST','00000000-0000-0000-0000-000000000011','Test','WORKPLACE','workplace','People','PROGRAMME');`);
 await actor();
});
const create=async(p=payload())=>rpc('bis_create_programme_group',[JSON.stringify(p)]);
const ownerQuery=async(sql,args=[])=>{await db.exec('reset role');return query(sql,args);};
test('one-pass group creation pins any published Lab, adds known learners and pending emails, and exact retries do not duplicate',async()=>{
 assert.equal(await create(),'group');assert.equal(await create(),'group');
 await assert.rejects(create({...payload(),emails:['different@local.invalid']}),/Retry content changed/);
 const groups=await ownerQuery('select * from pilot_cohorts');assert.equal(groups.length,1);assert.equal(groups[0].lab_code,'SYS');assert.deepEqual(groups[0].lab_plan,payload().labPlan);
 assert.equal((await query('select * from cohort_members')).length,1);assert.equal((await query("select * from cohort_participant_invites where status='PENDING'")).length,1);
 assert.equal((await query('select * from lab_enrollments')).length,1);
});
test('invalid participants, unpublished versions, duplicate Labs, and wrong roles cannot leave a partially created group',async()=>{
 for(const p of [{...payload(),emails:['valid@local.invalid','invalid']},{...payload(),labPlan:[{code:'SYS',version:'absent'}]},{...payload(),programmeFormat:'PILOT',labPlan:[{code:'SYS',version:'v1'},{code:'SYS',version:'v1'}]}])await assert.rejects(create(p));
 await actor('facilitator@local.invalid');await assert.rejects(create(),/Administrator required/);
 assert.equal((await ownerQuery('select * from pilot_cohorts')).length,0);assert.equal((await query('select * from cohort_participant_invites')).length,0);
});
test('co-facilitators remain active and dynamic enrolment waits for the learner privacy acknowledgment',async()=>{
 await create({...payload(),programmeFormat:'PILOT',labPlan:[...payload().labPlan,{code:'DEC',version:'v2'}]});
 await ownerQuery("insert into role_assignments(id,principal_email,role,scope_type,scope_id,assigned_by) values('co','co@local.invalid','FACILITATOR','COHORT','group','admin')");await actor();
 await rpc('bis_add_programme_participants',['group',JSON.stringify(['learner@local.invalid'])]);
 const roles=await ownerQuery("select * from role_assignments where role='FACILITATOR' and status='ACTIVE'");assert.equal(roles.length,2);
 assert.equal((await query("select * from lab_assignments where learner_user_id='learner'")).length,2);assert.equal((await query("select * from lab_enrollments where lab_code='DEC'")).length,0);
});
test('claiming is identity-bound, consent-aware and idempotent; direct invitation editing is denied',async()=>{
 await create();await actor('other@local.invalid','learner');await assert.rejects(rpc('bis_claim_programme_invites'),/Active learner/);
 await ownerQuery("update learners set status='ACTIVE' where user_id='pending'");await actor('pending@local.invalid','pending');
 await assert.rejects(query("update cohort_participant_invites set cohort_id='other'"),/permission/);
 assert.equal(await rpc('bis_claim_programme_invites'),1);assert.equal(await rpc('bis_claim_programme_invites'),0);
 await ownerQuery("insert into consent_records(id,user_id,policy_version,scope,status,created_at) values('withdrawn','pending','1','product','WITHDRAWN',now()+interval '1 day')");await actor('pending@local.invalid','pending');await assert.rejects(rpc('bis_claim_programme_invites'),/consent/);
});
test('removed memberships and withdrawn enrolments do not revive from stale invitations',async()=>{
 await create();await db.exec("reset role;update learners set status='ACTIVE' where user_id='pending';insert into cohort_members(id,cohort_id,learner_user_id,learner_email,added_by,status) values('removed','group','pending','pending@local.invalid','admin','REMOVED')");await actor('pending@local.invalid','pending');assert.equal(await rpc('bis_claim_programme_invites'),0);
 const members=await ownerQuery("select * from cohort_members where id='removed'");assert.equal(members[0].status,'REMOVED');
 await query("update lab_enrollments set status='WITHDRAWN' where user_id='learner'");await actor();await rpc('bis_add_programme_participants',['group',JSON.stringify(['learner@local.invalid'])]);assert.equal((await ownerQuery("select status from lab_enrollments where user_id='learner'"))[0].status,'WITHDRAWN');
});
test('commercial read-only and wrong-scope roles cannot mutate directly; writers and administrators can',async()=>{
 await actor('read@local.invalid');assert.equal((await query('select * from crm_organisations')).length,1);
 await assert.rejects(query("insert into crm_organisations(name,organisation_type) values('Forbidden','OTHER')"),/row-level security/);
 assert.equal((await query("update crm_organisations set name='Changed' returning id")).length,0);
 await actor('wrong@local.invalid');assert.equal((await query('select * from crm_organisations')).length,0);
 await assert.rejects(query("insert into crm_organisations(name,organisation_type) values('Wrong scope','OTHER')"),/row-level security/);
 await actor('write@local.invalid');await query("insert into crm_organisations(name,organisation_type) values('Allowed','OTHER')");assert.equal((await query('select * from crm_audit_events')).length,1);
 await assert.rejects(query("delete from crm_audit_events"),/permission/);await assert.rejects(query("insert into crm_audit_events(actor_email,action,object_type,object_id) values('write@local.invalid','FAKE','x','y')"),/permission/);
});
test('commercial activity has an atomic audit, monotonic timestamp and outbound-only pre-contact stage transition',async()=>{
 await actor('write@local.invalid');const id='00000000-0000-0000-0000-000000000012';
 const log=(direction,time,actorEmail='write@local.invalid')=>query('insert into crm_activities(opportunity_id,activity_type,direction,occurred_at,actor_email) values($1,\'EMAIL\',$2,$3,$4)',[id,direction,time,actorEmail]);
 await log('INBOUND','2026-10-05');assert.equal((await query('select stage from crm_opportunities'))[0].stage,'RESEARCH');
 await log('OUTBOUND','2026-10-04');let [opportunity]=await query('select * from crm_opportunities');assert.equal(opportunity.stage,'CONTACTED');assert.equal(new Date(opportunity.last_activity_at).toISOString(),'2026-10-05T00:00:00.000Z');
 await query("update crm_opportunities set stage='WON'");await log('OUTBOUND','2026-10-06');assert.equal((await query('select stage from crm_opportunities'))[0].stage,'WON');
 const count=(await query('select * from crm_activities')).length;await assert.rejects(log('OUTBOUND','2026-10-07','forged@local.invalid'),/actor/);assert.equal((await query('select * from crm_activities')).length,count);
 await assert.rejects(query("update crm_activities set body='edited'"),/permission/);
});

test('staff access edits are atomic, retain co-facilitators and cannot remove the final administrator',async()=>{
 await create();await assert.rejects(rpc('bis_change_staff_access',[JSON.stringify({action:'revokeRole',assignmentId:'a'})]),/final system administrator/);
 await assert.rejects(rpc('bis_change_staff_access',[JSON.stringify({action:'updateRoleAssignment',assignmentId:'a',email:'admin@local.invalid',role:'FACILITATOR',cohortId:'group'})]),/final system administrator/);
 const id=await rpc('bis_change_staff_access',[JSON.stringify({action:'assignRole',email:'second@local.invalid',role:'SYSTEM_ADMIN'})]);
 await rpc('bis_change_staff_access',[JSON.stringify({action:'updateRoleAssignment',assignmentId:id,email:'second@local.invalid',role:'FACILITATOR',cohortId:'group'})]);
 const roles=await ownerQuery("select * from role_assignments where role='FACILITATOR' and status='ACTIVE'");assert.equal(roles.length,2);
 await assert.rejects(query("update role_assignments set status='REVOKED' where id='a'"),/final system administrator/);
 assert.equal((await query("select * from audit_events where action='STAFF_ROLE_ASSIGNED'")).length,2);
});
