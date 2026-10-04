import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();const root=new URL('../supabase/migrations/',import.meta.url);
const tables=['learners','consent_records','lab_enrollments','responses','evidence_records','hypotheses','experiments','measurement_values','measurement_sources','pilot_cohorts','cohort_members','content_library_items','content_library_versions','content_runtime_artifacts','content_runtime_activations'];
const uid='00000000-0000-0000-0000-000000000001';
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create schema storage;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function private.current_app_user_id() returns text language sql as $$select current_setting('test.app_uid',true)$$;
create function private.can_view_sponsor_cohort(text) returns boolean language sql as $$select current_setting('test.role',true) in ('SPONSOR_VIEWER','PROGRAMME_OWNER','SYSTEM_ADMIN') and $1=current_setting('test.scope',true)$$;
create function private.can_view_learner(text) returns boolean language sql as $$select auth.uid() is not null and current_setting('test.role',true)='FACILITATOR' and $1='learner1'$$;
create table storage.objects(id text primary key,bucket_id text,name text);
create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
create function storage.filename(text) returns text language sql as $$select (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)]$$;
grant usage on schema auth,private to authenticated;`);
const schemas=(await Promise.all(['20260909000000_bis_production.sql','20260924153000_bis_content_studio.sql','20260924183000_bis_content_compiler_runtime.sql'].map(name=>readFile(new URL(name,root),'utf8')))).join('\n');
for(const table of tables){const sql=schemas.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`,'i'));assert.ok(sql,table);await db.exec(sql[0]);}
await db.exec("alter table responses add column lab_code text not null default 'HAB';alter table experiments add column lab_code text not null default 'HAB';alter table content_library_versions add column compiler_version text;");
await db.exec(await readFile(new URL('20261001103000_universal_lab_measurement_scope.sql',root),'utf8'));
await db.exec(await readFile(new URL('20260917215000_rc01_scope_staff_progress_by_lab.sql',root),'utf8'));
await db.exec(await readFile(new URL('20261004154806_programme_evidence_flow.sql',root),'utf8'));
const staffMigration=(await readdir(root)).find(name=>name.endsWith('_staff_experiment_version_scope.sql'));assert.ok(staffMigration);
await db.exec(await readFile(new URL(staffMigration,root),'utf8'));
test.after(()=>db.close());
test.beforeEach(async()=>{
 await db.exec(`reset role;truncate ${tables.join(',')},auth.users,storage.objects cascade;set test.uid='${uid}';set test.app_uid='learner1';set test.role='SPONSOR_VIEWER';set test.scope='group';
 insert into auth.users values('${uid}');insert into pilot_cohorts(id,name,lab_code,lab_version,facilitator_email,created_by) values('group','SQL specimen','RES','1','staff@example.invalid','staff');
 insert into content_library_items(id,kind,code,slug,title,created_by) values('lab','LAB','RES','resilience','Resilience','staff');
 insert into content_library_versions(id,item_id,version,status,runtime_status,created_by) values('v1','lab','1','PUBLISHED','LIVE','staff');
 insert into content_runtime_artifacts(id,version_id,item_id,artifact_key,storage_path,artifact_hash,artifact_bytes,compiler_version) values('artifact','v1','lab','lab:universal','fixture','hash',1,'bis-content-compiler-7');
 insert into content_runtime_activations(id,item_id,version_id,runtime_mode,activated_by) values('activation','lab','v1','DYNAMIC','staff');`);
 for(let n=1;n<=6;n++){
  await db.query("insert into learners(user_id,auth_user_id,email,display_name,age_band) values($1,$2,$3,'SQL learner','ADULT')",[`learner${n}`,n===1?uid:null,`learner${n}@example.invalid`]);
  await db.query("insert into consent_records(id,user_id,policy_version,scope,status) values($1,$2,'1','product','GRANTED')",[`consent${n}`,`learner${n}`]);
  await db.query("insert into cohort_members(id,cohort_id,learner_user_id,learner_email,added_by) values($1,'group',$2,$3,'staff')",[`member${n}`,`learner${n}`,`learner${n}@example.invalid`]);
  await db.query("insert into lab_enrollments(id,user_id,lab_code,lab_version,experiment_started_at) values($1,$2,'RES','1',now())",[`enrol${n}`,`learner${n}`]);
  if(n<=3){
   await db.query("insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,occurred_at) values($1,$2,'p','RES.I7.FIELD','RES','1','Private wording',now())",[`response${n}`,`learner${n}`]);
   await db.query("insert into evidence_records(id,user_id,lab_code,lab_version,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,sensitivity,occurred_at) values($1,$2,'RES','1','RES.I7','RES.I7.FIELD','RESPONSE',$3,'SR','TEXT','Private wording','P3',now())",[`evidence${n}`,`learner${n}`,`response${n}`]);
   await db.query("insert into measurement_values(id,user_id,enrolment_id,lab_code,lab_version,code,value,status,evidence_strength) values($1,$2,$3,'RES','1','RES.RESULT','7','VALUE','RECORDED')",[`measure${n}`,`learner${n}`,`enrol${n}`]);
   await db.query("insert into measurement_sources(id,measurement_id,user_id,source_object_type,source_object_id,input_role) values($1,$2,$3,'RESPONSE',$4,'SOURCE')",[`source${n}`,`measure${n}`,`learner${n}`,`response${n}`]);
  }
 }
 await db.exec('set role authenticated;');
});
const flow=async()=> (await db.query("select sponsor_cohort_evidence_flow('group') as result")).rows[0].result;
test('Universal reporting counts source-linked evidence and suppresses small stage cells',async()=>{
 const result=await flow();assert.equal(result.runtimeMode,'DYNAMIC');assert.equal(result.totals.recordedResponses,3);assert.equal(result.totals.anchoredMeasures,3);assert.equal(result.stages[7].participants,3);assert.equal(result.stages[8].participants,null);assert.doesNotMatch(JSON.stringify(result),/Private wording|learner1|response1/);
});
test('wrong roles, wrong cohort scope and missing authentication are denied',async()=>{
 for(const role of ['LEARNER','FACILITATOR','SAFEGUARDING_OFFICER','']){await db.query("select set_config('test.role',$1,false)",[role]);await assert.rejects(flow(),/access/);}
 await db.exec("set test.role='SPONSOR_VIEWER';set test.scope='other';");await assert.rejects(flow(),/access/);await db.exec("set test.scope='group';set test.uid='';");await assert.rejects(flow(),/access/);
});
test('withdrawal and wrong response versions remove evidence without creating zero scores',async()=>{
 await db.exec("reset role;update responses set lab_version='0' where id='response1';set role authenticated;");let result=await flow();assert.equal(result.stages[7].suppressed,true);assert.equal(result.totals.anchoredMeasures,null);
 await db.exec("reset role;update consent_records set status='WITHDRAWN' where user_id in ('learner5','learner6');set role authenticated;");result=await flow();assert.equal(result.participantCount,4);assert.equal(result.suppressed,true);assert.equal(result.totals,null);assert.deepEqual(result.stages,[]);
});
test('photo counts exclude wrong users, enrolments, Labs and semantic contexts',async()=>{
 await db.exec(`reset role;insert into storage.objects values('own','bis-private-evidence','${uid}/enrol1/RES/I7/RES.FIELD/1.jpg'),('wrong-lab','bis-private-evidence','${uid}/enrol1/HAB/I7/HAB.FIELD/2.jpg'),('wrong-owner','bis-private-evidence','00000000-0000-0000-0000-000000000099/enrol1/RES/I7/RES.FIELD/3.jpg'),('wrong-enrol','bis-private-evidence','${uid}/enrol2/RES/I7/RES.FIELD/4.jpg');set role authenticated;`);
 assert.deepEqual((await db.query('select * from bis_portfolio_attachment_counts()')).rows,[{enrolment_id:'enrol1',investigation:7,photo_count:1}]);await db.exec("set test.uid='';");assert.deepEqual((await db.query('select * from bis_portfolio_attachment_counts()')).rows,[]);
});
test('staff version metadata reuses cohort scope and excludes experiment wording',async()=>{
 await db.exec("reset role;");for(const n of [1,2]) await db.query("insert into experiments(id,user_id,lab_code,lab_version,target_pattern,target_condition,alternative_behaviour,expected_reward,restart_plan,minimum_version,failure_signal,predicted_value,start_date,planned_end_date) values($1,$2,'RES',$3,'Private wording','Private wording','Private wording','Private wording','Private wording','Private wording','Private wording',50,'2026-10-01','2026-10-07')",[`experiment${n}`,`learner${n}`,String(n)]);
 await db.exec("set test.role='FACILITATOR';set role authenticated;");assert.deepEqual((await db.query('select * from staff_experiment_versions()')).rows,[{id:'experiment1',lab_version:'1'}]);await db.exec("set test.uid='';");assert.deepEqual((await db.query('select * from staff_experiment_versions()')).rows,[]);
});
test('public RPC wrappers are invokers and anonymous execution is revoked',async()=>{
 const rows=(await db.query("select proname,prosecdef,has_function_privilege('anon',oid,'execute') as anonymous from pg_proc where pronamespace='public'::regnamespace and proname in ('staff_experiment_versions','bis_portfolio_attachment_counts','sponsor_cohort_evidence_flow')")).rows;assert.equal(rows.length,3);for(const row of rows){assert.equal(row.prosecdef,false);assert.equal(row.anonymous,false);}
});
