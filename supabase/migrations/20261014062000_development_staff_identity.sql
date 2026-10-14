-- Staff without learner profiles use their authenticated actor ID. NULL learner identity never grants individual access.
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
 if p->>'perceptionField' is not null and not exists(select 1 from public.question_analysis_registry q where q.lab_code=p->>'labCode' and q.lab_version=p->>'labVersion' and q.semantic_field_id=p->>'perceptionField' and q.answer_model='INTEGER' and q.sensitivity in ('P0','P1','P2')) then raise exception 'A perception comparison needs its source-approved integer field on the same 0–5 stage scale.';end if;
 insert into public.development_task_contracts(lab_code,lab_version,competency_id,mapping_ids,semantic_field_ids,title,source_reference,source_hash,stage_ceiling,comparison_key,source_nature,follow_up_days,perception_field,created_by)
 values(p->>'labCode',p->>'labVersion',p->>'competencyId',mapping_ids,field_ids,p->>'title',p->>'source',p->>'sourceHash',p->>'ceiling',p->>'comparisonKey',p->>'sourceNature',nullif(p->>'followUpDays','')::integer,p->>'perceptionField',coalesce(private.current_app_user_id(),auth.uid()::text)) returning id into result;
 return result;
end $$;

create or replace function private.record_development_review(p jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare a public.evidence_assessments; s public.evidence_submissions; c public.development_task_contracts;
 prior public.development_reviews; result text; required text[]; key text; selected_classes text[];
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in is required.';end if;
 select * into a from public.evidence_assessments where id=p->>'assessmentId';
 select * into s from public.evidence_submissions where id=a.submission_id for update;
 if s.id is null or not private.can_review_submission(s.id) then raise insufficient_privilege using message='This evidence is not currently shared for your review.';end if;
 if a.disposition<>'REVIEWED' or a.id is distinct from (select x.id from public.evidence_assessments x where x.submission_id=s.id order by x.created_at desc,x.id desc limit 1) then raise exception 'Record a current human review first.';end if;
 select * into c from public.development_task_contracts where id=p->>'contractId';
 if c.id is null or not private.development_contract_is_current(c.id) or not exists(select 1 from public.pilot_cohorts pc where pc.id=s.cohort_id and pc.lab_code=c.lab_code and pc.lab_version=c.lab_version)
 or not exists(select 1 from public.lab_enrollments le where le.user_id=s.user_id and le.lab_code=c.lab_code and le.lab_version=c.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED'))
 or exists(select 1 from public.evidence_records e where e.id=any(s.evidence_ids) and (not(e.semantic_field_id=any(c.semantic_field_ids)) or e.lab_code<>c.lab_code or e.lab_version<>c.lab_version))
 then raise exception 'The approved task contract must match every selected evidence anchor and current enrolment.';end if;
 if cardinality(c.mapping_ids)<>(select count(*) from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.classification_status='APPROVED') or exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.id is distinct from (select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)) then raise exception 'The task source has changed; approve a new contract.';end if;
 if c.source_nature='ASSESSED_TASK' and a.rubric_version_id is null then raise exception 'An assessed task claim requires its authored rubric review.';end if;
 if private.development_stage_level(p->>'stage')=0 or private.development_stage_level(p->>'stage')>private.development_stage_level(c.stage_ceiling)
 or p->>'context' not in ('SCHOOL','HOME','WORK','COMMUNITY','OTHER') or jsonb_typeof(p->'criteria') is distinct from 'object'
 or length(coalesce(p->>'requestKey','')) not between 1 and 100 then raise exception 'Complete the source-bounded development review.';end if;
 select array_agg(distinct m.evidence_class) into selected_classes from public.curriculum_evidence_mappings m join public.evidence_records e on e.semantic_field_id=m.semantic_field_id and e.id=any(s.evidence_ids) where m.id=any(c.mapping_ids);
 if (p->>'stage'='NOTICE' and not(selected_classes && array['BASELINE','CONTEXT','LEARNING_CHECK','OBSERVATION']))
 or (p->>'stage'='EXPLAIN' and not(selected_classes && array['LEARNING_CHECK','INTERPRETATION']))
 or (p->>'stage'='APPLY' and not(selected_classes && array['OBSERVATION','OUTCOME']))
 or (p->>'stage'='TEST_AND_REVISE' and not(selected_classes @> array['PREDICTION','OBSERVATION','INTERPRETATION']))
 or (p->>'stage'='TRANSFER' and not('TRANSFER'=any(selected_classes))) then raise exception 'The selected evidence does not include the source classes required for this stage.';end if;
 required=case p->>'stage' when 'NOTICE' then array['recognises'] when 'EXPLAIN' then array['explains'] when 'APPLY' then array['applies'] when 'TEST_AND_REVISE' then array['predicts','observes','interprets','revises'] when 'TRANSFER' then array['applies','adapts','differentContext'] end;
 foreach key in array required loop if p->'criteria'->key is distinct from 'true'::jsonb then raise exception 'Verify every authored stage criterion against the shared evidence.';end if;end loop;
 if p->>'stage'='TRANSFER' and not exists(select 1 from private.current_development_reviews() r join public.development_reviews d on d.id=r.review_id join public.evidence_assessments aa on aa.id=d.assessment_id join public.evidence_submissions ss on ss.id=aa.submission_id where r.user_id=s.user_id and r.competency_id=c.competency_id and r.comparison_key=c.comparison_key and r.at<(select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids)) and r.context<>p->>'context' and not(ss.evidence_ids && s.evidence_ids) and private.development_stage_level(r.stage)>=3) then raise exception 'Transfer requires an earlier reviewed application in a different recorded context.';end if;
 select * into prior from public.development_reviews where assessor_id=coalesce(private.current_app_user_id(),auth.uid()::text) and request_key=p->>'requestKey';
 if prior.id is not null then
  if prior.assessment_id<>a.id or prior.contract_id<>c.id or prior.stage<>p->>'stage' or prior.criteria<>p->'criteria' or prior.context<>p->>'context' or prior.independent is distinct from coalesce((p->>'independent')::boolean,false) then raise exception 'Retry content changed.';end if;return prior.id;
 end if;
 insert into public.development_reviews(assessment_id,contract_id,stage,criteria,context,independent,assessor_id,request_key) values(a.id,c.id,p->>'stage',p->'criteria',p->>'context',coalesce((p->>'independent')::boolean,false),coalesce(private.current_app_user_id(),auth.uid()::text),p->>'requestKey') returning id into result;
 return result;
end $$;

create or replace function private.development_learner_report(p_learner text,p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in is required.';end if;
 if p_learner is distinct from private.current_app_user_id() and (p_cohort is null or not private.has_staff_role('FACILITATOR') or not exists(select 1 from public.pilot_cohorts pc join public.cohort_members m on m.cohort_id=pc.id where pc.id=p_cohort and pc.status='ACTIVE' and lower(pc.facilitator_email)=private.current_email() and m.learner_user_id=p_learner and m.status='ACTIVE')) then raise insufficient_privilege using message='This learner is not assigned to you.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.review_id,'competencyId',r.competency_id,'stage',r.stage,'at',r.at,'comparisonKey',r.comparison_key,'authorityId',r.contract_id,'reviewStatus','REVIEWED','sourceNature',r.source_nature,'labCode',r.lab_code,'context',r.context,'independent',r.independent,'followUpDays',r.follow_up_days,'perceptionLevel',r.perception_level) order by r.at,r.review_id),'[]'::jsonb) into result from private.current_development_reviews() r where r.user_id=p_learner and (p_learner=private.current_app_user_id() or r.cohort_id=p_cohort);
 return result;
end $$;
