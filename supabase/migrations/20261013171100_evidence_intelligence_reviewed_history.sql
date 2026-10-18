-- Agent 3 reviewed-evidence adapter.
-- Returns derived, human-reviewed evidence history only. No learner wording, notes,
-- email, response values or private P3 content leave this function.

create or replace function private.bis_agent_reviewed_evidence_history(
  p_cohort text,
  p_learner text,
  p_competency text
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.pilot_cohorts;
  result jsonb;
begin
  if auth.uid() is null or not private.has_staff_role('FACILITATOR') then
    raise insufficient_privilege using message = 'Facilitator access is required.';
  end if;

  select * into c
  from public.pilot_cohorts pc
  where pc.id = p_cohort
    and pc.status = 'ACTIVE'
    and lower(pc.facilitator_email) = private.current_email()
  limit 1;
  if c.id is null then
    raise insufficient_privilege using message = 'This cohort is not assigned to you.';
  end if;

  if not exists (
    select 1
    from public.cohort_members cm
    join public.learners l on l.user_id = cm.learner_user_id and l.status = 'ACTIVE'
    join public.lab_enrollments le
      on le.user_id = cm.learner_user_id
      and le.lab_code = c.lab_code
      and le.lab_version = c.lab_version
      and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
    where cm.cohort_id = c.id
      and cm.learner_user_id = p_learner
      and cm.status = 'ACTIVE'
      and (
        select cr.status
        from public.consent_records cr
        where cr.user_id = cm.learner_user_id
          and cr.consent_type = 'LEARNER_PRODUCT'
        order by cr.created_at desc, cr.id desc
        limit 1
      ) = 'GRANTED'
  ) then
    raise insufficient_privilege using message = 'This learner is not currently eligible for longitudinal review.';
  end if;

  with current_submissions as (
    select s.*
    from public.evidence_submissions s
    where s.cohort_id = c.id
      and s.user_id = p_learner
      and private.submission_is_current(s.id)
  ),
  latest_reviews as (
    select distinct on (a.submission_id)
      a.submission_id,
      a.id as assessment_id,
      a.rubric_version_id,
      a.disposition,
      a.created_at
    from public.evidence_assessments a
    join current_submissions s on s.id = a.submission_id
    order by a.submission_id, a.created_at desc, a.id desc
  ),
  reviewed as (
    select s.id as submission_id, s.user_id, unnest(s.evidence_ids) as evidence_id,
      a.assessment_id, a.rubric_version_id, a.created_at as reviewed_at
    from current_submissions s
    join latest_reviews a on a.submission_id = s.id and a.disposition = 'REVIEWED'
  ),
  latest_mapping as (
    select distinct on (m.lab_code,m.lab_version,m.semantic_field_id)
      m.*
    from public.curriculum_evidence_mappings m
    where m.lab_code = c.lab_code
      and m.lab_version = c.lab_version
    order by m.lab_code,m.lab_version,m.semantic_field_id,m.created_at desc,m.id desc
  ),
  eligible as (
    select distinct on (e.id)
      e.id as evidence_id,
      e.occurred_at,
      m.competency,
      m.evidence_class,
      m.stage_ceiling,
      m.source_nature,
      r.rubric_version_id,
      r.reviewed_at
    from reviewed r
    join public.evidence_records e
      on e.id = r.evidence_id
      and e.user_id = r.user_id
      and e.status = 'ACTIVE'
      and e.sensitivity in ('P0','P1','P2')
      and e.lab_code = c.lab_code
      and e.lab_version = c.lab_version
    join latest_mapping m
      on m.lab_code = e.lab_code
      and m.lab_version = e.lab_version
      and m.semantic_field_id = e.semantic_field_id
      and m.classification_status = 'APPROVED'
      and m.contract_id is not null
      and m.competency = p_competency
    order by e.id, r.reviewed_at desc, r.assessment_id desc
  ),
  projected as (
    select
      evidence_id,
      occurred_at,
      competency,
      case
        when evidence_class = 'LEARNING_CHECK'
          and rubric_version_id is not null
          and stage_ceiling in ('EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER')
          then 'EXPLAIN'
        else 'NOTICE'
      end as stage,
      case when rubric_version_id is not null then 'MODERATE' else 'WEAK' end as evidence_strength,
      case when rubric_version_id is not null then 0.85 else 0.70 end as confidence,
      source_nature,
      evidence_class,
      rubric_version_id
    from eligible
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'evidenceId', evidence_id,
      'occurredAt', occurred_at,
      'competencyIds', jsonb_build_array(competency),
      'stage', stage,
      'evidenceStrength', evidence_strength,
      'confidence', confidence,
      'sourceNature', source_nature,
      'meaningSummary', case
        when evidence_class = 'LEARNING_CHECK' and rubric_version_id is not null
          then 'Human-reviewed, rubric-linked learning evidence within the authored source contract.'
        when evidence_class = 'LEARNING_CHECK'
          then 'Human-reviewed learning evidence within the authored source contract; no authored stage score is available.'
        when evidence_class = 'BASELINE'
          then 'Human-reviewed baseline self-report within the authored source contract.'
        else 'Human-reviewed self-report evidence within the authored source contract; no observed-behaviour claim is made.'
      end,
      'reviewStatus', 'REVIEWED'
    ) order by occurred_at, evidence_id
  ), '[]'::jsonb) into result
  from projected;

  return coalesce(result, '[]'::jsonb);
end
$$;

revoke all on function private.bis_agent_reviewed_evidence_history(text,text,text)
from public, anon, authenticated;

create or replace function public.bis_agent_reviewed_evidence_history(
  p_cohort text,
  p_learner text,
  p_competency text
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.bis_agent_reviewed_evidence_history(p_cohort,p_learner,p_competency)
$$;

revoke all on function public.bis_agent_reviewed_evidence_history(text,text,text) from public, anon;
grant execute on function public.bis_agent_reviewed_evidence_history(text,text,text) to authenticated;

comment on function public.bis_agent_reviewed_evidence_history(text,text,text) is
  'Facilitator-only Agent 3 input: current, consented, learner-shared evidence whose latest assessment is REVIEWED and whose latest curriculum mapping is source-contract-backed. Returns no raw learner wording.';
