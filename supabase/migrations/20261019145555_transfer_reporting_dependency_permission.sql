-- A permitted transfer cannot expose a derived outcome from first-context
-- work that the learner excluded from programme reporting. Individual access
-- remains unchanged. Every supporting contribution needs its own permission.
create function private.practice_review_is_reportable(target text) returns boolean
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
 and exists(select 1 from public.development_reporting_permissions permission where permission.submission_id=s.id and permission.allowed)
 and pa.opportunity and private.submission_is_current(s.id) and private.development_contract_is_current(c.id)
 and ea.disposition='REVIEWED' and ea.id=(select x.id from public.evidence_assessments x where x.submission_id=s.id order by x.created_at desc,x.id desc limit 1)
 and (select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids))<p.created_at
 and exists(select 1 from public.lab_enrollments le where le.user_id=s.user_id and le.lab_code=c.lab_code and le.lab_version=c.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')));
end $$;
revoke all on function private.practice_review_is_reportable(text) from public,anon,authenticated;

create or replace function private.current_development_reviews() returns table(
 review_id text,user_id text,cohort_id text,contract_id text,competency_id text,stage text,at timestamptz,
 comparison_key text,source_nature text,context text,independent boolean,follow_up_days integer,perception_level integer,lab_code text,reporting_allowed boolean
) language sql stable security definer set search_path='' as $$
 with current_claim as(select distinct on(s0.user_id,c.competency_id,private.development_comparison_key(c.id),md5((select string_agg(v,',' order by v) from unnest(s0.evidence_ids) v))) d.*,a.submission_id
 from public.development_reviews d join public.evidence_assessments a on a.id=d.assessment_id join public.development_task_contracts c on c.id=d.contract_id join public.evidence_submissions s0 on s0.id=a.submission_id
 where a.disposition='REVIEWED' and a.id=(select x.id from public.evidence_assessments x where x.submission_id=a.submission_id order by x.created_at desc,x.id desc limit 1)
 order by s0.user_id,c.competency_id,private.development_comparison_key(c.id),md5((select string_agg(v,',' order by v) from unnest(s0.evidence_ids) v)),d.created_at desc,d.id desc)
 select d.id,s.user_id,s.cohort_id,c.id,c.competency_id,d.stage,(select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids)),private.development_comparison_key(c.id),c.source_nature,d.context,d.independent,c.follow_up_days,
 (select case when e.value~'^[0-5]$' then e.value::integer else null end from public.evidence_records e where e.id=any(s.evidence_ids) and e.semantic_field_id=c.perception_field and e.sensitivity in ('P0','P1','P2') limit 1),c.lab_code,(coalesce(p.allowed,false) and private.practice_review_is_reportable(d.id))
 from current_claim d join public.evidence_submissions s on s.id=d.submission_id join public.development_task_contracts c on c.id=d.contract_id
 left join public.development_reporting_permissions p on p.submission_id=s.id
 where private.submission_is_current(s.id) and private.development_contract_is_current(c.id) and private.practice_review_is_current(d.id)
 and exists(select 1 from public.lab_enrollments le where le.user_id=s.user_id and le.lab_code=c.lab_code and le.lab_version=c.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED'))
 and cardinality(c.mapping_ids)=(select count(*) from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.classification_status='APPROVED')
 and not exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and (m.classification_status<>'APPROVED' or m.id is distinct from(select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)))
 and not exists(select 1 from public.curriculum_evidence_mappings m join public.question_evidence_contracts q on q.id=m.contract_id where m.id=any(c.mapping_ids) and (q.contract_status<>'APPROVED_MEANING' or private.development_stage_level(d.stage)>private.development_stage_level(q.stage_ceiling)))
 and not exists(select 1 from public.curriculum_evidence_mappings m join public.question_analysis_registry q on q.id=m.registry_id where m.id=any(c.mapping_ids) and q.status='RETIRED')
$$;
