import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const migration=async name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const withdrawal=await migration('20261019143457_practical_evidence_withdrawal_chain.sql');
const programme=await migration('20261019144433_capability_programme_plan_scope.sql');
const definition=(source,name)=>source.match(new RegExp('create (?:or replace )?function private\\.'+name+'\\([\\s\\S]*?\\$\\$;'))[0];
await db.exec(`create schema private;create schema auth;
create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
create function private.current_app_user_id() returns text language sql as $$select 'learner'::text$$;
create table pilot_cohorts(id text,status text,lab_code text,lab_version text,lab_plan jsonb);
create table learners(user_id text,status text);
create table cohort_members(cohort_id text,learner_user_id text,status text);
create table consent_records(id text,user_id text,consent_type text,status text,created_at timestamptz);
create table lab_enrollments(id text,user_id text,lab_code text,lab_version text,status text);
create table evidence_records(id text,user_id text,lab_code text,lab_version text,enrolment_id text,status text,sensitivity text,value text,occurred_at timestamptz,source_object_type text);
create table evidence_submissions(id text,user_id text,cohort_id text,evidence_ids text[],revoked_at timestamptz);
create table development_task_contracts(id text,competency_id text,source_nature text,comparison_key text,source_hash text,lab_code text,lab_version text,current boolean);
create table evidence_assessments(id text,submission_id text,disposition text,created_at timestamptz);
create table development_reviews(id text,assessment_id text,contract_id text,stage text,context text,independent boolean,assessor_id text);
create table development_practice_tasks(id text,contract_id text,source_hash text,stage text);
create table development_practice_plans(id text,task_id text,user_id text,cohort_id text,context text,created_at timestamptz);
create table development_practice_attempts(id text,plan_id text,submission_id text,opportunity boolean);
create table development_practice_verifications(assessment_id text,attempt_id text,basis text,independent boolean,assessor_id text);
create function private.development_contract_is_current(target text) returns boolean language sql as $$select current from public.development_task_contracts where id=target$$;`);
for(const [source,name] of [[programme,'cohort_has_edition'],[programme,'practice_scope'],[programme,'submission_is_current'],[withdrawal,'development_comparison_key'],[withdrawal,'practice_review_is_current']])await db.exec(definition(source,name));
test.after(()=>db.close());
const hash='e3d34ca8035bc9aed19fcd68c89d9c66a7f52cad3a80311fcc74f0e4d3615081';
test.beforeEach(async()=>{
 await db.exec(`truncate pilot_cohorts,learners,cohort_members,consent_records,lab_enrollments,evidence_records,evidence_submissions,development_task_contracts,evidence_assessments,development_reviews,development_practice_tasks,development_practice_plans,development_practice_attempts,development_practice_verifications;
 insert into pilot_cohorts values('group','ACTIVE','HAB','1','[{"code":"HAB","version":"1"},{"code":"DEC","version":"2"}]');
 insert into learners values('learner','ACTIVE');insert into cohort_members values('group','learner','ACTIVE');
 insert into consent_records values('consent','learner','LEARNER_PRODUCT','GRANTED','2026-01-01');
 insert into lab_enrollments values('enrolment','learner','DEC','2','IN_PROGRESS');
 insert into development_task_contracts values('base','AC-C03','ASSESSED_TASK','DEC:2','${hash}','DEC','2',true),('transfer','AC-C03','ASSESSED_TASK','HAB:1','${hash}','HAB','1',true);
 insert into development_practice_tasks values('base-task','base','${hash}','APPLY'),('transfer-task','transfer','${hash}','TRANSFER');
 insert into evidence_records values('evidence','learner','DEC','2','enrolment','ACTIVE','P2','PRIVATE WORDING','2026-01-02','PRACTICE_ATTEMPT');
 insert into evidence_submissions values('base-share','learner','group',array['evidence'],null);
 insert into evidence_assessments values('base-assessment','base-share','REVIEWED','2026-01-03'),('transfer-assessment','transfer-share','REVIEWED','2026-01-05');
 insert into development_reviews values('base-review','base-assessment','base','APPLY','SCHOOL',true,'staff'),('transfer-review','transfer-assessment','transfer','TRANSFER','HOME',true,'staff');
 insert into development_practice_plans values('base-plan','base-task','learner','group','SCHOOL','2026-01-01'),('transfer-plan','transfer-task','learner','group','HOME','2026-01-04');
 insert into development_practice_attempts values('base-attempt','base-plan','base-share',true),('transfer-attempt','transfer-plan','transfer-share',true);
 insert into development_practice_verifications values('base-assessment','base-attempt','CHECKED_ARTEFACT',true,'staff'),('transfer-assessment','transfer-attempt','OBSERVED_SESSION',true,'staff');`);
});
const scalar=async sql=>(await db.query(sql)).rows[0].ok;
test('explicit multi-Lab plans permit only their exact editions and current learner scope',async()=>{
 assert.equal(await scalar("select private.cohort_has_edition('group','DEC','2') as ok"),true);
 for(const edition of ['1','3'])assert.equal(await scalar(`select private.cohort_has_edition('group','DEC','${edition}') as ok`),false);
 assert.equal(await scalar("select private.practice_scope('group','learner') as ok"),true);
 assert.equal(await scalar("select private.practice_scope('group','other') as ok"),false);
 await db.exec("update cohort_members set status='REMOVED'");assert.equal(await scalar("select private.practice_scope('group','learner') as ok"),false);
});
test('shared approved criteria accumulate across Labs; competency alone never implies comparable criteria',async()=>{
 assert.equal(await scalar("select private.development_comparison_key('base')=private.development_comparison_key('transfer') as ok"),true);
 await db.exec("update development_task_contracts set source_hash=repeat('0',64) where id='transfer'");
 assert.equal(await scalar("select private.development_comparison_key('base')=private.development_comparison_key('transfer') as ok"),false);
});
test('multi-Lab shared work remains exact-edition, owned, consented and tied to its original enrolment',async()=>{
 assert.equal(await scalar("select private.submission_is_current('base-share') as ok"),true);
 for(const change of ["update evidence_records set user_id='other'","update evidence_records set lab_version='1'","update lab_enrollments set status='WITHDRAWN'","update consent_records set status='WITHDRAWN'","update evidence_records set sensitivity='P3'","update pilot_cohorts set lab_plan='[{\"code\":\"HAB\",\"version\":\"1\"}]'"]){
  await db.exec('begin;'+change);assert.equal(await scalar("select private.submission_is_current('base-share') as ok"),false);await db.exec('rollback');
 }
});
test('transfer depends on an earlier independently checked first context, including across planned Labs',async()=>{
 assert.equal(await scalar("select private.practice_review_is_current('transfer-review') as ok"),true);
 for(const change of ["update evidence_submissions set revoked_at=now() where id='base-share'","update development_task_contracts set current=false where id='base'","update lab_enrollments set status='WITHDRAWN'","update development_reviews set context='HOME' where id='base-review'","update development_practice_verifications set independent=false where assessment_id='base-assessment'","update development_practice_verifications set basis='SIMULATION' where assessment_id='base-assessment'","update development_practice_attempts set opportunity=false where id='base-attempt'","insert into evidence_assessments values('revised','base-share','MORE_EVIDENCE','2026-02-01')"]){
  await db.exec('begin;'+change);assert.equal(await scalar("select private.practice_review_is_current('transfer-review') as ok"),false,change);await db.exec('rollback');
 }
});
