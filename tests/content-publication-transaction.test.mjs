import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const root = new URL("../supabase/migrations/", import.meta.url);
const tables = ["learners","lab_enrollments","lab_assignments","content_library_items","content_library_versions","content_runtime_artifacts","content_runtime_activations","content_edition_activations","content_activation_uat","content_releases","question_analysis_registry","audit_events"];
const migrations = ["20260909000000_bis_production.sql","20260914090000_bis_learning_foundation.sql","20260924153000_bis_content_studio.sql","20260924183000_bis_content_compiler_runtime.sql","20260925093000_content_studio_founder_flow.sql","20260924221500_bis_content_preview_activation_uat.sql","20261003130000_question_intelligence_registry.sql"];
await db.exec(`create role anon; create role authenticated; create schema auth; create schema private; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
 create function private.current_app_user_id() returns text language sql as $$ select auth.uid()::text $$;
 create function private.has_staff_role(text) returns boolean language sql as $$ select coalesce(current_setting('test.staff_role',true),'')=$1 $$;
 grant usage on schema auth,private to authenticated;
 grant execute on all functions in schema auth,private to authenticated;`);
// Use the actual product table definitions, including constraints and foreign keys.
const source = (await Promise.all(migrations.map(name=>readFile(new URL(name,root),"utf8")))).join("\n");
for (const table of tables) {
  const match=source.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`,"i"));
  assert.ok(match,table);
  await db.exec(match[0]);
}
await db.exec(`alter table public.content_library_versions add column compiler_status text not null default 'NOT_COMPILED', add column compiler_report text not null default '{}', add column compiler_version text;
 create unique index uq_content_runtime_one_active on public.content_runtime_activations(item_id) where status='ACTIVE';
 create unique index uq_content_edition_activation_active on public.content_edition_activations(item_id,delivery_edition) where status='ACTIVE';`);
for(const table of tables){
  if (table === "content_releases") {
    await db.exec("alter table content_releases enable row level security; grant select on content_releases to authenticated; create policy content_releases_read on content_releases for select to authenticated using(status in ('CONTROLLED','PUBLISHED'));");
    continue;
  }
  await db.exec(`alter table public.${table} enable row level security; grant select,insert,update,delete on public.${table} to authenticated;
    create policy test_admin on public.${table} for all to authenticated using(private.has_staff_role('SYSTEM_ADMIN')) with check(private.has_staff_role('SYSTEM_ADMIN'));`);
}
await db.exec(await readFile(new URL("20261004033000_content_activation_offline_state.sql",root),"utf8"));
await db.exec(await readFile(new URL("20261004111602_atomic_content_publication.sql",root),"utf8"));
await db.exec(await readFile(new URL("20261006120007_hardening_learning_static_offline.sql",root),"utf8"));
await db.exec(await readFile(new URL("20261003234500_active_universal_lab_runtime.sql",root),"utf8"));
await db.exec(await readFile(new URL("20261004112609_universal_enrolment_continuity.sql",root),"utf8"));
await db.exec(await readFile(new URL("20261004154823_preserve_static_enrolment_handoff.sql",root),"utf8"));
test.after(()=>db.close());
test.beforeEach(async()=>{
  await db.exec(`reset role; truncate ${tables.map(t=>`public.${t}`).join(",")} cascade; set test.user_id='00000000-0000-0000-0000-000000000001'; set test.staff_role='SYSTEM_ADMIN'; set role authenticated;`);
});
async function item(kind="LAB"){
  await db.query(`insert into content_library_items(id,kind,code,slug,title,created_by) values ('title',$1,'HAB','habit','Habit Lab','admin')`,[kind]);
}
async function version(id,editions=["school"],kind="LAB"){
  await db.query(`insert into content_library_versions(id,item_id,version,status,runtime_status,compiler_status,compiler_version,compiler_report,created_by) values ($1,'title',$1,'APPROVED','READY','COMPILED','bis-content-compiler-6','{"editorialStatus":"PASS"}','admin')`,[id]);
  const keys=kind==="LAB"?["lab:universal"]:editions.map(e=>`learning:${e}`);
  for (const [index,key] of keys.entries()) await db.query(`insert into content_runtime_artifacts(id,version_id,item_id,artifact_key,delivery_edition,storage_path,artifact_hash,artifact_bytes,compiler_version) values($1,$2,'title',$3,$4,'runtime/test',$5,42,'bis-content-compiler-6')`,[`${id}:${key}`,id,key,kind==="LAB"?null:editions[index],`${id}hash${index}`]);
  const fingerprint=createHash("sha256").update(keys.map((key,i)=>`${key}:${id}hash${i}`).sort().join("|")).digest("hex");
  await db.query(`insert into content_activation_uat(id,version_id,item_id,artifact_fingerprint,previewed_artifacts,checklist,status,updated_by) values($1,$1,'title',$2,$3,$4,'PASSED','admin')`,[id,fingerprint,JSON.stringify(keys),JSON.stringify(Object.fromEntries(["authored_content","navigation","inputs_privacy","responsive","handoff_completion","learner_language"].map(k=>[k,true])))]);
}
const transition=(action,id=null)=>db.query("select bis_transition_content($1,'title',$2,'bis-content-compiler-6')",[action,id]);
const rows=async(table,columns="*")=>(await db.query(`select ${columns} from ${table} order by id`)).rows;

test("taking a migrated learning module offline also closes its retained static fallback",async()=>{
  await item("LEARNING_MODULE");
  await version("legacy",["school","emerging_adult","workplace"],"LEARNING_MODULE");
  await db.query("update content_library_versions set status='PUBLISHED',runtime_status='LIVE' where id='legacy'");
  await db.query("insert into content_runtime_activations(id,item_id,version_id,runtime_mode,status,activated_by) values('legacy-live','title','legacy','STATIC','ACTIVE','admin')");
  await version("update",["school"],"LEARNING_MODULE");
  await transition("PUBLISH","update");
  // An edition-specific publication must preserve other accepted editions.
  assert.equal((await rows("content_runtime_activations"))[0].status,"ACTIVE");
  await transition("UNPUBLISH");
  assert.equal((await rows("content_runtime_activations")).filter(a=>a.status==="ACTIVE").length,0);
  assert.equal((await rows("content_edition_activations")).filter(a=>a.status==="ACTIVE").length,0);
  assert.deepEqual((await rows("content_library_versions")).map(v=>[v.id,v.runtime_status]),[["legacy","READY"],["update","READY"]]);
  assert.equal((await rows("content_runtime_artifacts")).length,4);
  await transition("REPUBLISH","update");
  assert.equal((await rows("content_runtime_activations")).filter(a=>a.status==="ACTIVE").length,0);
  assert.deepEqual((await rows("content_edition_activations")).filter(a=>a.status==="ACTIVE").map(a=>a.delivery_edition),["school"]);
});

test("publish, replace, rollback, take offline and repeatedly restore retain one exact live Lab",async()=>{
  await item(); await version("v1"); await transition("PUBLISH","v1");
  await version("v2"); await transition("PUBLISH","v2"); await transition("ROLLBACK");
  assert.deepEqual((await rows("content_runtime_activations")).filter(a=>a.status==="ACTIVE").map(a=>a.version_id),["v1"]);
  for(let i=0;i<3;i++){await transition("UNPUBLISH");assert.equal((await rows("content_runtime_activations")).filter(a=>a.status==="ACTIVE").length,0);await transition("REPUBLISH","v1");}
  assert.equal((await rows("content_runtime_activations")).filter(a=>a.status==="ACTIVE").length,1);
  assert.equal((await rows("audit_events")).length,9);
});
test("restoring one learning edition leaves independently published editions live",async()=>{
  await item("LEARNING_MODULE"); await version("v1",["school","workplace"],"LEARNING_MODULE");await transition("PUBLISH","v1");
  await version("v2",["school"],"LEARNING_MODULE");await transition("PUBLISH","v2");
  assert.equal((await rows("content_library_versions")).find(v=>v.id==="v1").runtime_status,"LIVE");
  await transition("ROLLBACK");
  assert.deepEqual((await rows("content_edition_activations")).filter(a=>a.status==="ACTIVE").map(a=>[a.delivery_edition,a.version_id]).sort(),[["school","v1"],["workplace","v1"]]);
});
test("failed release insertion rolls back activation, version, release and audit together",async()=>{
  await item("LEARNING_MODULE");await version("v1",["school"],"LEARNING_MODULE");await transition("PUBLISH","v1");
  await version("v2",["school"],"LEARNING_MODULE");
  await db.exec("reset role; alter table content_releases add constraint injected_failure check(content_version<>'v2'); set role authenticated;");
  const before=await rows("content_edition_activations");const audits=await rows("audit_events");
  await assert.rejects(transition("PUBLISH","v2"),/injected_failure/);
  assert.deepEqual(await rows("content_edition_activations"),before);assert.deepEqual(await rows("audit_events"),audits);
  assert.equal((await rows("content_library_versions")).find(v=>v.id==="v2").status,"APPROVED");
  await db.exec("reset role; alter table content_releases drop constraint injected_failure; set role authenticated;");
});
test("stale artifacts, missing preview and missing checks cannot publish",async()=>{
  await item();await version("v1");
  await db.query("update content_runtime_artifacts set artifact_hash='changed' where version_id='v1'");
  await assert.rejects(transition("PUBLISH","v1"),/exact version/);
  assert.equal((await rows("content_runtime_activations")).length,0);
});
test("unauthenticated and wrong operational roles cannot mutate content",async()=>{
  await item();await version("v1");
  for(const role of ["LEARNER","FACILITATOR","PROGRAMME_OWNER","SAFeguarding_OFFICER",""]){
    await db.query("select set_config('test.staff_role',$1,false)",[role]);
    await assert.rejects(transition("PUBLISH","v1"),/do not have access/);
  }
  await db.exec("set test.staff_role='SYSTEM_ADMIN'; set test.user_id='';");
  await assert.rejects(transition("PUBLISH","v1"),/do not have access/);
});

test("an enrolled learner retains the published version and evidence identity after replacement",async()=>{
  await item();await version("v1");await transition("PUBLISH","v1");
  const own="00000000-0000-0000-0000-000000000001",other="00000000-0000-0000-0000-000000000002";
  for(const id of [own,other])await db.query("insert into learners(user_id,email,display_name,age_band) values($1,$2,'Local specimen','ADULT')",[id,`${id}@example.invalid`]);
  await db.query("insert into lab_enrollments(id,user_id,lab_code,lab_version,current_investigation) values('original',$1,'HAB','v1',7)",[own]);
  await version("v2");await transition("PUBLISH","v2");
  const resolve=async()=> (await db.query("select * from learner_bis_lab_runtime('HAB')")).rows;
  assert.equal((await resolve())[0].version,"v1");
  await db.query("select set_config('test.user_id',$1,false)",[other]);
  assert.equal((await resolve())[0].version,"v2","other learners cannot select another learner's historical version");
  await db.query("select set_config('test.user_id',$1,false)",[own]);
  await transition("UNPUBLISH");assert.equal((await resolve()).length,0,"taking the title offline also stops historical runtime access");
});

test("stale compiler identity and unresolved editorial decisions cannot publish",async()=>{
  await item();await version("v1");
  await db.query("update content_library_versions set compiler_version='earlier' where id='v1'");
  await assert.rejects(transition("PUBLISH","v1"),/Prepare, review/);
  await db.query("update content_library_versions set compiler_version='bis-content-compiler-6',compiler_report='{\"editorialStatus\":\"REVIEW\"}' where id='v1'");
  await assert.rejects(transition("PUBLISH","v1"),/preparation notes/);
  await db.query("update content_activation_uat set checklist=(checklist::jsonb || '{\"editorial_review\":true}'::jsonb)::text,notes='The repeated questions measure change against the initial baseline.' where version_id='v1'");
  await transition("PUBLISH","v1");
});

test('static compatibility preserves an existing enrolment and an offline title blocks every version',async()=>{
 await item();await version('v1');await transition('PUBLISH','v1');
 await db.query("update content_runtime_activations set runtime_mode='STATIC' where status='ACTIVE'");
 await db.query("insert into learners(user_id,email,display_name,age_band) values('00000000-0000-0000-0000-000000000001','specimen@example.invalid','Specimen','ADULT')");
 await db.query("insert into lab_enrollments(id,user_id,lab_code,lab_version,current_investigation) values('pinned','00000000-0000-0000-0000-000000000001','HAB','v1',7)");
 await version('v2');await transition('PUBLISH','v2');
 let result=(await db.query("select * from learner_bis_lab_runtime('HAB')")).rows;
 assert.equal(result[0].version,'v1');assert.equal(result[0].runtime_mode,'STATIC');assert.equal((await rows('lab_enrollments'))[0].current_investigation,7);
 await transition('UNPUBLISH');assert.deepEqual((await db.query("select * from learner_bis_lab_runtime('HAB')")).rows,[]);
});
test('an active assignment pins its published version until learner privacy acknowledgement creates an enrolment',async()=>{
 await item();await version('v1');await transition('PUBLISH','v1');
 await db.query("insert into learners(user_id,email,display_name,age_band) values('00000000-0000-0000-0000-000000000001','specimen@example.invalid','Specimen','ADULT')");
 await db.query("insert into lab_assignments(id,learner_user_id,learner_email,lab_code,lab_version,assigned_by) values('assigned','00000000-0000-0000-0000-000000000001','specimen@example.invalid','HAB','v1','staff')");
 await version('v2');await transition('PUBLISH','v2');
 assert.equal((await db.query("select * from learner_bis_lab_runtime('HAB')")).rows[0].version,'v1');assert.deepEqual(await rows('lab_enrollments'),[]);
 await db.exec("set test.user_id='00000000-0000-0000-0000-000000000002';");assert.equal((await db.query("select * from learner_bis_lab_runtime('HAB')")).rows[0].version,'v2');
});
