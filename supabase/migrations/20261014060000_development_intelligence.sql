-- Authored task contracts and immutable human development reviews.
-- Derived programme reporting requires a separate, revocable learner permission.
create table public.development_task_contracts(
 id text primary key default gen_random_uuid()::text,
 lab_code text not null,lab_version text not null,competency_id text not null,
 mapping_ids text[] not null,semantic_field_ids text[] not null,
 title text not null,source_reference text not null,source_hash text not null,
 stage_ceiling text not null,comparison_key text not null,
 source_nature text not null check(source_nature in ('SELF_REPORT','ASSESSED_TASK')),
 follow_up_days integer check(follow_up_days between 1 and 365),
 perception_field text,created_by text not null,created_at timestamptz not null default clock_timestamp()
);
create table public.development_reporting_permissions(
 submission_id text primary key references public.evidence_submissions(id),
 allowed boolean not null default false,updated_at timestamptz not null default clock_timestamp()
);
create table public.development_reviews(
 id text primary key default gen_random_uuid()::text,
 assessment_id text not null references public.evidence_assessments(id),
 contract_id text not null references public.development_task_contracts(id),
 stage text not null check(stage in ('NOTICE','EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER')),
 criteria jsonb not null,context text not null check(context in ('SCHOOL','HOME','WORK','COMMUNITY','OTHER')),
 independent boolean not null default false,
 assessor_id text not null,request_key text not null,
 created_at timestamptz not null default clock_timestamp(),unique(assessor_id,request_key)
);
create index development_review_assessment on public.development_reviews(assessment_id,created_at desc,id);
create index development_review_contract on public.development_reviews(contract_id);
create index development_permission_submission on public.development_reporting_permissions(submission_id,allowed);
alter table public.development_task_contracts enable row level security;
alter table public.development_reporting_permissions enable row level security;
alter table public.development_reviews enable row level security;
revoke all on public.development_task_contracts,public.development_reporting_permissions,public.development_reviews from public,anon,authenticated;
create policy development_contract_direct_deny on public.development_task_contracts for all to authenticated using(false) with check(false);
create policy development_permission_direct_deny on public.development_reporting_permissions for all to authenticated using(false) with check(false);
create policy development_review_direct_deny on public.development_reviews for all to authenticated using(false) with check(false);
create trigger development_contract_immutable before update or delete on public.development_task_contracts for each row execute function private.assessment_record_immutable();
create trigger development_review_immutable before update or delete on public.development_reviews for each row execute function private.assessment_record_immutable();

create or replace function private.development_stage_level(stage text) returns integer language sql immutable set search_path='' as $$
 select case stage when 'NOTICE' then 1 when 'EXPLAIN' then 2 when 'APPLY' then 3 when 'TEST_AND_REVISE' then 4 when 'TRANSFER' then 5 else 0 end
$$;
revoke all on function private.development_stage_level(text) from public,anon,authenticated;

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
 values(p->>'labCode',p->>'labVersion',p->>'competencyId',mapping_ids,field_ids,p->>'title',p->>'source',p->>'sourceHash',p->>'ceiling',p->>'comparisonKey',p->>'sourceNature',nullif(p->>'followUpDays','')::integer,p->>'perceptionField',private.current_app_user_id()) returning id into result;
 return result;
end $$;

create or replace function private.development_reporting_permission(p_submission text,p_allowed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.evidence_submissions s where s.id=p_submission and s.user_id=private.current_app_user_id()) then raise insufficient_privilege using message='Choose your own shared submission.';end if;
 if p_allowed and not private.submission_is_current(p_submission) then raise exception 'Only current eligible evidence may contribute.';end if;
 insert into public.development_reporting_permissions values(p_submission,coalesce(p_allowed,false),clock_timestamp()) on conflict(submission_id) do update set allowed=excluded.allowed,updated_at=excluded.updated_at;
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
 if c.id is null or not exists(select 1 from public.pilot_cohorts pc where pc.id=s.cohort_id and pc.lab_code=c.lab_code and pc.lab_version=c.lab_version)
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
 if p->>'stage'='TRANSFER' and not exists(select 1 from private.current_development_reviews() r join public.development_reviews d on d.id=r.review_id join public.evidence_assessments aa on aa.id=d.assessment_id join public.evidence_submissions ss on ss.id=aa.submission_id where r.user_id=s.user_id and r.competency_id=c.competency_id and r.context<>p->>'context' and not(ss.evidence_ids && s.evidence_ids) and private.development_stage_level(r.stage)>=3) then raise exception 'Transfer requires an earlier reviewed application in a different recorded context.';end if;
 select * into prior from public.development_reviews where assessor_id=private.current_app_user_id() and request_key=p->>'requestKey';
 if prior.id is not null then
  if prior.assessment_id<>a.id or prior.contract_id<>c.id or prior.stage<>p->>'stage' or prior.criteria<>p->'criteria' or prior.context<>p->>'context' or prior.independent is distinct from coalesce((p->>'independent')::boolean,false) then raise exception 'Retry content changed.';end if;return prior.id;
 end if;
 insert into public.development_reviews(assessment_id,contract_id,stage,criteria,context,independent,assessor_id,request_key) values(a.id,c.id,p->>'stage',p->'criteria',p->>'context',coalesce((p->>'independent')::boolean,false),private.current_app_user_id(),p->>'requestKey') returning id into result;
 return result;
end $$;

create or replace function private.current_development_reviews() returns table(
 review_id text,user_id text,cohort_id text,contract_id text,competency_id text,stage text,at timestamptz,
 comparison_key text,source_nature text,context text,independent boolean,follow_up_days integer,perception_level integer,lab_code text,reporting_allowed boolean
) language sql stable security definer set search_path='' as $$
 with current_claim as(select distinct on(s0.user_id,c.competency_id,c.comparison_key,md5((select string_agg(v,',' order by v) from unnest(s0.evidence_ids) v))) d.*,a.submission_id
 from public.development_reviews d join public.evidence_assessments a on a.id=d.assessment_id join public.development_task_contracts c on c.id=d.contract_id join public.evidence_submissions s0 on s0.id=a.submission_id
 where a.disposition='REVIEWED' and a.id=(select x.id from public.evidence_assessments x where x.submission_id=a.submission_id order by x.created_at desc,x.id desc limit 1)
 order by s0.user_id,c.competency_id,c.comparison_key,md5((select string_agg(v,',' order by v) from unnest(s0.evidence_ids) v)),d.created_at desc,d.id desc)
 select d.id,s.user_id,s.cohort_id,c.id,c.competency_id,d.stage,(select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids)),c.comparison_key,c.source_nature,d.context,d.independent,c.follow_up_days,
 (select case when e.value~'^[0-5]$' then e.value::integer else null end from public.evidence_records e where e.id=any(s.evidence_ids) and e.semantic_field_id=c.perception_field and e.sensitivity in ('P0','P1','P2') limit 1),c.lab_code,coalesce(p.allowed,false)
 from current_claim d join public.evidence_submissions s on s.id=d.submission_id join public.development_task_contracts c on c.id=d.contract_id
 left join public.development_reporting_permissions p on p.submission_id=s.id
 where private.submission_is_current(s.id)
 and exists(select 1 from public.lab_enrollments le where le.user_id=s.user_id and le.lab_code=c.lab_code and le.lab_version=c.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED'))
 and cardinality(c.mapping_ids)=(select count(*) from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.classification_status='APPROVED')
 and not exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and (m.classification_status<>'APPROVED' or m.id is distinct from(select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)))
 and not exists(select 1 from public.curriculum_evidence_mappings m join public.question_evidence_contracts q on q.id=m.contract_id where m.id=any(c.mapping_ids) and (q.contract_status<>'APPROVED_MEANING' or private.development_stage_level(d.stage)>private.development_stage_level(q.stage_ceiling)))
 and not exists(select 1 from public.curriculum_evidence_mappings m join public.question_analysis_registry q on q.id=m.registry_id where m.id=any(c.mapping_ids) and q.status='RETIRED')
$$;

create or replace function private.development_learner_report(p_learner text,p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in is required.';end if;
 if p_learner<>private.current_app_user_id() and (p_cohort is null or not private.has_staff_role('FACILITATOR') or not exists(select 1 from public.pilot_cohorts pc join public.cohort_members m on m.cohort_id=pc.id where pc.id=p_cohort and pc.status='ACTIVE' and lower(pc.facilitator_email)=private.current_email() and m.learner_user_id=p_learner and m.status='ACTIVE')) then raise insufficient_privilege using message='This learner is not assigned to you.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.review_id,'competencyId',r.competency_id,'stage',r.stage,'at',r.at,'comparisonKey',r.comparison_key,'authorityId',r.contract_id,'reviewStatus','REVIEWED','sourceNature',r.source_nature,'labCode',r.lab_code,'context',r.context,'independent',r.independent,'followUpDays',r.follow_up_days,'perceptionLevel',r.perception_level) order by r.at,r.review_id),'[]'::jsonb) into result from private.current_development_reviews() r where r.user_id=p_learner and (p_learner=private.current_app_user_id() or r.cohort_id=p_cohort);
 return result;
end $$;

create or replace function private.development_programme_report(p_cohort text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare population integer; rows jsonb;
begin
 if auth.uid() is null or not private.can_view_competency_cohort(p_cohort) then raise insufficient_privilege using message='Programme access is required.';end if;
 select count(distinct cm.learner_user_id)::integer into population from public.cohort_members cm join public.learners l on l.user_id=cm.learner_user_id and l.status='ACTIVE' join public.pilot_cohorts pc on pc.id=cm.cohort_id and pc.status='ACTIVE'
 where cm.cohort_id=p_cohort and cm.status='ACTIVE'
 and (select status from public.consent_records cr where cr.user_id=cm.learner_user_id and cr.consent_type='LEARNER_PRODUCT' order by cr.created_at desc,cr.id desc limit 1)='GRANTED';
 if population<5 then return jsonb_build_object('cohortId',p_cohort,'participantCount',population,'suppressed',true,'competencies','[]'::jsonb);end if;
 with facts as(select * from private.current_development_reviews() where cohort_id=p_cohort and reporting_allowed),
 current_fact as(select distinct on(user_id,competency_id) * from facts order by user_id,competency_id,at desc,review_id desc),
 person as(select f.*,b.stage as baseline_stage,b.at as baseline_at,
  (select bool_and(x.source_nature='ASSESSED_TASK') from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key) as assessed_only,
  (select count(*) from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key) as reviews,
  (select count(distinct x.at::date) from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key and x.independent and private.development_stage_level(x.stage)>=3) as independent_days,
  exists(select 1 from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key and x.stage='TRANSFER') as has_transfer,
  exists(select 1 from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key and x.independent and private.development_stage_level(x.stage)>=3 and f.follow_up_days is not null and x.at>=b.at+f.follow_up_days*interval '1 day') as has_followup
 from current_fact f join lateral(select * from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key order by x.at,x.review_id limit 1) b on true),
 distribution as(select competency_id,stage as code,count(*)::integer as n from person group by competency_id,stage union all select competency_id,'NOT_YET_EVIDENCED',population-count(*)::integer from person group by competency_id),
 changes as(select competency_id,case when reviews<2 then 'INSUFFICIENT_HISTORY' when private.development_stage_level(stage)>private.development_stage_level(baseline_stage) then 'HIGHER_REVIEWED_STAGE' when private.development_stage_level(stage)<private.development_stage_level(baseline_stage) then 'LOWER_REVIEWED_STAGE' else 'SAME_REVIEWED_STAGE' end as code,count(*)::integer as n from person group by competency_id,code union all select competency_id,'NO_REVIEWED_EVIDENCE',population-count(*)::integer from person group by competency_id),
 strengths as(select competency_id,case when assessed_only and reviews>=3 and independent_days>=3 then 'STRONG' when reviews>=2 then 'MODERATE' else 'LIMITED' end as code,count(*)::integer as n from person group by competency_id,code union all select competency_id,'NO_REVIEWED_EVIDENCE',population-count(*)::integer from person group by competency_id),
 totals as(select competency_id,count(*)::integer as covered,count(*) filter(where has_transfer)::integer as transferred,count(*) filter(where independent_days>=3)::integer as repeated,count(*) filter(where has_followup)::integer as followup,count(*) filter(where perception_level is not null)::integer as alignment from person group by competency_id),
 safe as(select t.* from totals t where not exists(select 1 from(select n from distribution d where d.competency_id=t.competency_id union all select n from changes d where d.competency_id=t.competency_id union all select n from strengths d where d.competency_id=t.competency_id union all select unnest(array[t.covered,population-t.covered,t.transferred,population-t.transferred,t.repeated,population-t.repeated,t.followup,population-t.followup,t.alignment,population-t.alignment])) counts where n between 1 and 2))
 select coalesce(jsonb_agg(jsonb_build_object('competencyId',t.competency_id,'distribution',(select jsonb_agg(jsonb_build_object('code',d.code,'count',d.n) order by d.code) from distribution d where d.competency_id=t.competency_id),'changeDistribution',(select jsonb_agg(jsonb_build_object('code',d.code,'count',d.n) order by d.code) from changes d where d.competency_id=t.competency_id),'strengthDistribution',(select jsonb_agg(jsonb_build_object('code',d.code,'count',d.n) order by d.code) from strengths d where d.competency_id=t.competency_id),'transferParticipants',t.transferred,'repeatedApplicationParticipants',t.repeated,'followupParticipants',t.followup,'alignmentParticipants',t.alignment)),'[]'::jsonb) into rows from safe t;
 return jsonb_build_object('cohortId',p_cohort,'participantCount',population,'suppressed',false,'competencies',rows);
end $$;

create or replace function private.development_contract_workspace(p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare contracts jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in is required.';end if;
 if not private.has_staff_role('SYSTEM_ADMIN') and (p_cohort is null or not private.has_staff_role('FACILITATOR') or not exists(select 1 from public.pilot_cohorts c where c.id=p_cohort and c.status='ACTIVE' and lower(c.facilitator_email)=private.current_email())) then raise insufficient_privilege using message='Source or facilitator access is required.';end if;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into contracts from public.development_task_contracts c where p_cohort is null or exists(select 1 from public.pilot_cohorts pc where pc.id=p_cohort and pc.lab_code=c.lab_code and pc.lab_version=c.lab_version);
 return jsonb_build_object('contracts',contracts);
end $$;

revoke all on function private.publish_development_contract(jsonb) from public,anon;
grant execute on function private.publish_development_contract(jsonb) to authenticated;
create or replace function public.bis_publish_development_contract(p jsonb) returns text
language sql security invoker set search_path='' as $$ select private.publish_development_contract(p) $$;
revoke all on function public.bis_publish_development_contract(jsonb) from public,anon;
grant execute on function public.bis_publish_development_contract(jsonb) to authenticated;

revoke all on function private.development_reporting_permission(text,boolean) from public,anon;
grant execute on function private.development_reporting_permission(text,boolean) to authenticated;
create or replace function public.bis_development_reporting_permission(p_submission text,p_allowed boolean) returns void
language sql security invoker set search_path='' as $$ select private.development_reporting_permission(p_submission,p_allowed) $$;
revoke all on function public.bis_development_reporting_permission(text,boolean) from public,anon;
grant execute on function public.bis_development_reporting_permission(text,boolean) to authenticated;

revoke all on function private.record_development_review(jsonb) from public,anon;
grant execute on function private.record_development_review(jsonb) to authenticated;
create or replace function public.bis_record_development_review(p jsonb) returns text
language sql security invoker set search_path='' as $$ select private.record_development_review(p) $$;
revoke all on function public.bis_record_development_review(jsonb) from public,anon;
grant execute on function public.bis_record_development_review(jsonb) to authenticated;

revoke all on function private.development_learner_report(text,text) from public,anon;
grant execute on function private.development_learner_report(text,text) to authenticated;
create or replace function public.bis_development_learner_report(p_learner text,p_cohort text default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.development_learner_report(p_learner,p_cohort) $$;
revoke all on function public.bis_development_learner_report(text,text) from public,anon;
grant execute on function public.bis_development_learner_report(text,text) to authenticated;

revoke all on function private.development_programme_report(text) from public,anon;
grant execute on function private.development_programme_report(text) to authenticated;
create or replace function public.bis_development_programme_report(p_cohort text) returns jsonb
language sql security invoker set search_path='' as $$ select private.development_programme_report(p_cohort) $$;
revoke all on function public.bis_development_programme_report(text) from public,anon;
grant execute on function public.bis_development_programme_report(text) to authenticated;

revoke all on function private.development_contract_workspace(text) from public,anon;
grant execute on function private.development_contract_workspace(text) to authenticated;
create or replace function public.bis_development_contract_workspace(p_cohort text default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.development_contract_workspace(p_cohort) $$;
revoke all on function public.bis_development_contract_workspace(text) from public,anon;
grant execute on function public.bis_development_contract_workspace(text) to authenticated;

revoke all on function private.current_development_reviews() from public,anon,authenticated;

create or replace function private.development_permission_state(p_submission text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.evidence_submissions s where s.id=p_submission and s.user_id=private.current_app_user_id()) then raise insufficient_privilege using message='Choose your own submission.';end if;
 return coalesce((select allowed from public.development_reporting_permissions where submission_id=p_submission),false);
end $$;
revoke all on function private.development_permission_state(text) from public,anon;
grant execute on function private.development_permission_state(text) to authenticated;
create or replace function public.bis_development_permission_state(p_submission text) returns boolean language sql stable security invoker set search_path='' as $$select private.development_permission_state(p_submission)$$;
revoke all on function public.bis_development_permission_state(text) from public,anon;
grant execute on function public.bis_development_permission_state(text) to authenticated;
