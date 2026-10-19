-- The same optional assessment pack has identical criteria across Lab editions.
-- Its source hash defines comparability, while immutable original contracts,
-- task identities and edition-level access remain unchanged. Other contracts
-- retain their authored comparison key; sharing a competency is not equivalence.
create function private.development_comparison_key(target text) returns text
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.development_practice_tasks t
 where t.contract_id=c.id and t.source_hash=c.source_hash
 and t.source_hash='e3d34ca8035bc9aed19fcd68c89d9c66a7f52cad3a80311fcc74f0e4d3615081'
 and c.competency_id='AC-C03' and c.source_nature='ASSESSED_TASK')
 then c.competency_id||':practical-evidence:'||c.source_hash else c.comparison_key end
 from public.development_task_contracts c where c.id=target
$$;
revoke all on function private.development_comparison_key(text) from public,anon,authenticated;

-- Explicit RPC-only policies document the existing fail-closed grants.
create policy practice_task_rpc_only on public.development_practice_tasks for all to authenticated using(false) with check(false);
create policy practice_plan_rpc_only on public.development_practice_plans for all to authenticated using(false) with check(false);
create policy practice_attempt_rpc_only on public.development_practice_attempts for all to authenticated using(false) with check(false);
create policy practice_verification_rpc_only on public.development_practice_verifications for all to authenticated using(false) with check(false);
create index practice_task_contract on public.development_practice_tasks(contract_id);
create index practice_task_rubric on public.development_practice_tasks(rubric_id);
create index practice_task_edition on public.development_practice_tasks(lab_code,lab_version);
create index practice_plan_task on public.development_practice_plans(task_id);
create index practice_plan_enrolment on public.development_practice_plans(enrolment_id);
create index practice_plan_cohort on public.development_practice_plans(cohort_id);
create index practice_plan_evidence on public.development_practice_plans(evidence_id);

-- Transfer remains dependent on current, separately shared first-context work.
-- Revocation, source retirement, revised rubric or enrolment withdrawal must
-- remove unsupported transfer from subsequent reports without editing history.
create function private.practice_review_is_current(target text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare d public.development_reviews; a public.development_practice_attempts; p public.development_practice_plans; t public.development_practice_tasks;
begin
 select * into d from public.development_reviews where id=target;
 select pa.* into a from public.development_practice_attempts pa join public.evidence_assessments ea on ea.submission_id=pa.submission_id where ea.id=d.assessment_id;
 if a.id is null then return not exists(select 1 from public.evidence_assessments ea join public.evidence_submissions s on s.id=ea.submission_id join public.evidence_records e on e.id=any(s.evidence_ids) where ea.id=d.assessment_id and e.source_object_type in ('PRACTICE_PLAN','PRACTICE_ATTEMPT'));end if;
 select * into p from public.development_practice_plans where id=a.plan_id;
 select * into t from public.development_practice_tasks where id=p.task_id;
 if not a.opportunity or d.contract_id<>t.contract_id or d.stage<>t.stage
 or not exists(select 1 from public.development_practice_verifications v where v.assessment_id=d.assessment_id and v.attempt_id=a.id and v.independent=d.independent and v.assessor_id=d.assessor_id) then return false;end if;
 if d.stage<>'TRANSFER' then return true;end if;
 return exists(select 1 from public.development_reviews prior
 join public.evidence_assessments ea on ea.id=prior.assessment_id
 join public.evidence_submissions s on s.id=ea.submission_id
 join public.development_task_contracts c on c.id=prior.contract_id
 join public.development_practice_verifications v on v.assessment_id=ea.id
 join public.development_practice_attempts pa on pa.id=v.attempt_id
 where s.user_id=p.user_id and s.cohort_id=p.cohort_id and prior.stage in ('APPLY','TEST_AND_REVISE')
 and prior.independent and v.independent and v.basis in ('OBSERVED_SESSION','CHECKED_ARTEFACT')
 and prior.context<>p.context and private.development_comparison_key(c.id)=private.development_comparison_key(t.contract_id)
 and pa.opportunity and private.submission_is_current(s.id) and private.development_contract_is_current(c.id)
 and ea.disposition='REVIEWED' and ea.id=(select x.id from public.evidence_assessments x where x.submission_id=s.id order by x.created_at desc,x.id desc limit 1)
 and (select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids))<p.created_at
 and exists(select 1 from public.lab_enrollments le where le.user_id=s.user_id and le.lab_code=c.lab_code and le.lab_version=c.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')));
end $$;
revoke all on function private.practice_review_is_current(text) from public,anon,authenticated;

create or replace function private.current_development_reviews() returns table(
 review_id text,user_id text,cohort_id text,contract_id text,competency_id text,stage text,at timestamptz,
 comparison_key text,source_nature text,context text,independent boolean,follow_up_days integer,perception_level integer,lab_code text,reporting_allowed boolean
) language sql stable security definer set search_path='' as $$
 with current_claim as(select distinct on(s0.user_id,c.competency_id,private.development_comparison_key(c.id),md5((select string_agg(v,',' order by v) from unnest(s0.evidence_ids) v))) d.*,a.submission_id
 from public.development_reviews d join public.evidence_assessments a on a.id=d.assessment_id join public.development_task_contracts c on c.id=d.contract_id join public.evidence_submissions s0 on s0.id=a.submission_id
 where a.disposition='REVIEWED' and a.id=(select x.id from public.evidence_assessments x where x.submission_id=a.submission_id order by x.created_at desc,x.id desc limit 1)
 order by s0.user_id,c.competency_id,private.development_comparison_key(c.id),md5((select string_agg(v,',' order by v) from unnest(s0.evidence_ids) v)),d.created_at desc,d.id desc)
 select d.id,s.user_id,s.cohort_id,c.id,c.competency_id,d.stage,(select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids)),private.development_comparison_key(c.id),c.source_nature,d.context,d.independent,c.follow_up_days,
 (select case when e.value~'^[0-5]$' then e.value::integer else null end from public.evidence_records e where e.id=any(s.evidence_ids) and e.semantic_field_id=c.perception_field and e.sensitivity in ('P0','P1','P2') limit 1),c.lab_code,coalesce(p.allowed,false)
 from current_claim d join public.evidence_submissions s on s.id=d.submission_id join public.development_task_contracts c on c.id=d.contract_id
 left join public.development_reporting_permissions p on p.submission_id=s.id
 where private.submission_is_current(s.id) and private.development_contract_is_current(c.id) and private.practice_review_is_current(d.id)
 and exists(select 1 from public.lab_enrollments le where le.user_id=s.user_id and le.lab_code=c.lab_code and le.lab_version=c.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED'))
 and cardinality(c.mapping_ids)=(select count(*) from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.classification_status='APPROVED')
 and not exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and (m.classification_status<>'APPROVED' or m.id is distinct from(select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)))
 and not exists(select 1 from public.curriculum_evidence_mappings m join public.question_evidence_contracts q on q.id=m.contract_id where m.id=any(c.mapping_ids) and (q.contract_status<>'APPROVED_MEANING' or private.development_stage_level(d.stage)>private.development_stage_level(q.stage_ceiling)))
 and not exists(select 1 from public.curriculum_evidence_mappings m join public.question_analysis_registry q on q.id=m.registry_id where m.id=any(c.mapping_ids) and q.status='RETIRED')
$$;

-- This supplement assesses real practical use; scenario reasoning remains a
-- separate evidence purpose and never shares its comparison family.
create or replace function private.plan_practice(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); t public.development_practice_tasks; c public.pilot_cohorts; old public.development_practice_plans;
 result text=gen_random_uuid()::text; eid text=gen_random_uuid()::text; enrolment text; stamp timestamptz=clock_timestamp();
begin
 if not coalesce(private.practice_scope(p->>'cohortId',owner_id),false) then raise insufficient_privilege using message='Choose your current programme group and consent first.';end if;
 perform 1 from public.learners where user_id=owner_id for update;
 select * into t from public.development_practice_tasks where id=p->>'taskId';
 select * into c from public.pilot_cohorts where id=p->>'cohortId';
 if t.id is null or t.lab_code<>c.lab_code or t.lab_version<>c.lab_version or not private.development_contract_is_current(t.contract_id)
 or p->>'context' is null or p->>'context' not in ('SCHOOL','HOME','WORK','COMMUNITY','OTHER')
 or p->>'basis' is null or p->>'basis'<>'REAL_WORLD'
 or (t.stage='TRANSFER' and p->>'basis'<>'REAL_WORLD')
 or length(btrim(coalesce(p->>'prediction',''))) not between 1 and 4000
 or length(coalesce(p->>'requestKey','')) not between 1 and 100 then raise exception 'Choose a current task, context and dated plan.';end if;
 select * into old from public.development_practice_plans where user_id=owner_id and request_key=p->>'requestKey';
 if old.id is not null then
  if old.task_id<>t.id or old.cohort_id<>c.id or old.context<>p->>'context' or old.basis<>p->>'basis' or old.prediction<>btrim(p->>'prediction') then raise exception 'Retry content changed.';end if;
  return jsonb_build_object('id',old.id,'createdAt',old.created_at);
 end if;
 select id into enrolment from public.lab_enrollments where user_id=owner_id and lab_code=t.lab_code and lab_version=t.lab_version and status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED') order by started_at desc,id desc limit 1;
 insert into public.evidence_records(id,user_id,lab_code,lab_version,enrolment_id,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,status,sensitivity,occurred_at,recorded_at)
 values(eid,owner_id,t.lab_code,t.lab_version,enrolment,t.lab_code||'.PRACTICE.V1',t.lab_code||'.PRACTICE.V1.'||t.stage||'.PREDICTION','PRACTICE_PLAN',result,'LR','TEXT',btrim(p->>'prediction'),'ACTIVE','P2',stamp,stamp);
 insert into public.development_practice_plans(id,user_id,cohort_id,task_id,enrolment_id,context,basis,prediction,evidence_id,request_key,created_at)
 values(result,owner_id,c.id,t.id,enrolment,p->>'context',p->>'basis',btrim(p->>'prediction'),eid,p->>'requestKey',stamp);
 return jsonb_build_object('id',result,'createdAt',stamp);
end $$;
create or replace function private.guard_practice_review() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.development_practice_attempts; p public.development_practice_plans; t public.development_practice_tasks; v public.development_practice_verifications; review public.evidence_assessments;
begin
 select * into review from public.evidence_assessments where id=new.assessment_id;
 select * into a from public.development_practice_attempts where submission_id=review.submission_id;
 if a.id is null then
  if exists(select 1 from public.evidence_submissions s join public.evidence_records e on e.id=any(s.evidence_ids) where s.id=review.submission_id and e.source_object_type in ('PRACTICE_PLAN','PRACTICE_ATTEMPT')) then raise exception 'Use the complete matching practice submission.';end if;
  return new;
 end if;
 select * into p from public.development_practice_plans where id=a.plan_id;
 select * into t from public.development_practice_tasks where id=p.task_id;
 select * into v from public.development_practice_verifications where assessment_id=new.assessment_id;
 if v.assessment_id is null or v.attempt_id<>a.id or v.assessor_id<>new.assessor_id or not a.opportunity
 or new.context<>p.context or new.stage<>t.stage or new.contract_id<>t.contract_id or review.rubric_version_id is distinct from t.rubric_id
 or new.independent is distinct from v.independent
 or (p.basis='SIMULATION' and (v.basis<>'SIMULATION' or new.independent or new.stage='TRANSFER'))
 or (p.basis='REAL_WORLD' and v.basis='SIMULATION')
 or (new.stage='TRANSFER' and not new.independent)
 or exists(select 1 from public.assessment_rubric_versions r cross join lateral jsonb_array_elements(r.criteria) k where r.id=t.rubric_id and not exists(select 1 from jsonb_array_elements(review.criterion_scores) s where s->>'criterionId'=k->>'id' and s->>'score'='1' and new.criteria->(k->>'id')='true'::jsonb))
 then raise exception 'A practical stage requires checked work, matching criteria, a real opportunity and the correct evidence basis.';end if;
 if new.stage='TRANSFER' and not exists(select 1 from private.current_development_reviews() r
 join public.development_practice_verifications pv on pv.assessment_id=(select dr.assessment_id from public.development_reviews dr where dr.id=r.review_id)
 where r.user_id=p.user_id and r.cohort_id=p.cohort_id and r.comparison_key=private.development_comparison_key(t.contract_id)
 and r.stage in ('APPLY','TEST_AND_REVISE') and r.independent and pv.basis in ('OBSERVED_SESSION','CHECKED_ARTEFACT') and r.context<>p.context and r.at<p.created_at and private.development_stage_level(r.stage)>=3)
 then raise exception 'Review an independent application in another context before planning this transfer task.';end if;
 return new;
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
 if p->>'stage'='TRANSFER' and coalesce((p->>'independent')::boolean,false)=false then raise exception 'Transfer requires evidence of independent application.';end if;
 if p->>'stage'='TRANSFER' and not exists(select 1 from private.current_development_reviews() r join public.development_reviews d on d.id=r.review_id join public.evidence_assessments aa on aa.id=d.assessment_id join public.evidence_submissions ss on ss.id=aa.submission_id where r.user_id=s.user_id and r.cohort_id=s.cohort_id and r.competency_id=c.competency_id and r.comparison_key=private.development_comparison_key(c.id) and r.source_nature=c.source_nature and r.at<(select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids)) and r.context<>p->>'context' and not(ss.evidence_ids && s.evidence_ids) and private.development_stage_level(r.stage)>=3) then raise exception 'Transfer requires an earlier reviewed application in a different recorded context.';end if;
 select * into prior from public.development_reviews where assessor_id=coalesce(private.current_app_user_id(),auth.uid()::text) and request_key=p->>'requestKey';
 if prior.id is not null then
  if prior.assessment_id<>a.id or prior.contract_id<>c.id or prior.stage<>p->>'stage' or prior.criteria<>p->'criteria' or prior.context<>p->>'context' or prior.independent is distinct from coalesce((p->>'independent')::boolean,false) then raise exception 'Retry content changed.';end if;return prior.id;
 end if;
 insert into public.development_reviews(assessment_id,contract_id,stage,criteria,context,independent,assessor_id,request_key) values(a.id,c.id,p->>'stage',p->'criteria',p->>'context',coalesce((p->>'independent')::boolean,false),coalesce(private.current_app_user_id(),auth.uid()::text),p->>'requestKey') returning id into result;
 return result;
end $$;

-- Extend the existing guarded reports; do not create achievements or permissions.
create or replace function private.development_learner_report(p_learner text,p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in is required.';end if;
 if p_learner is distinct from private.current_app_user_id() and (p_cohort is null or not private.has_staff_role('FACILITATOR') or not exists(select 1 from public.pilot_cohorts pc join public.cohort_members m on m.cohort_id=pc.id where pc.id=p_cohort and pc.status='ACTIVE' and lower(pc.facilitator_email)=private.current_email() and m.learner_user_id=p_learner and m.status='ACTIVE')) then raise insufficient_privilege using message='This learner is not assigned to you.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.review_id,'competencyId',r.competency_id,'stage',r.stage,'at',r.at,'comparisonKey',r.comparison_key,'authorityId',r.contract_id,'reviewStatus','REVIEWED','sourceNature',r.source_nature,'labCode',r.lab_code,'context',r.context,'independent',r.independent,'followUpDays',r.follow_up_days,'perceptionLevel',r.perception_level,
 'taskTitle',c.title,'evidencePhase',case when not exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.evidence_class<>'BASELINE') then 'BASELINE' else 'DEVELOPMENT' end,
 'practiceOptions',(select coalesce(jsonb_agg(jsonb_build_object('title',n.title,'labCode',n.lab_code,'ceiling',n.stage_ceiling,'comparisonKey',private.development_comparison_key(n.id)) order by n.title),'[]'::jsonb) from public.development_task_contracts n where n.competency_id=r.competency_id and private.development_comparison_key(n.id)=r.comparison_key and private.development_contract_is_current(n.id) and private.development_stage_level(n.stage_ceiling)>private.development_stage_level(r.stage)
 and exists(select 1 from public.lab_enrollments le where le.user_id=p_learner and le.lab_code=n.lab_code and le.lab_version=n.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED'))
 and (p_learner=private.current_app_user_id() or exists(select 1 from public.pilot_cohorts pc where pc.id=p_cohort and pc.lab_code=n.lab_code and pc.lab_version=n.lab_version)))) order by r.at,r.review_id),'[]'::jsonb) into result
 from private.current_development_reviews() r join public.development_task_contracts c on c.id=r.contract_id where r.user_id=p_learner and (p_learner=private.current_app_user_id() or r.cohort_id=p_cohort);
 return result;
end $$;

