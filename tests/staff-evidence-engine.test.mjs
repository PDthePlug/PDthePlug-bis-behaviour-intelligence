import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const migrations=new URL('../supabase/migrations/',import.meta.url);
await db.exec(`create role anon; create role authenticated; create schema auth; create schema private; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth',true),'')::uuid$$;
create function private.current_app_user_id() returns text language plpgsql security definer set search_path='' as $$begin return (select user_id from public.learners where user_id=nullif(current_setting('test.owner',true),''));end$$;
create function private.current_email() returns text language sql as $$select nullif(current_setting('test.email',true),'')$$;
grant usage on schema auth,private to authenticated;grant execute on all functions in schema auth,private to authenticated;`);
const base=await readFile(new URL('20260909000000_bis_production.sql',migrations),'utf8');
const tables=['learners','consent_records','lab_enrollments','responses','evidence_records','role_assignments','pilot_cohorts','cohort_members'];
for(const table of tables)await db.exec(base.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`,'i'))[0]);
await db.exec(`alter table responses add column lab_code text default 'HAB',add column provenance text default 'SR',add column privacy_class text default 'P2',add column content_release_id text;alter table evidence_records add column content_release_id text;
create table public.question_analysis_registry(id text primary key,lab_code text,lab_version text,semantic_field_id text,label text);
create function private.has_staff_role(requested_role text) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.role_assignments where role=requested_role and status='ACTIVE' and (lower(principal_email)=private.current_email() or user_id=private.current_app_user_id()))$$;
create function private.can_view_sponsor_cohort(target_cohort_id text) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and (private.has_staff_role('SYSTEM_ADMIN') or exists(select 1 from public.role_assignments where status='ACTIVE' and role in ('PROGRAMME_OWNER','SPONSOR_VIEWER') and scope_type='COHORT' and scope_id=target_cohort_id and lower(principal_email)=private.current_email()))$$;
`);
for(const table of ['learners','consent_records','lab_enrollments','responses','evidence_records'])await db.exec(`alter table ${table} enable row level security;grant select,insert,update,delete on ${table} to authenticated;create policy own on ${table} for all to authenticated using(user_id=private.current_app_user_id()) with check(user_id=private.current_app_user_id());`);
await db.exec(await readFile(new URL('20261005113046_staff_evidence_assessment_engine.sql',migrations),'utf8'));
await db.exec(await readFile(new URL('20261005120424_evidence_staff_identity_fallback.sql',migrations),'utf8'));
await db.exec(`create function private.can_manage_cohort(target_cohort_id text) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and (private.has_staff_role('SYSTEM_ADMIN') or (private.has_staff_role('FACILITATOR') and exists(select 1 from public.pilot_cohorts where id=target_cohort_id and status='ACTIVE' and lower(facilitator_email)=private.current_email())))$$; grant execute on function private.can_manage_cohort(text) to authenticated;`);
await db.exec(await readFile(new URL('20261005120231_facilitator_class_operations.sql',migrations),'utf8'));
await db.exec(await readFile(new URL('20261005121639_evidence_engine_integrity_guards.sql',migrations),'utf8'));

test.after(()=>db.close());
const actor=async(owner='learner',email='learner@local.invalid')=>db.exec(`reset role;set test.auth='00000000-0000-0000-0000-000000000001';set test.owner='${owner}';set test.email='${email}';set role authenticated;`);
const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
const rpc=async(name,args)=> (await query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args))[0].result;
const resetFixture=async()=>{
 await db.exec(`reset role;truncate session_attendance,facilitator_sessions,evidence_assessments,evidence_submissions,assessment_rubric_versions,curriculum_evidence_mappings,question_analysis_registry,${tables.join(',')} cascade;
 insert into learners(user_id,email,display_name,age_band) values('learner','learner@local.invalid','Learner','ADULT'),('other','other@local.invalid','Other','ADULT');
 insert into consent_records(id,user_id,policy_version,scope,status) values('consent','learner','1','product','GRANTED'),('other-consent','other','1','product','GRANTED');
 insert into lab_enrollments(id,user_id,lab_code,lab_version) values('enrolment','learner','SYS','v1'),('other-enrolment','other','SYS','v1');
 insert into pilot_cohorts(id,name,lab_code,lab_version,facilitator_email,created_by) values('group','Class','SYS','v1','facilitator@local.invalid','admin'),('wrong-group','Other class','SYS','v2','other-facilitator@local.invalid','admin');
 insert into cohort_members(id,cohort_id,learner_user_id,learner_email,added_by) values('member','group','learner','learner@local.invalid','admin');
 insert into role_assignments(id,principal_email,role,scope_type,scope_id,assigned_by) values('f','facilitator@local.invalid','FACILITATOR','GLOBAL','GLOBAL','admin'),('other-f','other-facilitator@local.invalid','FACILITATOR','GLOBAL','GLOBAL','admin'),('a','admin@local.invalid','SYSTEM_ADMIN','GLOBAL','GLOBAL','admin'),('o','owner@local.invalid','PROGRAMME_OWNER','COHORT','group','admin');
 insert into question_analysis_registry values('q','SYS','v1','SYS.TRANSFER','What changed?');
 insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,response_status,occurred_at) values('response','learner','prompt','SYS.TRANSFER','SYS','v1','"Original thinking"','ANSWERED','2021-01-01');
 insert into evidence_records(id,user_id,lab_code,lab_version,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,sensitivity,occurred_at)
 values('evidence','learner','SYS','v1','SYS.I9','SYS.TRANSFER','RESPONSE','response','SR','TEXT','"Original thinking"','P2','2021-01-01'),('private','learner','SYS','v1','SYS.I9','SYS.PRIVATE','RESPONSE','private-response','SR','TEXT','"Private"','P3','2026-01-01'),('foreign','other','SYS','v1','SYS.I9','SYS.TRANSFER','RESPONSE','foreign-response','SR','TEXT','"Other"','P2','2026-01-01');`);
 await actor();
};
test.beforeEach(resetFixture);
const share=async(ids=['evidence'],group='group',key='share-1')=>rpc('bis_share_evidence',[group,ids,'Transfer reflection',key]);
const review=async(sub,rubric=null,scores=[],expected=null,key='review-1')=>rpc('bis_assess_evidence',[sub,rubric,'REVIEWED','Grounded facilitator feedback',JSON.stringify(scores),expected,key]);
const workspace=async(cohort=null)=>rpc('bis_assessment_workspace',[cohort]);
async function rubric(){
 await actor('admin','admin@local.invalid');
 const [m]=await query("select id from curriculum_evidence_mappings where semantic_field_id='SYS.TRANSFER'");
 await rpc('bis_approve_evidence_mapping',[m.id,'TRANSFER','Track applied systems reasoning','Apply systems thinking','Identifies system relationships','Volume 3, SYS Transfer Test']);
 const id=await rpc('bis_create_assessment_rubric',['SYS','v1','Transfer','SYS.TEI09','Volume 3',['SYS.TRANSFER'],JSON.stringify([{id:'C1',label:'Quality of reasoning'}]),1,5,true]);
 await actor();return id;
}
test('capture is scoped and originals cannot be edited or deleted; status corrections retain history',async()=>{
 const [e]=await query("select * from evidence_records where id='evidence'");assert.equal(e.enrolment_id,'enrolment');
 await assert.rejects(query("update evidence_records set value='changed' where id='evidence'"),/immutable/);
 await assert.rejects(query("delete from evidence_records where id='evidence'"),/permission/);
 await query("update evidence_records set status='SUPERSEDED' where id='evidence'");
 await assert.rejects(query("update evidence_records set status='ACTIVE' where id='evidence'"),/cannot be restored/);
 const history=await rpc('bis_evidence_timeline',[null,null,60]);assert.equal(history.find(e=>e.id==='evidence').value,'"Original thinking"');assert.equal(history.find(e=>e.id==='evidence').status,'SUPERSEDED');assert.ok(!history.some(e=>e.id==='foreign'));
});
test('raw evidence remains unavailable to staff; explicit sharing is idempotent and narrowly scoped',async()=>{
 await actor('facilitator','facilitator@local.invalid');assert.deepEqual(await query('select * from evidence_records'),[]);assert.equal((await workspace()).submissions.length,0);
 await actor();const id=await share();assert.equal(await share(),id);await assert.rejects(share(['private']),/Retry content changed/);
 for(const [ids,group,key] of [[['private'],'group','p3'],[['foreign'],'group','foreign'],[['evidence'],'wrong-group','wrong'],[['evidence','evidence'],'group','duplicate']])await assert.rejects(share(ids,group,key));
 await actor('facilitator','facilitator@local.invalid');const w=await workspace();assert.equal(w.submissions[0].evidence.length,1);assert.equal(w.submissions[0].evidence[0].id,'evidence');
 await actor('other-f','other-facilitator@local.invalid');assert.equal((await workspace()).submissions.length,0);await assert.rejects(review(id),/not available/);
 await actor('admin','admin@local.invalid');assert.equal((await workspace()).submissions.length,0);await assert.rejects(review(id),/not available/);
});
test('ratings use exact rubric anchors and bounds; retries and corrections preserve every assessment',async()=>{
 const r=await rubric(),id=await share();await actor('facilitator','facilitator@local.invalid');
 const scores=[{criterionId:'C1',score:4,rationale:'Linked original reasoning identifies a relationship.'}];
 await assert.rejects(review(id,r,[{...scores[0],score:6}]),/authored scale/);
 await assert.rejects(review(id,r,[]),/every authored criterion/);
 await assert.rejects(review(id,null,scores),/authored rubric/);
 const first=await review(id,r,scores);assert.equal(await review(id,r,scores),first);
 await assert.rejects(review(id,r,scores,null,'review-2'),/review changed/);
 const second=await review(id,r,[{...scores[0],score:3}],first,'review-2');
 await actor();const reviews=(await workspace()).submissions[0].reviews;assert.equal(reviews.length,2);assert.equal(reviews[0].id,second);assert.equal(reviews[0].supersedes_id,first);
 await assert.rejects(query('update evidence_assessments set feedback=$1',['overwrite']),/permission/);
});
test('revocation, revised evidence, consent, membership and facilitator access invalidate current review access',async()=>{
 const id=await share();await actor('facilitator','facilitator@local.invalid');await review(id);
 await actor();await rpc('bis_revoke_evidence',[id]);await actor('facilitator','facilitator@local.invalid');assert.equal((await workspace()).submissions.length,0);await assert.rejects(review(id),/not available/);
 await actor();assert.equal((await workspace()).submissions[0].reviews.length,1);
 for(const change of ["update evidence_records set status='SUPERSEDED' where id='evidence'","update consent_records set status='WITHDRAWN' where id='consent'","update cohort_members set status='REMOVED' where id='member'","update pilot_cohorts set status='INACTIVE' where id='group'","update role_assignments set status='REVOKED' where id='f'"]){
  await resetFixture();const currentId=await share();
  await db.exec('reset role');await db.exec(change);await actor('facilitator','facilitator@local.invalid');assert.equal((await workspace()).submissions.length,0);await assert.rejects(review(currentId),/not available/);
 }
});
test('source mappings and rubrics require administrator and source anchors; every registry prompt has a structural mapping',async()=>{
 const [m]=await query("select * from curriculum_evidence_mappings where semantic_field_id='SYS.TRANSFER'");assert.equal(m.evidence_class,'UNCLASSIFIED');assert.equal(m.task_id,'SYS.TRANSFER');
 await assert.rejects(rpc('bis_approve_evidence_mapping',[m.id,'TRANSFER','purpose','outcome','competency','source']),/Administrator/);
 await actor('admin','admin@local.invalid');await assert.rejects(rpc('bis_create_assessment_rubric',['SYS','v1','Title','Task','Source',['SYS.TRANSFER'],JSON.stringify([{id:'C1',label:'Criterion'}]),1,5,true]),/approved curriculum/);
});
test('reporting refuses wrong roles and suppresses small cohorts and samples',async()=>{
 const id=await share();await actor('facilitator','facilitator@local.invalid');await review(id);await assert.rejects(rpc('bis_assessment_report',['group']),/reporting access/);
 await actor('owner','owner@local.invalid');const report=await rpc('bis_assessment_report',['group']);assert.equal(report.cohorts[0].suppressed,true);assert.equal(report.cohorts[0].reviewed_learners,null);assert.deepEqual(report.cohorts[0].rubrics,[]);await assert.rejects(rpc('bis_assessment_report',['wrong-group']),/reporting access/);
 await db.exec("reset role;set test.auth='';set role authenticated");await assert.rejects(workspace(),/Sign in/);
});
test('handbook capture creates anchors atomically and preserves original revisions with source context',async()=>{
 await query(`insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,provenance,privacy_class,value,response_status,occurred_at)
 values('workbook','learner','LEARNING:SYS.PROGRAMME.DAY1:QUESTION','SYS.WB.QUESTION','SYS','HANDBOOK-1','LR','P3','"What I believed"','ANSWERED','2021-01-01')`);
 const history=await rpc('bis_evidence_timeline',[null,null,60,2021,'SYS',null]);const e=history.find(e=>e.source_object_id==='workbook');assert.equal(e.value,'"What I believed"');assert.equal(e.sensitivity,'P3');assert.equal(e.enrolment_id,null);assert.equal(e.task_id,'SYS.PROGRAMME.DAY1');
 await query("update responses set response_status='SUPERSEDED' where id='workbook'");assert.equal((await query("select status from evidence_records where source_object_id='workbook'"))[0].status,'SUPERSEDED');
 const index=await rpc('bis_evidence_history_index',[]);assert.equal(index.record_count,3);assert.ok(index.years.includes(2021));
 await actor('facilitator','facilitator@local.invalid');await assert.rejects(rpc('bis_evidence_timeline',[null,null,60]),/Sign in is required/);
});
test('report autosums exact saved ratings and uses one latest learner assessment per immutable rubric version',async()=>{
 const r=await rubric();
 // Five active members, three actually reviewed; the two remaining members
 // deliberately have no evidence so coverage cannot be inferred from enrolment.
 await db.exec(`reset role;
 insert into learners(user_id,email,display_name,age_band) select 'sample'||n,'sample'||n||'@local.invalid','Sample','ADULT' from generate_series(1,4) n;
 insert into cohort_members(id,cohort_id,learner_user_id,learner_email,added_by) select 'sample-member'||n,'group','sample'||n,'sample'||n||'@local.invalid','admin' from generate_series(1,4) n;
 insert into consent_records(id,user_id,policy_version,scope,status) select 'sample-consent'||n,'sample'||n,'1','product','GRANTED' from generate_series(1,2) n;
 insert into evidence_records(id,user_id,lab_code,lab_version,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,sensitivity,occurred_at)
 select 'sample-evidence'||n,'sample'||n,'SYS','v1','SYS.I9','SYS.TRANSFER','RESPONSE','sample-response'||n,'SR','TEXT','"Reasoning"','P2',clock_timestamp() from generate_series(1,2) n;`);
 const scores=score=>[{criterionId:'C1',score,rationale:'Specific source-backed reasoning.'}];
 for(const [learner,ids,score] of [['learner',['evidence'],2],['sample1',['sample-evidence1'],3],['sample2',['sample-evidence2'],4]]){
  await actor(learner,`${learner}@local.invalid`);const sub=await share(ids,'group',`share-${learner}`);await actor('facilitator','facilitator@local.invalid');await review(sub,r,scores(score),null,`review-${learner}`);
 }
 // A second submission by the same learner is a later attempt, not another
 // learner in the denominator. The saved source totals become (5+3+4)/3=4.
 await actor();const repeat=await share(['evidence'],'group','repeat');await actor('facilitator','facilitator@local.invalid');await review(repeat,r,scores(5),null,'repeat-review');
 await actor('owner','owner@local.invalid');const report=await rpc('bis_assessment_report',['group']);const g=report.cohorts[0];assert.equal(g.participants,5);assert.equal(g.reviewed_learners,3);assert.equal(g.rubrics[0].sample,3);assert.equal(g.rubrics[0].average_total,4);assert.equal(g.rubrics[0].maximum_total,5);
 await actor();await rpc('bis_revoke_evidence',[repeat]);await actor('owner','owner@local.invalid');assert.equal((await rpc('bis_assessment_report',['group'])).cohorts[0].rubrics[0].average_total,3);
});
test('history pagination retains same-time records, respects year filters, and never reads another learner',async()=>{
 await query(`insert into evidence_records(id,user_id,lab_code,lab_version,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,sensitivity,occurred_at)
 select 'history-'||n,'learner','SYS','v1','SYS.I1','SYS.HISTORY','RESPONSE','history-response-'||n,'SR','TEXT','"Historical"','P2','2022-01-01' from generate_series(1,70) n`);
 const first=await rpc('bis_evidence_timeline',[null,null,60,2022,null,null]),last=first.at(-1),second=await rpc('bis_evidence_timeline',[last.occurred_at,last.id,60,2022,null,null]);assert.equal(first.length,60);assert.equal(second.length,10);assert.equal(new Set([...first,...second].map(e=>e.id)).size,70);
});

test('class operations preserve revisions and deny unrelated facilitators and learners',async()=>{
 await actor('facilitator','facilitator@local.invalid');
 const id=await rpc('bis_save_class_session',['group',3,'2026-10-05','HELD','Separate the 45-minute touchpoint from the 90-minute Lab.',null]);
 assert.equal(await rpc('bis_save_class_session',['group',3,'2026-10-05','HELD','Separate the 45-minute touchpoint from the 90-minute Lab.',null]),id);
 const first=await rpc('bis_record_attendance',[id,'learner','PRESENT',null]);assert.equal(await rpc('bis_record_attendance',[id,'learner','PRESENT',null]),first);
 const revised=await rpc('bis_record_attendance',[id,'learner','EXCUSED',first]);assert.notEqual(revised,first);
 const history=await query('select * from session_attendance order by recorded_at');assert.equal(history.length,2);assert.equal(history[1].supersedes_id,first);
 await assert.rejects(rpc('bis_record_attendance',[id,'other','PRESENT',null]),/your held class/);
 await assert.rejects(rpc('bis_record_attendance',[id,'learner','ABSENT',first]),/changed/);
 await assert.rejects(rpc('bis_save_class_session',['group',11,'2026-10-05','HELD','',null]),/valid class/);
 await actor('other-f','other-facilitator@local.invalid');await assert.rejects(rpc('bis_record_attendance',[id,'learner','PRESENT',revised]),/your held class/);assert.deepEqual(await query('select * from facilitator_sessions'),[]);
 await actor();await assert.rejects(rpc('bis_save_class_session',['group',1,'2026-10-05','HELD','',null]),/Assigned class/);assert.deepEqual(await query('select * from session_attendance'),[]);
});
