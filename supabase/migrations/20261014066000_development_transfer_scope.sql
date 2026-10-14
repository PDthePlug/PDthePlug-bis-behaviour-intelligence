-- A facilitator cannot use another cohort's shared history to assert transfer.
-- Independent second-context use and follow-up from application, never from initial understanding.
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
 if p->>'stage'='TRANSFER' and coalesce((p->>'independent')::boolean,false)=false then raise exception 'Transfer requires evidence of independent application.';end if;
 if p->>'stage'='TRANSFER' and not exists(select 1 from private.current_development_reviews() r join public.development_reviews d on d.id=r.review_id join public.evidence_assessments aa on aa.id=d.assessment_id join public.evidence_submissions ss on ss.id=aa.submission_id where r.user_id=s.user_id and r.cohort_id=s.cohort_id and r.competency_id=c.competency_id and r.comparison_key=c.comparison_key and r.at<(select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids)) and r.context<>p->>'context' and not(ss.evidence_ids && s.evidence_ids) and private.development_stage_level(r.stage)>=3) then raise exception 'Transfer requires an earlier reviewed application in a different recorded context.';end if;
 select * into prior from public.development_reviews where assessor_id=coalesce(private.current_app_user_id(),auth.uid()::text) and request_key=p->>'requestKey';
 if prior.id is not null then
  if prior.assessment_id<>a.id or prior.contract_id<>c.id or prior.stage<>p->>'stage' or prior.criteria<>p->'criteria' or prior.context<>p->>'context' or prior.independent is distinct from coalesce((p->>'independent')::boolean,false) then raise exception 'Retry content changed.';end if;return prior.id;
 end if;
 insert into public.development_reviews(assessment_id,contract_id,stage,criteria,context,independent,assessor_id,request_key) values(a.id,c.id,p->>'stage',p->'criteria',p->>'context',coalesce((p->>'independent')::boolean,false),coalesce(private.current_app_user_id(),auth.uid()::text),p->>'requestKey') returning id into result;
 return result;
end $$;

