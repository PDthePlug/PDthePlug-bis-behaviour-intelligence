import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
const db=new PGlite();
const root=new URL("../supabase/migrations/",import.meta.url);
const files=["20260909000000_bis_production.sql","20260924153000_bis_content_studio.sql","20261003130000_question_intelligence_registry.sql"];
const schemas=(await Promise.all(files.map(f=>readFile(new URL(f,root),"utf8")))).join("\n");
await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
 create function private.can_view_sponsor_cohort(text) returns boolean language sql as $$ select current_setting('test.role',true)='SPONSOR_VIEWER' and $1=current_setting('test.scope',true) $$;
 grant usage on schema private,auth to authenticated;grant execute on all functions in schema private,auth to authenticated;`);
const tables=["learners","consent_records","pilot_cohorts","cohort_members","responses","content_library_items","content_library_versions","question_analysis_registry"];
for(const name of tables){const sql=schemas.match(new RegExp(`create table public\\.${name} \\([\\s\\S]*?\\n\\);`,"i"));assert.ok(sql,name);await db.exec(sql[0]);}
await db.exec("alter table responses add column lab_code text not null default 'HAB';");
await db.exec(await readFile(new URL("20261004114832_question_pattern_typed_observations.sql",root),"utf8"));
test.after(()=>db.close());
test.beforeEach(async()=>{
 await db.exec(`reset role;truncate ${tables.join(",")} cascade;set test.role='SPONSOR_VIEWER';set test.scope='cohort';`);
 await db.exec("insert into content_library_items(id,kind,code,slug,title,created_by) values('title','LAB','HAB','habit','Habit Lab','admin'); insert into content_library_versions(id,item_id,version,status,created_by) values('version','title','v1','PUBLISHED','admin'); insert into pilot_cohorts(id,name,lab_code,lab_version,facilitator_email,created_by) values('cohort','Local specimens','HAB','v1','facilitator@example.invalid','admin');");
 for(let i=1;i<=5;i++)await db.query("insert into learners(user_id,email,display_name,age_band) values($1,$2,'Local specimen','ADULT');",[`learner${i}`,`learner${i}@example.invalid`]);
 for(let i=1;i<=5;i++){
  await db.query("insert into consent_records(id,user_id,policy_version,scope,status) values($1,$1,'1','PRODUCT','GRANTED')",[`learner${i}`]);
  await db.query("insert into cohort_members(id,cohort_id,learner_user_id,learner_email,added_by) values($1,'cohort',$1,$2,'admin')",[`learner${i}`,`learner${i}@example.invalid`]);
 }
});
async function question(field,type,status="ACTIVE",policy="STRUCTURED_ONLY",sensitivity="P2"){
 await db.query("insert into question_analysis_registry(id,version_id,lab_code,lab_version,semantic_field_id,question_family,label,evidence_class,answer_model,status,aggregate_policy,sensitivity) values($1,'version','HAB','v1',$1,'family','Programme question','OBSERVATION',$2,$3,$4,$5)",[field,type,status,policy,sensitivity]);
}
async function answer(field,i,value,status="ANSWERED"){
 await db.query("insert into responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,response_status,occurred_at) values($1,$2,$3,$3,'HAB','v1',$4,$5,now())",[`${field}:${i}`,`learner${i}`,field,value,status]);
}
const report=async()=>(await db.query("select sponsor_cohort_question_patterns('cohort') as result")).rows[0].result;
test("JSON-string and numeric ratings contribute to the same governed average",async()=>{
 await question("rating","INTEGER");for(let i=1;i<=5;i++)await answer("rating",i,i%2?JSON.stringify(String(i)):JSON.stringify(i));
 const r=await report();assert.equal(r.questions[0].respondents,5);assert.equal(r.questions[0].summary.average,3);
});
test("previously published retired questions remain usable for their historical cohort",async()=>{
 await question("rating","INTEGER","RETIRED");for(let i=1;i<=5;i++)await answer("rating",i,'"4"');
 assert.equal((await report()).questions.length,1);
 await db.exec("update content_library_versions set status='DRAFT'");assert.equal((await report()).questions.length,0);
});
test("no opportunity stays a separate category and small cells remain suppressed",async()=>{
 await question("action","BOOLEAN");for(let i=1;i<=5;i++)await answer("action",i,JSON.stringify(i<=3?"No opportunity":"No"));
 const r=await report();assert.deepEqual(r.questions[0].summary.categories.map(c=>[c.value,c.participants]),[["No opportunity",3]]);
 assert.equal(r.questions[0].summary.suppressedResponses,2);
});
test("withdrawal and inactive membership shrink the reportable group before any question is exposed",async()=>{
 await question("rating","INTEGER");for(let i=1;i<=5;i++)await answer("rating",i,'"4"');
 await db.exec("update consent_records set status='WITHDRAWN' where user_id='learner5'");
 const r=await report();assert.equal(r.suppressed,true);assert.equal(r.participantCount,4);assert.deepEqual(r.questions,[]);
});
test("private wording, P3 fields, passed values and invalid ratings are excluded",async()=>{
 await question("reflection","TEXT","ACTIVE","EXCLUDE");await question("private-rating","INTEGER","ACTIVE","STRUCTURED_ONLY","P3");await question("rating","INTEGER");
 for(let i=1;i<=5;i++){await answer("reflection",i,JSON.stringify("Private reflection wording"));await answer("private-rating",i,'"4"');await answer("rating",i,i<=2?'"4"':i===3?'"not numeric"':'""',i>=4?"PASS":"ANSWERED");}
 const r=await report();assert.deepEqual(r.questions,[]);assert.equal(JSON.stringify(r).includes("Private reflection"),false);
});
test("wrong roles and wrong cohort scopes are denied",async()=>{
 await db.exec("set test.role='FACILITATOR'");await assert.rejects(report(),/do not have access/);
 await db.exec("set test.role='SPONSOR_VIEWER';set test.scope='other'");await assert.rejects(report(),/do not have access/);
});
