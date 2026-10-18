import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const root = new URL('../supabase/migrations/',import.meta.url);
const owner = '00000000-0000-0000-0000-000000000001';
await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function private.current_email() returns text language sql as $$select current_setting('test.email',true)$$;
create function private.has_staff_role(text) returns boolean language sql as $$select $1=current_setting('test.role',true)$$;
create function private.can_view_competency_cohort(text) returns boolean language sql as $$select auth.uid()='${owner}'::uuid and $1=current_setting('test.scope',true) and current_setting('test.role',true) in ('FACILITATOR','PROGRAMME_OWNER')$$;
grant usage on schema private,auth to authenticated;
create table learners(user_id text primary key,status text);
create table pilot_cohorts(id text primary key,status text,lab_code text,lab_version text,facilitator_email text);
create table cohort_members(id text,cohort_id text,learner_user_id text,status text);
create table lab_enrollments(id text,user_id text,lab_code text,lab_version text,status text);
create table consent_records(id text,user_id text,consent_type text,status text,created_at timestamptz);
create table evidence_records(id text primary key,user_id text,status text,sensitivity text,source_object_type text,provenance text,value_type text,value text,enrolment_id text,lab_code text,lab_version text,semantic_field_id text,occurred_at timestamptz);
create table evidence_submissions(id text,user_id text,cohort_id text,evidence_ids text[],revoked_at timestamptz,created_at timestamptz);
create table evidence_assessments(id text,submission_id text,rubric_version_id text,disposition text,created_at timestamptz);
create table assessment_rubric_versions(id text,lab_code text,lab_version text,semantic_field_ids text[],created_at timestamptz,title text,criteria jsonb,scale_min int,scale_max int);
create table question_analysis_registry(id text,lab_code text,lab_version text,semantic_field_id text,status text,model_review_policy text,answer_model text,sensitivity text,contract_id text,question_family text,updated_at timestamptz,label text,aggregate_policy text);
create table curriculum_evidence_mappings(id text,registry_id text,lab_code text,lab_version text,semantic_field_id text,classification_status text,contract_id text,model_review_policy text,competency text,created_at timestamptz,prompt_label text,portfolio_purpose text,outcome text,allowed_inference text,forbidden_inference text,evidence_class text,stage_ceiling text,source_nature text,question_family text);
create table question_evidence_contracts(id text,lab_code text,question_family text,contract_status text,model_review_policy text,competency_id text,evidence_class text,aggregation_policy text,privacy_scope text);`);
const engine=await readFile(new URL('20261005113046_staff_evidence_assessment_engine.sql',root),'utf8');
await db.exec(engine.match(/create function private\.submission_is_current\(target text\)[\s\S]*?\$\$;/)[0]);
for(const file of ['20261013171000_evidence_intelligence_contract_context.sql','20261013171100_evidence_intelligence_reviewed_history.sql','20261013171200_evidence_intelligence_programme_aggregate.sql','20261013172100_reviewed_evidence_authority_and_permissions.sql'])await db.exec(await readFile(new URL(file,root),'utf8'));
test.after(()=>db.close());
test.beforeEach(async()=>{
 await db.exec(`reset role;truncate learners,pilot_cohorts,cohort_members,lab_enrollments,consent_records,evidence_records,evidence_submissions,evidence_assessments,assessment_rubric_versions,question_analysis_registry,curriculum_evidence_mappings,question_evidence_contracts;
 set test.uid='${owner}';set test.email='facilitator@fixture.invalid';set test.role='FACILITATOR';set test.scope='group';
 insert into pilot_cohorts values('group','ACTIVE','HAB','1','facilitator@fixture.invalid');
 insert into question_evidence_contracts values('contract','HAB','QF-TEST','APPROVED_MEANING','FACILITATOR_SHARED_ONLY','AC-C04','LEARNING_CHECK','EXCLUDE','PRIVATE_BY_DEFAULT');
 insert into question_analysis_registry values('registry','HAB','1','HAB.TEST','ACTIVE','FACILITATOR_SHARED_ONLY','TEXT','P2','contract','QF-TEST',now(),'Synthetic question','EXCLUDE');
 insert into curriculum_evidence_mappings values('mapping','registry','HAB','1','HAB.TEST','APPROVED','contract','FACILITATOR_SHARED_ONLY','AC-C04',now(),'Synthetic question','Learning review','Meaning only','Meaning only','No behavioural proof','LEARNING_CHECK','EXPLAIN','SELF_REPORT','QF-TEST');
 insert into assessment_rubric_versions values('rubric','HAB','1',array['HAB.TEST'],now(),'Synthetic rubric','[]',0,5);`);
 for(let n=1;n<=10;n++) await db.query(`insert into learners values($1,'ACTIVE');`,['learner'+n]);
 for(let n=1;n<=10;n++){
  const learner='learner'+n;
  await db.query("insert into cohort_members values($1,'group',$2,'ACTIVE')",['member'+n,learner]);
  await db.query("insert into lab_enrollments values($1,$2,'HAB','1','IN_PROGRESS')",['enrolment'+n,learner]);
  await db.query("insert into consent_records values($1,$2,'LEARNER_PRODUCT','GRANTED','2026-10-01')",['consent'+n,learner]);
  await db.query("insert into evidence_records values($1,$2,'ACTIVE','P2','RESPONSE','LR','TEXT','SECRET LEARNER WORDING',$3,'HAB','1','HAB.TEST','2026-10-01')",['evidence'+n,learner,'enrolment'+n]);
  await db.query("insert into evidence_submissions values($1,$2,'group',$3,null,'2026-10-02')",['submission'+n,learner,['evidence'+n]]);
  await db.query("insert into evidence_assessments values($1,$2,'rubric','REVIEWED','2026-10-03')",['assessment'+n,'submission'+n]);
 }
 await db.exec('set role authenticated;');
});
const history=async()=> (await db.query("select bis_agent_reviewed_evidence_history('group','learner1',null) as result")).rows[0].result;
const programme=async()=> (await db.query("select bis_agent_programme_aggregate('group') as result")).rows[0].result;
const aggregatePermission=async()=>db.exec("reset role;update question_evidence_contracts set aggregation_policy='STRUCTURED_ONLY',privacy_scope='AGGREGATE_ALLOWED';update question_analysis_registry set aggregate_policy='STRUCTURED_ONLY',answer_model='INTEGER';set role authenticated;");
test('guarded invoker adapters execute for the assigned facilitator; anonymous execution is denied',async()=>{
 const result=await history();assert.equal(result.length,1);
 const context=(await db.query("select bis_evidence_agent_context('evidence1') as result")).rows[0].result;assert.equal(context.evidenceId,'evidence1');
 for(const fn of ['bis_evidence_agent_context(text)','bis_agent_reviewed_evidence_history(text,text,text)','bis_agent_programme_aggregate(text)'])assert.equal((await db.query("select has_function_privilege('anon',$1,'execute') as allowed",['public.'+fn])).rows[0].allowed,false);
 await db.exec("set test.email='other@fixture.invalid';");await assert.rejects(history(),/not assigned/);
});
test('rubric-linked REVIEWED disposition cannot become an achieved stage or calibrated confidence',async()=>{
 const rows=await history();assert.equal(rows[0].stage,'NOT_YET_EVIDENCED');assert.equal(rows[0].confidence,0);
 assert.doesNotMatch(JSON.stringify(rows),/SECRET|learner1|@fixture|criterion_scores/);
});
test('facilitator sharing never overrides aggregation exclusion; runtime permission is also required',async()=>{
 assert.equal((await programme()).competencies.length,0);
 await db.exec("reset role;update question_evidence_contracts set aggregation_policy='STRUCTURED_ONLY',privacy_scope='AGGREGATE_ALLOWED';set role authenticated;");
 assert.equal((await programme()).competencies.length,0);
 await aggregatePermission();const result=await programme();assert.equal(result.competencies[0].reportableParticipants,10);assert.deepEqual(result.competencies[0].stageDistribution,{NOT_YET_EVIDENCED:10});
 assert.doesNotMatch(JSON.stringify(result),/SECRET|learner1|evidence1|submission1|@fixture/);
});
test('retired contracts, inactive registry and the latest withdrawn mapping immediately remove reviewed history',async()=>{
 for(const update of ["update question_evidence_contracts set contract_status='RETIRED'","update question_analysis_registry set status='CANDIDATE'","insert into curriculum_evidence_mappings select 'newer',registry_id,lab_code,lab_version,semantic_field_id,'WITHDRAWN',contract_id,model_review_policy,competency,now()+interval '1 day',prompt_label,portfolio_purpose,outcome,allowed_inference,forbidden_inference,evidence_class,stage_ceiling,source_nature,question_family from curriculum_evidence_mappings"]){
  await db.exec('reset role;begin;'+update+';set role authenticated;');assert.deepEqual(await history(),[]);await assert.rejects(db.query("select bis_evidence_agent_context('evidence1')"));await db.exec('rollback;reset role;set role authenticated;');
 }
});
test('latest MORE_EVIDENCE, share revocation, withdrawn consent and wrong Lab versions fail closed',async()=>{
 for(const update of ["insert into evidence_assessments values('newer','submission1','rubric','MORE_EVIDENCE','2026-10-04')","update evidence_submissions set revoked_at=now() where id='submission1'","insert into consent_records values('withdrawn','learner1','LEARNER_PRODUCT','WITHDRAWN','2026-10-04')","update evidence_records set lab_version='2' where id='evidence1'","update evidence_records set sensitivity='P3' where id='evidence1'"]){
  await db.exec('reset role;begin;'+update+';set role authenticated;');try{assert.deepEqual(await history(),[]);}catch(e){assert.match(e.message,/not currently eligible/);}await db.exec('rollback;reset role;set role authenticated;');
 }
});
test('programme adapter withholds entire competency for small reviewed groups and small complements',async()=>{
 await aggregatePermission();
 for(const count of [2,9]){
  await db.exec('reset role;begin;');await db.query("delete from evidence_assessments where substring(submission_id from '[0-9]+$')::int > $1",[count]);await db.exec('set role authenticated;');const result=await programme();assert.deepEqual(result.competencies,[]);await db.exec('rollback;reset role;set role authenticated;');
 }
 await db.exec("reset role;delete from evidence_assessments where submission_id not in ('submission1','submission2','submission3');set role authenticated;");assert.equal((await programme()).competencies[0].reportableParticipants,3);
});
test('wrong role/scope, withdrawn enrolment and fewer than five eligible participants preserve privacy',async()=>{
 await aggregatePermission();await db.exec("set test.scope='other';");await assert.rejects(programme(),/access/);
 await db.exec("set test.scope='group';set test.role='LEARNER';");await assert.rejects(history(),/Facilitator/);await assert.rejects(programme(),/access/);
 await db.exec("set test.role='FACILITATOR';reset role;update lab_enrollments set status='WITHDRAWN' where user_id not in ('learner1','learner2','learner3','learner4');set role authenticated;");const result=await programme();assert.equal(result.reportingStatus,'SUPPRESSED_SMALL_COHORT');assert.deepEqual(result.competencies,[]);
});
