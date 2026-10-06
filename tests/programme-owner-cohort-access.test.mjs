import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
const db=new PGlite(),root=new URL("../supabase/migrations/",import.meta.url);
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth',true),'')::uuid$$;
create function private.current_app_user_id() returns text language sql as $$select nullif(current_setting('test.actor',true),'')$$;
create function private.current_email() returns text language sql as $$select lower(nullif(current_setting('test.email',true),''))$$;
grant usage on schema public,auth,private to authenticated,anon;grant execute on all functions in schema auth,private to authenticated,anon;`);
const base=await readFile(new URL("20260909000000_bis_production.sql",root),"utf8");
for(const table of ["learners","role_assignments","pilot_cohorts","cohort_members"])await db.exec(base.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`,"i"))[0]);
const functionSql=(source,name)=>source.match(new RegExp(`create or replace function private\\.${name}\\([\\s\\S]*?\\$\\$;`,"i"))[0];
await db.exec(functionSql(base,"has_staff_role"));
await db.exec(functionSql(await readFile(new URL("20261003072848_consolidate_leap9_preserving_facilitators.sql",root),"utf8"),"can_manage_cohort"));
await db.exec(await readFile(new URL("20260925224500_programme_decision_register.sql",root),"utf8"));
await db.exec(`alter table pilot_cohorts enable row level security;alter table cohort_members enable row level security;
grant select,insert,update,delete on pilot_cohorts to authenticated;grant select on cohort_members to authenticated;
${base.match(/create policy cohorts_read[\s\S]*?;/)[0]}
create policy cohorts_admin_insert on pilot_cohorts for insert to authenticated with check(private.has_staff_role('SYSTEM_ADMIN'));
create policy cohorts_admin_update on pilot_cohorts for update to authenticated using(private.has_staff_role('SYSTEM_ADMIN')) with check(private.has_staff_role('SYSTEM_ADMIN'));
create policy cohorts_admin_delete on pilot_cohorts for delete to authenticated using(private.has_staff_role('SYSTEM_ADMIN'));
create policy members_facilitator_read on cohort_members for select to authenticated using(private.can_manage_cohort(cohort_id));`);
if(process.env.BIS_TEST_PRIOR_OWNER_POLICY!=="true")await db.exec(await readFile(new URL("20261006123109_hardening_programme_owner_cohort_read.sql",root),"utf8"));
const principal=async(actor,email,authenticated=true)=>db.exec(`reset role;set test.actor='${actor}';set test.email='${email}';set test.auth='${authenticated?"00000000-0000-4000-8000-000000000001":""}';set role authenticated;`);
const visible=async()=> (await db.query("select id from pilot_cohorts order by id")).rows.map(row=>row.id);
test.after(()=>db.close());
test.beforeEach(async()=>{
 await db.exec(`reset role;truncate programme_decisions,cohort_members,pilot_cohorts,role_assignments,learners cascade;
insert into learners(user_id,email,display_name,age_band) values('learner','learner@local.invalid','Learner','ADULT');
insert into pilot_cohorts(id,name,facilitator_email,created_by) values('own','Assigned group','fac@local.invalid','admin'),('other','Other group','other-fac@local.invalid','admin');
insert into cohort_members(id,cohort_id,learner_user_id,learner_email,added_by) values('member','own','learner','learner@local.invalid','admin');
insert into role_assignments(id,principal_email,user_id,role,scope_type,scope_id,status,assigned_by) values
('owner','OWNER@local.invalid',null,'PROGRAMME_OWNER','COHORT','own','ACTIVE','admin'),
('linked','different@local.invalid','linked-owner','PROGRAMME_OWNER','COHORT','own','ACTIVE','admin'),
('sponsor','sponsor@local.invalid',null,'SPONSOR_VIEWER','COHORT','own','ACTIVE','admin'),
('fac','fac@local.invalid',null,'FACILITATOR','COHORT','own','ACTIVE','admin'),
('admin','admin@local.invalid',null,'SYSTEM_ADMIN','GLOBAL','GLOBAL','ACTIVE','admin'),
('revoked','revoked@local.invalid',null,'PROGRAMME_OWNER','COHORT','own','REVOKED','admin'),
('global','global@local.invalid',null,'PROGRAMME_OWNER','GLOBAL','GLOBAL','ACTIVE','admin');`);
});
test("assigned programme owner can validate own group and record a team decision",async()=>{
 await principal('owner','owner@local.invalid');assert.deepEqual(await visible(),['own']);
 await db.query(`insert into programme_decisions(id,cohort_id,source_signal,source_title,source_evidence,decision_text,expected_outcome,created_by,created_by_email) select 'decision',id,'OTHER','Group evidence','Recorded information','Retain current programme','Review later','owner','owner@local.invalid' from pilot_cohorts where id='own'`);
 assert.equal((await db.query("select count(*)::int as n from programme_decisions")).rows[0].n,1);
 await assert.rejects(db.query(`insert into programme_decisions(id,cohort_id,source_signal,source_title,source_evidence,decision_text,expected_outcome,created_by,created_by_email) values('foreign','other','OTHER','Group evidence','Recorded information','Retain current programme','Review later','owner','owner@local.invalid')`),/row-level security/);
});
test("linked application identity resolves the exact assigned group",async()=>{await principal('linked-owner','new-email@local.invalid');assert.deepEqual(await visible(),['own']);});
test("owner metadata access grants no cohort writes or participant detail",async()=>{
 await principal('owner','owner@local.invalid');assert.deepEqual((await db.query("select * from cohort_members")).rows,[]);
 assert.equal((await db.query("update pilot_cohorts set name='Changed' where id='own' returning id")).rows.length,0);
 assert.equal((await db.query("delete from pilot_cohorts where id='own' returning id")).rows.length,0);
 await assert.rejects(db.query("insert into pilot_cohorts(id,name,facilitator_email,created_by) values('new','New','fac@local.invalid','owner')"),/row-level security/);
});
test("sponsor, learner, revoked and global-only owners receive no new metadata access",async()=>{
 for(const email of ['sponsor@local.invalid','learner@local.invalid','revoked@local.invalid','global@local.invalid']){await principal('actor',email);assert.deepEqual(await visible(),[]);}
});
test("existing facilitator and administrator scopes remain intact",async()=>{await principal('fac','fac@local.invalid');assert.deepEqual(await visible(),['own']);assert.equal((await db.query("select * from cohort_members")).rows.length,1);await principal('admin','admin@local.invalid');assert.deepEqual(await visible(),['other','own']);});
test("missing authentication and anonymous role cannot use the owner policy",async()=>{await principal('owner','owner@local.invalid',false);assert.deepEqual(await visible(),[]);await db.exec('reset role;set role anon');await assert.rejects(db.query('select id from pilot_cohorts'),/permission denied/);});
