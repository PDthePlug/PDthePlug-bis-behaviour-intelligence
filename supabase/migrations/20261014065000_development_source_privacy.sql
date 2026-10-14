-- Current source privacy remains authoritative after assessment approval.
-- Keep approved assessment contracts current at publication, review and reporting.
create or replace function private.development_contract_is_current(target text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.development_task_contracts c where c.id=target
 and cardinality(c.mapping_ids)=(select count(*) from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.classification_status='APPROVED')
 and not exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and (m.id is distinct from(select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)
 or (m.registry_id is not null and not exists(select 1 from public.question_analysis_registry q where q.id=m.registry_id and q.status<>'RETIRED' and q.sensitivity in ('P0','P1','P2') and q.id=(select z.id from public.question_analysis_registry z where z.lab_code=q.lab_code and z.lab_version=q.lab_version and z.semantic_field_id=q.semantic_field_id order by z.updated_at desc,z.id desc limit 1)))
 or (m.contract_id is not null and not exists(select 1 from public.question_evidence_contracts q where q.id=m.contract_id and q.contract_status='APPROVED_MEANING' and private.development_stage_level(c.stage_ceiling)<=private.development_stage_level(q.stage_ceiling))))));
$$;
revoke all on function private.development_contract_is_current(text) from public,anon,authenticated;
