import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('all ten source transfer rubrics preserve the authored criteria, 1–5 scale and /25 total',async()=>{
 const templates=JSON.parse(await file('lib/authored-assessment-rubrics.json'));
 assert.equal(templates.length,10);assert.deepEqual(templates.map(t=>t.labCode),['SYS','LTT','ECO','CUS','INN','AST','FIN','PEF','TRS','MTL']);
 for(const t of templates){assert.equal(t.criteria.length,5);assert.equal(t.scaleMin,1);assert.equal(t.scaleMax,5);assert.equal(t.authoredTotal,true);assert.match(t.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(new Set(t.criteria.map(c=>c.id)).size,5);}
 assert.deepEqual(templates[0].criteria.map(c=>c.label),['Identifies structure beneath event','Identifies interconnections','Identifies feedback loops','Identifies leverage point','Quality of reasoning']);
 assert.deepEqual(templates[6].criteria.map(c=>c.label),['Identifies the difference','Identifies the philosophy of each person','Articulates what would change','Quality of reasoning','Depth of insight']);
});
test('learner evidence exports scope reviews to the authenticated learner and preserve separate originals, measures and interpretations',async()=>{
 const route=await file('app/api/evidence-engine/route.ts');
 assert.match(route,/identityFrom\(\)/);assert.match(route,/submissions\.filter\(s=>s\.user_id===identity\.id\)/);assert.match(route,/originalEvidence:records/);assert.match(route,/derivedLabPortfolio:portfolio/);assert.match(route,/schemaVersion:"BIS-EVIDENCE-1"/);assert.match(route,/private, no-store/);
 assert.doesNotMatch(route,/SERVICE_ROLE|service_role|SUPABASE_SECRET/);
});
test('new assessment and delivery tables have explicit grants and RLS, exposed RPCs are invokers and privileged workers stay private',async()=>{
 const engine=await file('supabase/migrations/20261005113046_staff_evidence_assessment_engine.sql');
 for(const table of ['curriculum_evidence_mappings','assessment_rubric_versions','evidence_submissions','evidence_assessments'])assert.ok(engine.includes(`alter table public.${table} enable row level security`));
 assert.match(engine,/alter function public\.bis_assess_evidence\([\s\S]*set schema private/);assert.match(engine,/create function public\.bis_assess_evidence\([^\n]+security invoker/);
 const guard=await file('supabase/migrations/20261005121639_evidence_engine_integrity_guards.sql');assert.match(guard,/using\(false\) with check\(false\)/);assert.match(guard,/Retired evidence cannot be restored/);
 const sessions=await file('supabase/migrations/20261005120231_facilitator_class_operations.sql');assert.match(sessions,/programme_day between 1 and 10/);assert.match(sessions,/s\.status<>'HELD'/);assert.match(sessions,/supersedes_id/);
});
