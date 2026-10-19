-- Programme plans already support several exact Lab editions. Reporting and
-- optional practice use that explicit plan; no title/code-only widening and no
-- access to another group. Missing legacy plans retain the original edition.
create function private.cohort_has_edition(target text,lab text,edition text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pilot_cohorts c where c.id=target and
 case when jsonb_array_length(c.lab_plan)>0 then
 exists(select 1 from jsonb_array_elements(c.lab_plan) p where p->>'code'=lab and p->>'version'=edition)
 else c.lab_code=lab and c.lab_version=edition end)
$$;
revoke all on function private.cohort_has_edition(text,text,text) from public,anon,authenticated;

create or replace function private.practice_scope(p_cohort text,p_user text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and p_user=private.current_app_user_id() and exists(
 select 1 from public.pilot_cohorts c join public.cohort_members m on m.cohort_id=c.id
 join public.learners l on l.user_id=m.learner_user_id
 join public.lab_enrollments e on e.user_id=l.user_id and private.cohort_has_edition(c.id,e.lab_code,e.lab_version)
 where c.id=p_cohort and c.status='ACTIVE' and m.status='ACTIVE' and l.status='ACTIVE'
 and l.user_id=p_user and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
 and (select r.status from public.consent_records r where r.user_id=p_user and r.consent_type='LEARNER_PRODUCT' order by r.created_at desc,r.id desc limit 1)='GRANTED');
$$;
create or replace function private.practice_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); tasks jsonb; plans jsonb;
begin
 if auth.uid() is null or owner_id is null then raise insufficient_privilege using message='Sign in is required.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'cohortId',c.id,'cohortName',c.name,'labCode',t.lab_code,'labVersion',t.lab_version,'stage',t.stage,'title',t.title,'instruction',t.instruction) order by c.name,t.stage),'[]'::jsonb)
 into tasks from public.development_practice_tasks t join public.pilot_cohorts c on private.cohort_has_edition(c.id,t.lab_code,t.lab_version)
 where exists(select 1 from public.lab_enrollments e where e.user_id=owner_id and e.lab_code=t.lab_code and e.lab_version=t.lab_version and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')) and private.practice_scope(c.id,owner_id) and private.development_contract_is_current(t.contract_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'taskId',p.task_id,'cohortId',p.cohort_id,'context',p.context,'basis',p.basis,'prediction',p.prediction,'createdAt',p.created_at,'submitted',a.id is not null,'submissionId',a.submission_id) order by p.created_at desc),'[]'::jsonb)
 into plans from public.development_practice_plans p join public.development_practice_tasks t on t.id=p.task_id left join public.development_practice_attempts a on a.plan_id=p.id
 where p.user_id=owner_id and private.practice_scope(p.cohort_id,owner_id) and private.development_contract_is_current(t.contract_id);
 return jsonb_build_object('tasks',tasks,'plans',plans);
end $$;
create or replace function private.plan_practice(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); t public.development_practice_tasks; c public.pilot_cohorts; old public.development_practice_plans;
 result text=gen_random_uuid()::text; eid text=gen_random_uuid()::text; enrolment text; stamp timestamptz=clock_timestamp();
begin
 if not coalesce(private.practice_scope(p->>'cohortId',owner_id),false) then raise insufficient_privilege using message='Choose your current programme group and consent first.';end if;
 perform 1 from public.learners where user_id=owner_id for update;
 select * into t from public.development_practice_tasks where id=p->>'taskId';
 select * into c from public.pilot_cohorts where id=p->>'cohortId';
 if t.id is null or not private.cohort_has_edition(c.id,t.lab_code,t.lab_version) or not private.development_contract_is_current(t.contract_id)
 or not exists(select 1 from public.lab_enrollments e where e.user_id=owner_id and e.lab_code=t.lab_code and e.lab_version=t.lab_version and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED'))
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
create or replace function private.submit_practice(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); plan public.development_practice_plans; t public.development_practice_tasks; old public.development_practice_attempts;
 result text=gen_random_uuid()::text; obs text=gen_random_uuid()::text; explanation text=gen_random_uuid()::text; submission text; stamp timestamptz=clock_timestamp();
begin
 select * into plan from public.development_practice_plans where id=p->>'planId' for update;
 if plan.id is null or plan.user_id is distinct from owner_id or not coalesce(private.practice_scope(plan.cohort_id,owner_id),false) then raise insufficient_privilege using message='This practice plan is not available to you.';end if;
 select * into t from public.development_practice_tasks where id=plan.task_id;
 if not private.cohort_has_edition(plan.cohort_id,t.lab_code,t.lab_version) or not exists(select 1 from public.lab_enrollments e where e.id=plan.enrolment_id and e.user_id=owner_id and e.lab_code=t.lab_code and e.lab_version=t.lab_version and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')) or not private.development_contract_is_current(t.contract_id) or p->'share' is distinct from 'true'::jsonb
 or jsonb_typeof(p->'opportunity') is distinct from 'boolean'
 or length(btrim(coalesce(p->>'observation',''))) not between 1 and 6000
 or length(btrim(coalesce(p->>'interpretation',''))) not between 1 and 4000
 then raise exception 'Record the work and confirm that you choose to share it for review.';end if;
 select * into old from public.development_practice_attempts where plan_id=plan.id;
 if old.id is not null then
  if old.observation<>btrim(p->>'observation') or old.interpretation<>btrim(p->>'interpretation') or old.opportunity is distinct from (p->>'opportunity')::boolean then raise exception 'Submitted work is retained. Start another dated plan for a new attempt.';end if;
  if not private.submission_is_current(old.submission_id) then raise exception 'This earlier submission is no longer shared.';end if;
  return jsonb_build_object('submissionId',old.submission_id);
 end if;
 if not exists(select 1 from public.evidence_records where id=plan.evidence_id and user_id=owner_id and status='ACTIVE' and occurred_at<stamp) then raise exception 'Save a current prediction before recording the result.';end if;
 insert into public.evidence_records(id,user_id,lab_code,lab_version,enrolment_id,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,status,sensitivity,occurred_at,recorded_at)
 values(obs,owner_id,t.lab_code,t.lab_version,plan.enrolment_id,t.lab_code||'.PRACTICE.V1',t.lab_code||'.PRACTICE.V1.'||t.stage||'.OBSERVATION','PRACTICE_ATTEMPT',result,'LR','TEXT',btrim(p->>'observation'),'ACTIVE','P2',stamp,stamp),
 (explanation,owner_id,t.lab_code,t.lab_version,plan.enrolment_id,t.lab_code||'.PRACTICE.V1',t.lab_code||'.PRACTICE.V1.'||t.stage||'.INTERPRETATION','PRACTICE_ATTEMPT',result,'LR','TEXT',btrim(p->>'interpretation'),'ACTIVE','P2',stamp,stamp);
 submission=private.bis_share_evidence(plan.cohort_id,array[plan.evidence_id,obs,explanation],t.title,'practice:'||plan.id);
 insert into public.development_practice_attempts(id,plan_id,observation,interpretation,opportunity,submission_id,created_at)
 values(result,plan.id,btrim(p->>'observation'),btrim(p->>'interpretation'),(p->>'opportunity')::boolean,submission,stamp);
 return jsonb_build_object('submissionId',submission);
end $$;
create or replace function private.submission_is_current(target text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evidence_submissions s
 join public.pilot_cohorts c on c.id=s.cohort_id
 join public.learners l on l.user_id=s.user_id
 join public.cohort_members m on m.cohort_id=c.id and m.learner_user_id=s.user_id
 where s.id=target and s.revoked_at is null and c.status='ACTIVE' and m.status='ACTIVE' and l.status='ACTIVE'
 and (select status from public.consent_records where user_id=s.user_id and consent_type='LEARNER_PRODUCT' order by created_at desc,id desc limit 1)='GRANTED'
 and cardinality(s.evidence_ids)=(select count(*) from public.evidence_records e
   where e.id=any(s.evidence_ids) and e.user_id=s.user_id and private.cohort_has_edition(c.id,e.lab_code,e.lab_version)
   and (e.source_object_type not in ('PRACTICE_PLAN','PRACTICE_ATTEMPT') or exists(select 1 from public.lab_enrollments le where le.id=e.enrolment_id and le.user_id=s.user_id and le.lab_code=e.lab_code and le.lab_version=e.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')))
   and e.status='ACTIVE' and e.sensitivity in ('P0','P1','P2') and e.value is not null))
$$;
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
 if c.id is null or not private.development_contract_is_current(c.id) or not exists(select 1 from public.pilot_cohorts pc where pc.id=s.cohort_id and private.cohort_has_edition(pc.id,c.lab_code,c.lab_version))
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
 and (p_learner=private.current_app_user_id() or exists(select 1 from public.pilot_cohorts pc where pc.id=p_cohort and private.cohort_has_edition(pc.id,n.lab_code,n.lab_version))))) order by r.at,r.review_id),'[]'::jsonb) into result
 from private.current_development_reviews() r join public.development_task_contracts c on c.id=r.contract_id where r.user_id=p_learner and (p_learner=private.current_app_user_id() or r.cohort_id=p_cohort);
 return result;
end $$;
create or replace function private.development_contract_workspace(p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare contracts jsonb; coverage jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in is required.';end if;
 if not private.has_staff_role('SYSTEM_ADMIN') and (p_cohort is null or not private.has_staff_role('FACILITATOR') or not exists(select 1 from public.pilot_cohorts c where c.id=p_cohort and c.status='ACTIVE' and lower(c.facilitator_email)=private.current_email())) then raise insufficient_privilege using message='Source or facilitator access is required.';end if;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into contracts from public.development_task_contracts c where private.development_contract_is_current(c.id) and (p_cohort is null or exists(select 1 from public.pilot_cohorts pc where pc.id=p_cohort and private.cohort_has_edition(pc.id,c.lab_code,c.lab_version)));
 with registry as(select distinct on(q.lab_code,q.lab_version,q.semantic_field_id) q.* from public.question_analysis_registry q where p_cohort is null or exists(select 1 from public.pilot_cohorts c where c.id=p_cohort and private.cohort_has_edition(c.id,q.lab_code,q.lab_version)) order by q.lab_code,q.lab_version,q.semantic_field_id,q.updated_at desc,q.id desc),
 versions as(select lab_code,lab_version,count(*) filter(where status<>'RETIRED') as registered_fields from registry group by lab_code,lab_version)
 select coalesce(jsonb_agg(jsonb_build_object('labCode',v.lab_code,'labVersion',v.lab_version,'registeredFields',v.registered_fields,
 'approvedFields',(select count(distinct m.semantic_field_id) from public.curriculum_evidence_mappings m join registry r on r.id=m.registry_id where m.lab_code=v.lab_code and m.lab_version=v.lab_version and m.classification_status='APPROVED' and r.status<>'RETIRED' and m.id=(select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)),
 'baselineContracts',(select count(*) from public.development_task_contracts c where c.lab_code=v.lab_code and c.lab_version=v.lab_version and private.development_contract_is_current(c.id) and not exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.evidence_class<>'BASELINE')),
 'applicationContracts',(select count(*) from public.development_task_contracts c where c.lab_code=v.lab_code and c.lab_version=v.lab_version and private.development_contract_is_current(c.id) and c.source_nature='ASSESSED_TASK' and private.development_stage_level(c.stage_ceiling)>=3),
 'transferContracts',(select count(*) from public.development_task_contracts c where c.lab_code=v.lab_code and c.lab_version=v.lab_version and private.development_contract_is_current(c.id) and c.source_nature='ASSESSED_TASK' and c.stage_ceiling='TRANSFER')) order by v.lab_code,v.lab_version),'[]'::jsonb) into coverage from versions v;
 return jsonb_build_object('contracts',contracts,'coverage',coverage,'boundary','Source coverage is not validation, learner attainment or evidence of programme effectiveness.');
end $$;
-- Preserve practice provenance in the shared-work queue so its checked
-- performance step remains reachable after the initial rubric review.
create or replace function private.bis_assessment_workspace(p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id text=coalesce(private.current_app_user_id(),auth.uid()::text); groups jsonb; submissions jsonb; rubrics jsonb;
begin
 if auth.uid() is null or owner_id is null then raise exception 'Sign in is required.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'lab_code',c.lab_code,'lab_version',c.lab_version)),'[]'::jsonb) into groups
 from public.pilot_cohorts c where c.status='ACTIVE' and exists(select 1 from public.cohort_members m where m.cohort_id=c.id and m.learner_user_id=owner_id and m.status='ACTIVE');
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rubrics from public.assessment_rubric_versions r;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into submissions from (
 select s.*,l.display_name,private.submission_is_current(s.id) as current,
 coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'lab_code',e.lab_code,'lab_version',e.lab_version,'source_object_type',e.source_object_type,'source_object_id',e.source_object_id,'provenance',e.provenance,'sensitivity',e.sensitivity,'semantic_field_id',e.semantic_field_id,'value',e.value,'status',e.status,'occurred_at',e.occurred_at,'prompt_label',m.prompt_label,'evidence_class',m.evidence_class) order by e.occurred_at,e.id)
  from public.evidence_records e left join lateral(select prompt_label,evidence_class from public.curriculum_evidence_mappings x where x.lab_code=e.lab_code and x.lab_version=e.lab_version and x.semantic_field_id=e.semantic_field_id order by x.created_at desc,x.id desc limit 1) m on true
  where e.id=any(s.evidence_ids) and e.user_id=s.user_id),'[]'::jsonb) as evidence,
 coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id desc) from public.evidence_assessments a where a.submission_id=s.id),'[]'::jsonb) as reviews
 from public.evidence_submissions s join public.learners l on l.user_id=s.user_id
 where (s.user_id=owner_id or private.can_review_submission(s.id)) and (p_cohort is null or s.cohort_id=p_cohort)
 ) q;
 return jsonb_build_object('groups',groups,'submissions',submissions,'rubrics',rubrics);
end $$;
