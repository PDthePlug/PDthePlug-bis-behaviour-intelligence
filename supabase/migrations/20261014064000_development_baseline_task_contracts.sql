-- Existing source-reviewed baseline meanings supply recognition criteria only.
-- This creates no learner achievement, human review or aggregate permission.
insert into public.development_task_contracts(id,lab_code,lab_version,competency_id,mapping_ids,semantic_field_ids,title,source_reference,source_hash,stage_ceiling,comparison_key,source_nature,created_by)
select 'DEV-BASELINE-'||m.id,m.lab_code,m.lab_version,m.competency,array[m.id],array[m.semantic_field_id],left(m.prompt_label,300),q.source_reference,q.source_hash,'NOTICE',m.competency||':'||q.question_family||':recognition-v1','SELF_REPORT','source-meaning-approval:'||q.id
from public.curriculum_evidence_mappings m join public.question_evidence_contracts q on q.id=m.contract_id join public.question_analysis_registry r on r.id=m.registry_id
where m.classification_status='APPROVED' and m.evidence_class='BASELINE' and q.contract_status='APPROVED_MEANING' and q.stage_ceiling='NOTICE' and q.source_nature='SELF_REPORT' and r.status<>'RETIRED'
and q.source_hash ~ '^[a-f0-9]{64}$' and length(btrim(q.source_reference)) between 1 and 2000
and m.id=(select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)
and r.id=(select z.id from public.question_analysis_registry z where z.lab_code=r.lab_code and z.lab_version=r.lab_version and z.semantic_field_id=r.semantic_field_id order by z.updated_at desc,z.id desc limit 1)
on conflict(id) do nothing;
