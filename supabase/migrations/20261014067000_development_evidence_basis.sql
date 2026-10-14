-- A rubric cannot turn a source-defined self-report into observed or assessed task evidence.
create or replace function private.publish_development_contract(p jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare result text; field_ids text[]; classes text[]; mapping_ids text[]; max_stage integer;
begin
 if auth.uid() is null or not private.has_staff_role('SYSTEM_ADMIN') then raise insufficient_privilege using message='Source approval access is required.';end if;
 if jsonb_typeof(p->'mappingIds')<>'array' or jsonb_array_length(p->'mappingIds') not between 1 and 50
  or length(btrim(coalesce(p->>'title',''))) not between 1 and 300
  or length(btrim(coalesce(p->>'source',''))) not between 1 and 2000
  or (p->>'sourceHash')!~'^[a-f0-9]{64}$' or (p->>'competencyId')!~'^AC-C[0-9]{2}$'
  or length(coalesce(p->>'comparisonKey','')) not between 1 and 150
  or p->>'sourceNature' not in ('SELF_REPORT','ASSESSED_TASK')
  or private.development_stage_level(p->>'ceiling')=0
  then raise exception 'Complete the source-backed assessment contract.';end if;
 select array_agg(value) into mapping_ids from jsonb_array_elements_text(p->'mappingIds');
 if cardinality(mapping_ids)<>(select count(distinct x) from unnest(mapping_ids) x) then raise exception 'Choose each field once.';end if;
 select array_agg(m.semantic_field_id),array_agg(distinct m.evidence_class) into field_ids,classes
 from public.curriculum_evidence_mappings m
 where m.id=any(mapping_ids) and m.lab_code=p->>'labCode' and m.lab_version=p->>'labVersion'
 and m.competency=p->>'competencyId' and m.classification_status='APPROVED'
 and m.id=(select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1);
 if cardinality(field_ids) is distinct from cardinality(mapping_ids) then raise exception 'Choose current approved fields for one competency and exact curriculum version.';end if;
 max_stage=case when 'TRANSFER'=any(classes) then 5
 when classes @> array['PREDICTION','OBSERVATION','INTERPRETATION'] then 4
 when 'OBSERVATION'=any(classes) or 'OUTCOME'=any(classes) then 3
 when 'LEARNING_CHECK'=any(classes) or 'INTERPRETATION'=any(classes) then 2
 when 'BASELINE'=any(classes) or 'CONTEXT'=any(classes) then 1 else 0 end;
 if private.development_stage_level(p->>'ceiling')>max_stage then raise exception 'The selected source evidence classes cannot support this ceiling.';end if;
 if exists(select 1 from public.curriculum_evidence_mappings m join public.question_evidence_contracts q on q.id=m.contract_id where m.id=any(mapping_ids) and (q.contract_status<>'APPROVED_MEANING' or private.development_stage_level(p->>'ceiling')>private.development_stage_level(q.stage_ceiling))) then raise exception 'The question source contract does not authorise this ceiling.';end if;
 if p->>'sourceNature'='ASSESSED_TASK' and exists(select 1 from public.curriculum_evidence_mappings m join public.question_evidence_contracts q on q.id=m.contract_id where m.id=any(mapping_ids) and q.source_nature not in ('OBSERVED','ASSESSED')) then raise exception 'Self-reported or mixed source evidence must remain self-report, even with a rubric.';end if;
 if p->>'perceptionField' is not null and not exists(select 1 from public.question_analysis_registry q where q.lab_code=p->>'labCode' and q.lab_version=p->>'labVersion' and q.semantic_field_id=p->>'perceptionField' and q.answer_model='INTEGER' and q.sensitivity in ('P0','P1','P2')) then raise exception 'A perception comparison needs its source-approved integer field on the same 0–5 stage scale.';end if;
 insert into public.development_task_contracts(lab_code,lab_version,competency_id,mapping_ids,semantic_field_ids,title,source_reference,source_hash,stage_ceiling,comparison_key,source_nature,follow_up_days,perception_field,created_by)
 values(p->>'labCode',p->>'labVersion',p->>'competencyId',mapping_ids,field_ids,p->>'title',p->>'source',p->>'sourceHash',p->>'ceiling',p->>'comparisonKey',p->>'sourceNature',nullif(p->>'followUpDays','')::integer,p->>'perceptionField',coalesce(private.current_app_user_id(),auth.uid()::text)) returning id into result;
 return result;
end $$;

-- Current source privacy remains authoritative after assessment approval.
-- Keep approved assessment contracts current at publication, review and reporting.
create or replace function private.development_contract_is_current(target text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.development_task_contracts c where c.id=target
 and cardinality(c.mapping_ids)=(select count(*) from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.classification_status='APPROVED')
 and not exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and (m.id is distinct from(select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)
 or (m.registry_id is not null and not exists(select 1 from public.question_analysis_registry q where q.id=m.registry_id and q.status<>'RETIRED' and q.sensitivity in ('P0','P1','P2') and q.id=(select z.id from public.question_analysis_registry z where z.lab_code=q.lab_code and z.lab_version=q.lab_version and z.semantic_field_id=q.semantic_field_id order by z.updated_at desc,z.id desc limit 1)))
 or (m.contract_id is not null and not exists(select 1 from public.question_evidence_contracts q where q.id=m.contract_id and q.contract_status='APPROVED_MEANING' and (c.source_nature<>'ASSESSED_TASK' or q.source_nature in ('OBSERVED','ASSESSED')) and private.development_stage_level(c.stage_ceiling)<=private.development_stage_level(q.stage_ceiling))))));
$$;
revoke all on function private.development_contract_is_current(text) from public,anon,authenticated;
