import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const root = new URL('../supabase/migrations/',import.meta.url);
const owner = '00000000-0000-0000-0000-000000000001';
await db.exec(`set timezone='UTC'; create role anon; create role authenticated; create schema auth; create schema private;
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
create table evidence_submissions(id text primary key,user_id text,cohort_id text,evidence_ids text[],revoked_at timestamptz,created_at timestamptz);
create table evidence_assessments(id text primary key,submission_id text,rubric_version_id text,disposition text,created_at timestamptz);
create table assessment_rubric_versions(id text,lab_code text,lab_version text,semantic_field_ids text[],created_at timestamptz,title text,criteria jsonb,scale_min int,scale_max int);
create table question_analysis_registry(id text,lab_code text,lab_version text,semantic_field_id text,status text,model_review_policy text,answer_model text,sensitivity text,contract_id text,question_family text,updated_at timestamptz,label text,aggregate_policy text);
create table curriculum_evidence_mappings(id text,registry_id text,lab_code text,lab_version text,semantic_field_id text,classification_status text,contract_id text,model_review_policy text,competency text,created_at timestamptz,prompt_label text,portfolio_purpose text,outcome text,allowed_inference text,forbidden_inference text,evidence_class text,stage_ceiling text,source_nature text,question_family text);
create table question_evidence_contracts(source_reference text default 'Synthetic source',source_hash text default repeat('0',64),source_nature text default 'SELF_REPORT',stage_ceiling text default 'EXPLAIN',id text,lab_code text,question_family text,contract_status text,model_review_policy text,competency_id text,evidence_class text,aggregation_policy text,privacy_scope text);`);
const engine=await readFile(new URL('20261005113046_staff_evidence_assessment_engine.sql',root),'utf8');
await db.exec(engine.match(/create function private\.submission_is_current\(target text\)[\s\S]*?\$\$;/)[0]);
for(const file of ['20261013171000_evidence_intelligence_contract_context.sql','20261013171100_evidence_intelligence_reviewed_history.sql','20261013171200_evidence_intelligence_programme_aggregate.sql','20261013172100_reviewed_evidence_authority_and_permissions.sql'])await db.exec(await readFile(new URL(file,root),'utf8'));

await db.exec(`create function private.current_app_user_id() returns text language sql as $$select auth.uid()::text$$;
create function private.can_review_submission(text) returns boolean language sql stable security definer as $$select private.has_staff_role('FACILITATOR') and private.submission_is_current($1) and exists(select 1 from public.evidence_submissions s join public.pilot_cohorts c on c.id=s.cohort_id where s.id=$1 and c.facilitator_email=private.current_email())$$;
create function private.assessment_record_immutable() returns trigger language plpgsql as $$begin raise exception 'Immutable';end$$;
`);
await db.exec(await readFile(new URL('20261014060000_development_intelligence.sql',root),'utf8'));
await db.exec(await readFile(new URL('20261014061000_current_development_contracts.sql',root),'utf8'));
await db.exec(await readFile(new URL('20261014062000_development_staff_identity.sql',root),'utf8'));
await db.exec(await readFile(new URL('20261014063000_development_transfer_followup.sql',root),'utf8'));
await db.exec(await readFile(new URL('20261014065000_development_source_privacy.sql',root),'utf8'));
await db.exec(await readFile(new URL('20261014066000_development_transfer_scope.sql',root),'utf8'));
test.after(()=>db.close());
test.beforeEach(async()=>{
 await db.exec(`reset role;truncate development_reviews,development_reporting_permissions,development_task_contracts,learners,pilot_cohorts,cohort_members,lab_enrollments,consent_records,evidence_records,evidence_submissions,evidence_assessments,assessment_rubric_versions,question_analysis_registry,curriculum_evidence_mappings,question_evidence_contracts;
 create or replace function private.current_app_user_id() returns text language sql as $$select auth.uid()::text$$;
 set test.uid='${owner}';set test.email='facilitator@fixture.invalid';set test.role='FACILITATOR';set test.scope='group';
 insert into pilot_cohorts values('group','ACTIVE','HAB','1','facilitator@fixture.invalid');
 insert into question_evidence_contracts(id,lab_code,question_family,contract_status,model_review_policy,competency_id,evidence_class,aggregation_policy,privacy_scope) values('contract','HAB','QF-TEST','APPROVED_MEANING','FACILITATOR_SHARED_ONLY','AC-C04','LEARNING_CHECK','EXCLUDE','PRIVATE_BY_DEFAULT');
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
const payload={labCode:'HAB',labVersion:'1',competencyId:'AC-C04',mappingIds:['mapping'],title:'Reviewed explanation',source:'Synthetic authored task',sourceHash:'0'.repeat(64),ceiling:'EXPLAIN',comparisonKey:'AC-C04.TEST.V1',sourceNature:'SELF_REPORT',followUpDays:7,perceptionField:null};
const publish=async(extra={})=>{await db.exec("set test.role='SYSTEM_ADMIN';");const r=(await db.query('select bis_publish_development_contract($1) as id',[{...payload,...extra}])).rows[0].id;await db.exec("set test.role='FACILITATOR';");return r;};
const record=async(contract,n=1,extra={})=>(await db.query('select bis_record_development_review($1) as id',[{assessmentId:'assessment'+n,contractId:contract,stage:'EXPLAIN',criteria:{explains:true},context:'SCHOOL',independent:false,requestKey:'review'+n,...extra}])).rows[0].id;
const programme=async()=> (await db.query("select bis_development_programme_report('group') as result")).rows[0].result;
test('stage review is source-bounded, requires a current human assessment and verified criteria',async()=>{
 const contract=await publish();await assert.rejects(record(contract,1,{criteria:{explains:false}}),/criterion/);await assert.rejects(record(contract,1,{stage:'TRANSFER'}),/source-bounded/);
 await record(contract);const data=(await db.query("select bis_development_learner_report('learner1','group') as result")).rows[0].result;assert.equal(data.length,1);assert.equal(data[0].stage,'EXPLAIN');assert.equal(data[0].at,'2026-10-01T00:00:00+00:00');assert.doesNotMatch(JSON.stringify(data),/SECRET|feedback|criterion_scores/);
});
test('derived development reporting needs separate learner permission; staff cannot grant it',async()=>{
 const c=await publish();for(let n=1;n<=3;n++)await record(c,n);
 assert.deepEqual((await programme()).competencies,[]);
 await assert.rejects(db.query("select bis_development_reporting_permission('submission1',true)"),/own shared/);
 await db.exec("reset role;insert into development_reporting_permissions values('submission1',true,now()),('submission2',true,now()),('submission3',true,now());set role authenticated;");const result=await programme();assert.equal(result.competencies[0].distribution.find(x=>x.code==='EXPLAIN').count,3);assert.doesNotMatch(JSON.stringify(result),/learner1|assessment1|SECRET|SCHOOL/);
});
test('reused evidence cannot fabricate longitudinal growth; latest review replaces the same original anchor',async()=>{
 const c=await publish();await record(c,1,{stage:'NOTICE',criteria:{recognises:true}});await record(c,1,{requestKey:'later',stage:'EXPLAIN'});
 const data=(await db.query("select bis_development_learner_report('learner1','group') as result")).rows[0].result;assert.equal(data.length,1);assert.equal(data[0].stage,'EXPLAIN');
});
test('withdrawal, superseded human review and source changes invalidate the development claim',async()=>{
 const c=await publish();await record(c);
 for(const sql of ["update evidence_submissions set revoked_at=now() where id='submission1'","insert into evidence_assessments values('new','submission1','rubric','MORE_EVIDENCE',now())","update question_evidence_contracts set contract_status='RETIRED'","update question_analysis_registry set sensitivity='P3'"]){
  await db.exec('reset role;begin;'+sql+';set role authenticated;');assert.deepEqual((await db.query("select bis_development_learner_report('learner1','group') as result")).rows[0].result,[]);await db.exec('rollback;reset role;set role authenticated;');
 }
});
test('wrong facilitator, programme role, anonymous and direct-table access are denied',async()=>{
 await publish();await db.exec("set test.email='other@fixture.invalid';");await assert.rejects(db.query("select bis_development_learner_report('learner1','group')"),/not assigned/);
 await db.exec("set test.email='facilitator@fixture.invalid';set test.role='PROGRAMME_OWNER';");await assert.rejects(db.query("select bis_development_learner_report('learner1','group')"),/not assigned/);
 for(const table of ['development_reviews','development_task_contracts','development_reporting_permissions'])await assert.rejects(db.query('select * from '+table),/permission denied/);
 const result=(await db.query("select has_function_privilege('anon','public.bis_record_development_review(jsonb)','execute') as allowed")).rows[0];assert.equal(result.allowed,false);
});

test('staff without a learner identity can approve and review, while NULL identity cannot bypass individual access',async()=>{
 await db.exec('reset role;create or replace function private.current_app_user_id() returns text language sql as $$select null::text$$;set role authenticated;');
 const c=await publish();await record(c);assert.equal((await db.query("select bis_development_learner_report('learner1','group') as result")).rows[0].result.length,1);
 await db.exec("set test.role='PROGRAMME_OWNER';");await assert.rejects(db.query("select bis_development_learner_report('learner1','group')"),/not assigned/);
 await db.exec("set test.role='SYSTEM_ADMIN';");await assert.rejects(db.query("select bis_development_learner_report('learner1','group')"),/not assigned/);
});

test('transfer requires independent use, an earlier separate evidence anchor and a different context',async()=>{
 await db.exec("reset role;update question_evidence_contracts set stage_ceiling='TRANSFER';update curriculum_evidence_mappings set evidence_class='OBSERVATION';set role authenticated;");
 const application=await publish({ceiling:'APPLY',sourceNature:'ASSESSED_TASK'});await record(application,1,{stage:'APPLY',criteria:{applies:true},independent:true});
 await db.exec(`reset role;insert into question_evidence_contracts(id,lab_code,question_family,contract_status,model_review_policy,competency_id,evidence_class,aggregation_policy,privacy_scope,stage_ceiling) values('transfer-source','HAB','QF-TRANSFER','APPROVED_MEANING','FACILITATOR_SHARED_ONLY','AC-C04','TRANSFER','EXCLUDE','PRIVATE_BY_DEFAULT','TRANSFER');insert into question_analysis_registry select 'transfer-registry',lab_code,lab_version,'HAB.TRANSFER',status,model_review_policy,answer_model,sensitivity,'transfer-source','QF-TRANSFER',updated_at,label,aggregate_policy from question_analysis_registry where id='registry';insert into curriculum_evidence_mappings select 'transfer-mapping','transfer-registry',lab_code,lab_version,'HAB.TRANSFER',classification_status,'transfer-source',model_review_policy,competency,created_at,prompt_label,portfolio_purpose,outcome,allowed_inference,forbidden_inference,'TRANSFER','TRANSFER','ASSESSED_TASK','QF-TRANSFER' from curriculum_evidence_mappings where id='mapping';insert into evidence_records select 'transfer-evidence',user_id,status,sensitivity,source_object_type,provenance,value_type,value,enrolment_id,lab_code,lab_version,'HAB.TRANSFER','2026-10-02' from evidence_records where id='evidence1';insert into evidence_submissions values('transfer-submission','learner1','group',array['transfer-evidence'],null,'2026-10-03');insert into evidence_assessments values('transfer-assessment','transfer-submission','rubric','REVIEWED','2026-10-04');set role authenticated;`);
 const transfer=await publish({mappingIds:['transfer-mapping'],ceiling:'TRANSFER',sourceNature:'ASSESSED_TASK'}),payload={assessmentId:'transfer-assessment',stage:'TRANSFER',criteria:{applies:true,adapts:true,differentContext:true},context:'HOME',requestKey:'transfer-review',independent:true};
 await assert.rejects(record(transfer,1,{...payload,independent:false}),/independent application/);await assert.rejects(record(transfer,1,{...payload,context:'SCHOOL'}),/different recorded context/);await record(transfer,1,payload);
 const facts=(await db.query("select bis_development_learner_report('learner1','group') as result")).rows[0].result;assert.equal(facts.length,2);assert.equal(facts[1].stage,'TRANSFER');
 await db.exec("reset role;insert into pilot_cohorts values('other','ACTIVE','HAB','1','facilitator@fixture.invalid');insert into cohort_members values('other-member','other','learner1','ACTIVE');insert into evidence_submissions values('other-submission','learner1','other',array['transfer-evidence'],null,'2026-10-03');insert into evidence_assessments values('other-assessment','other-submission','rubric','REVIEWED','2026-10-04');set role authenticated;");
 await assert.rejects(record(transfer,1,{...payload,assessmentId:'other-assessment',requestKey:'other-review'}),/different recorded context/);

});

test('baseline source import supplies recognition criteria without fabricating reviews or permission',async()=>{
 await db.exec("reset role;update question_evidence_contracts set stage_ceiling='NOTICE',evidence_class='BASELINE';update curriculum_evidence_mappings set evidence_class='BASELINE';");
 await db.exec(await readFile(new URL('20261014064000_development_baseline_task_contracts.sql',root),'utf8'));
 const row=(await db.query('select count(*)::int as n,min(stage_ceiling) as ceiling from development_task_contracts')).rows[0];assert.equal(row.n,1);assert.equal(row.ceiling,'NOTICE');
 assert.equal((await db.query('select count(*)::int as n from development_reviews')).rows[0].n,0);assert.equal((await db.query('select count(*)::int as n from development_reporting_permissions')).rows[0].n,0);
 await db.exec('set role authenticated;');assert.deepEqual((await db.query("select bis_development_learner_report('learner1','group') as result")).rows[0].result,[]);
});
