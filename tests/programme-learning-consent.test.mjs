import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),root=new URL('../supabase/migrations/',import.meta.url);const owner='00000000-0000-0000-0000-000000000001';
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function private.can_view_sponsor_cohort(text) returns boolean language sql as $$select auth.uid()='${owner}'::uuid and current_setting('test.role',true) in ('SPONSOR_VIEWER','PROGRAMME_OWNER','SYSTEM_ADMIN') and $1=current_setting('test.scope',true)$$;
grant usage on schema auth,private to authenticated;grant execute on function auth.uid(),private.can_view_sponsor_cohort(text) to authenticated;`);
const base=await readFile(new URL('20260909000000_bis_production.sql',root),'utf8');
for(const table of ['learners','consent_records','lab_enrollments','responses','pilot_cohorts','cohort_members','hypotheses','experiments','experiment_events','measurement_values','safeguarding_cases'])await db.exec(base.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`,'i'))[0]);
await db.exec("alter table responses add column lab_code text not null default 'HAB';alter table responses add column privacy_class text not null default 'P2';alter table experiments add column lab_code text not null default 'HAB';create table handbook_progress(user_id text,lab_code text,semantic_step_id text,status text);");
const migration=(await readdir(root)).find(name=>name.endsWith('_programme_learning_consent_and_comparison_scope.sql'));assert.ok(migration);
await db.exec(await readFile(new URL(migration,root),'utf8'));
const privacyMigration=(await readdir(root)).find(name=>name.endsWith('_programme_learning_private_response_exclusion.sql'));assert.ok(privacyMigration);
await db.exec(await readFile(new URL(privacyMigration,root),'utf8'));
await db.exec("create table experiment_checkpoints(id text,user_id text,experiment_id text,status text,decision text,plan_changed boolean,created_at timestamptz,recorded_at timestamptz);" );
for(const name of ['sponsor_cohort_learning_summary','sponsor_cohort_outcomes','sponsor_cohort_deeper_analysis','sponsor_cohort_organisational_learning']) await db.exec(`create function public.${name}(target_cohort_id text) returns jsonb language sql stable security invoker set search_path='' as $$select private.${name}(target_cohort_id)$$; revoke all on function public.${name}(text) from public,anon;grant execute on function public.${name}(text) to authenticated;`);
test.after(()=>db.close());
test.beforeEach(async()=>{
 await db.exec(`reset role;truncate responses,handbook_progress,cohort_members,pilot_cohorts,lab_enrollments,consent_records,learners cascade;
 set test.uid='${owner}';set test.role='PROGRAMME_OWNER';set test.scope='group';
 insert into pilot_cohorts(id,name,lab_code,lab_version,facilitator_email,created_by) values('group','Consent fixture','HAB','1','staff@fixture.invalid','staff');`);
 for(let n=1;n<=10;n++){
  await db.query("insert into learners(user_id,email,display_name,age_band) values($1,$2,'Fixture','ADULT')",[`learner${n}`,`learner${n}@fixture.invalid`]);
  await db.query("insert into consent_records(id,user_id,policy_version,scope,status,created_at) values($1,$2,'1','product','GRANTED','2026-10-01')",[`consent${n}`,`learner${n}`]);
  await db.query("insert into cohort_members(id,cohort_id,learner_user_id,learner_email,added_by) values($1,'group',$2,$3,'staff')",[`member${n}`,`learner${n}`,`learner${n}@fixture.invalid`]);
  await db.query("insert into lab_enrollments(id,user_id,lab_code,lab_version) values($1,$2,'HAB','1')",[`enrol${n}`,`learner${n}`]);
  await db.query("insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,occurred_at) values($1,$2,'p','HAB.BASELINE.PROCRASTINATION','HAB','1',$3,now())",[`baseline${n}`,`learner${n}`,n<=5?'often':'rarely']);
  if(n<=7)for(const [suffix,value] of [['PRE',n===1?'9':'2'],['POST','4']])await db.query("insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,occurred_at) values($1,$2,'p',$3,'HAB','1',$4,now())",[`control${n}${suffix}`,`learner${n}`,`HAB.CONTROL.${suffix}`,value]);
 }
 await db.exec('set role authenticated;');
});
const summary=async()=> (await db.query("select sponsor_cohort_learning_summary('group') as result")).rows[0].result;
test('P3 values on recognised measure fields never enter means, baseline themes or response activity',async()=>{
 const before=await summary();
 await db.exec("reset role;");
 for(let n=1;n<=10;n++)for(const [field,value] of [['HAB.CONTROL.PRE','99'],['HAB.CONTROL.POST','99'],['HAB.BASELINE.PROCRASTINATION','always']]){
  await db.query("insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,privacy_class,occurred_at,recorded_at) values($1,$2,'P3-fixture',$3,'HAB','1',$4,'P3',now(),now()+interval '1 day')",[`private-${n}-${field}`,`learner${n}`,field,value]);
 }
 await db.exec("set role authenticated;");const after=await summary();
 assert.deepEqual(after.learningJourney.skillShifts,before.learningJourney.skillShifts);
 assert.deepEqual(after.learningJourney.baselineThemes,before.learningJourney.baselineThemes);
 assert.deepEqual(after.learningJourney.activity,before.learningJourney.activity);
 assert.doesNotMatch(JSON.stringify(after),/99|P3-fixture/);
});
test('matched source-version responses produce a paired self-report and no private text or identities',async()=>{
 await db.exec("reset role;insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,occurred_at) values('other-version','learner2','p','HAB.CONTROL.PRE','HAB','2','999',now()),('private','learner2','p','HAB.PRIVATE','HAB','1','SECRET PRIVATE REFLECTION',now());set role authenticated;");
 const result=await summary();assert.equal(result.participantCount,10);const control=result.learningJourney.skillShifts.find(x=>x.id==='perceived_control');assert.equal(control.pairedParticipants,7);assert.equal(control.averagePre,3);assert.equal(control.averagePost,4);assert.doesNotMatch(JSON.stringify(result),/999|SECRET|learner2|control2/);
});
test('latest withdrawal and inactive learner state remove their responses and preserve current denominator',async()=>{
 for(const mode of ['CONSENT','INACTIVE']){
  await db.exec(`reset role;${mode==='CONSENT'?"insert into consent_records(id,user_id,policy_version,scope,status,created_at) values('withdraw','learner1','1','product','WITHDRAWN','2026-10-02');":"update learners set status='INACTIVE' where user_id='learner1';"}set role authenticated;`);
  const result=await summary();assert.equal(result.participantCount,9);const control=result.learningJourney.skillShifts.find(x=>x.id==='perceived_control');assert.equal(control.pairedParticipants,6);assert.equal(control.averagePre,2);
  await db.exec("reset role;delete from consent_records where id='withdraw';update learners set status='ACTIVE' where user_id='learner1';set role authenticated;");
 }
});
test('withdrawn Lab enrolment is excluded and small paired or baseline complements hide all values',async()=>{
 await db.exec("reset role;update lab_enrollments set status='WITHDRAWN' where user_id='learner1';set role authenticated;");let result=await summary();assert.equal(result.learningJourney.skillShifts.find(x=>x.id==='perceived_control').pairedParticipants,6);
 await db.exec("reset role;update lab_enrollments set status='IN_PROGRESS';");for(const n of [8,9])for(const suffix of ['PRE','POST'])await db.query("insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,occurred_at) values($1,$2,'p',$3,'HAB','1','5',now())",[`extra${n}${suffix}`,`learner${n}`,`HAB.CONTROL.${suffix}`]);await db.exec("update responses set value='often' where semantic_field_id='HAB.BASELINE.PROCRASTINATION' and user_id<>'learner10';set role authenticated;");
 result=await summary();assert.deepEqual(result.learningJourney.skillShifts,[]);assert.deepEqual(result.learningJourney.baselineThemes,[]);
});
test('too few consenting members suppress the report; wrong roles, viewer, scope and missing auth are denied',async()=>{
 for(const [setting,value] of [['role','FACILITATOR'],['scope','other'],['uid','00000000-0000-0000-0000-000000000099'],['uid','']]){
  await db.query(`select set_config('test.${setting}',$1,false)`,[value]);await assert.rejects(summary(),/access/);await db.exec(`set test.role='PROGRAMME_OWNER';set test.scope='group';set test.uid='${owner}';`);
 }
 await db.exec("reset role;update consent_records set status='WITHDRAWN' where user_id not in ('learner1','learner2','learner3');set role authenticated;");const result=await summary();assert.equal(result.suppressed,true);assert.equal(result.learningJourney,null);assert.equal(result.participantCount,3);
});
test('anonymous execution and direct access to the membership helper remain denied',async()=>{
 const rows=(await db.query("select n.nspname,p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'execute') as anonymous,has_function_privilege('authenticated',p.oid,'execute') as authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname='sponsor_cohort_learning_summary') or (n.nspname='private' and p.proname='bis_learning_report_members')")).rows;assert.equal(rows.length,2);for(const row of rows){assert.equal(row.anonymous,false);assert.equal(row.prosecdef,false);}assert.equal(rows.find(x=>x.proname==='bis_learning_report_members').authenticated,false);
 await assert.rejects(db.query("select * from private.bis_learning_report_members('group')"),/permission denied/);
});

test('all legacy reporting families use the same current consenting population',async()=>{
 await db.exec("reset role;insert into consent_records(id,user_id,policy_version,scope,status,created_at) values('withdraw','learner1','1','product','WITHDRAWN','2026-10-02');set role authenticated;");
 for(const name of ['sponsor_cohort_outcomes','sponsor_cohort_deeper_analysis','sponsor_cohort_organisational_learning']){
  const result=(await db.query(`select ${name}('group') as result`)).rows[0].result;assert.equal(result.participantCount,9,name);assert.equal(result.suppressed,false,name);
  await db.exec("set test.scope='other';");await assert.rejects(db.query(`select ${name}('group')`),/access/);await db.exec("set test.scope='group';");
 }
});
