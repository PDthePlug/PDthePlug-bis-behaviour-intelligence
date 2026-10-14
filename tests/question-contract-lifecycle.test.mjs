import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),root=new URL('../supabase/migrations/',import.meta.url);
await db.exec(`create role anon;create role authenticated;create schema private;create function private.has_staff_role(text) returns boolean language sql as $$select false$$;
create table question_analysis_registry(id text primary key,lab_code text,lab_version text,semantic_field_id text,question_family text,label text,answer_model text,sensitivity text,aggregate_policy text,status text,updated_at timestamptz);
create table curriculum_evidence_mappings(id text primary key default gen_random_uuid()::text,registry_id text,lab_code text,lab_version text,semantic_field_id text,task_id text,prompt_label text,evidence_class text,portfolio_purpose text,outcome text,competency text,source_reference text,classification_status text,supersedes_id text,created_by text,created_at timestamptz default clock_timestamp());`);
for(const file of ['20261013170000_question_evidence_contract_framework.sql','20261013170075_uncontracted_questions_fail_closed.sql','20261014040000_question_contract_retirement_integrity.sql'])await db.exec(await readFile(new URL(file,root),'utf8'));
await db.exec(`insert into question_evidence_contracts(id,lab_code,question_family,competency_id,evidence_class,stage_ceiling,model_review_policy,claim_authority,contract_status,allowed_inference,forbidden_inference,source_reference,source_hash) values('contract','HAB','QF-TEST','AC-C04','LEARNING_CHECK','EXPLAIN','FACILITATOR_SHARED_ONLY','HUMAN_REVIEW_REQUIRED','APPROVED_MEANING','Task meaning','No achieved stage','Synthetic fixture',repeat('0',64));`);
test.after(()=>db.close());
test('approved meaning activates candidates while uncontracted and P3 questions stay excluded from model review',async()=>{
 for(const [id,family,sensitivity] of [['eligible','QF-TEST','P2'],['private','QF-TEST','P3'],['uncontracted','QF-UNKNOWN','P2']])await db.query("insert into question_analysis_registry(id,lab_code,lab_version,semantic_field_id,question_family,label,answer_model,sensitivity,aggregate_policy,status) values($1,'HAB','1',$1,$2,'Synthetic','TEXT',$3,'STRUCTURED_ONLY','CANDIDATE')",[id,family,sensitivity]);
 const rows=(await db.query('select id,status,model_review_policy,aggregate_policy from question_analysis_registry order by id')).rows;
 assert.equal(rows.find(x=>x.id==='eligible').status,'ACTIVE');assert.equal(rows.find(x=>x.id==='eligible').model_review_policy,'FACILITATOR_SHARED_ONLY');assert.equal(rows.find(x=>x.id==='private').model_review_policy,'DISABLED');assert.equal(rows.find(x=>x.id==='uncontracted').status,'CANDIDATE');assert.ok(rows.every(x=>x.aggregate_policy==='EXCLUDE'));
});
test('explicit retirement remains retired, disables permission and cannot be revived by refresh',async()=>{
 await db.exec("insert into question_analysis_registry(id,lab_code,lab_version,semantic_field_id,question_family,label,answer_model,sensitivity,aggregate_policy,status) values('retirement','HAB','1','retirement','QF-TEST','Synthetic','TEXT','P2','EXCLUDE','CANDIDATE');");
 const before=(await db.query("select count(*)::int as count from curriculum_evidence_mappings where registry_id='retirement'")).rows[0].count;
 await db.exec("update question_analysis_registry set status='RETIRED' where id='retirement';select private.refresh_question_evidence_contracts('HAB');");
 const row=(await db.query("select status,model_review_policy,aggregate_policy from question_analysis_registry where id='retirement'")).rows[0];assert.deepEqual(row,{status:'RETIRED',model_review_policy:'DISABLED',aggregate_policy:'EXCLUDE'});
 assert.equal((await db.query("select count(*)::int as count from curriculum_evidence_mappings where registry_id='retirement'")).rows[0].count,before);
});
