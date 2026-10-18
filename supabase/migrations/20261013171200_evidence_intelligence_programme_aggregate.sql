-- Agent 5 aggregate adapter.
-- Produces suppression-safe, reviewed-evidence-only cohort development aggregates.
-- No individual identifiers, evidence IDs, response wording, assessment feedback or
-- P3 content are serialized into the model input.

create or replace function private.bis_agent_programme_aggregate(p_cohort text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.pilot_cohorts;
  v_participants integer := 0;
  v_competencies jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'Sign in is required.';
  end if;
  if not private.can_view_competency_cohort(p_cohort) then
    raise insufficient_privilege using message = 'You do not have access to this programme evidence.';
  end if;

  select * into c
  from public.pilot_cohorts pc
  where pc.id = p_cohort and pc.status = 'ACTIVE'
  limit 1;
  if c.id is null then
    raise exception 'Active cohort not found.';
  end if;

  with members as (
    select distinct cm.learner_user_id as user_id
    from public.cohort_members cm
    join public.learners l on l.user_id = cm.learner_user_id and l.status = 'ACTIVE'
    join public.lab_enrollments le
      on le.user_id = cm.learner_user_id
      and le.lab_code = c.lab_code
      and le.lab_version = c.lab_version
      and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
    where cm.cohort_id = c.id
      and cm.status = 'ACTIVE'
      and (
        select cr.status
        from public.consent_records cr
        where cr.user_id = cm.learner_user_id
          and cr.consent_type = 'LEARNER_PRODUCT'
        order by cr.created_at desc, cr.id desc
        limit 1
      ) = 'GRANTED'
  )
  select count(*)::integer into v_participants from members;

  if v_participants < 5 then
    return jsonb_build_object(
      'cohortId', c.id,
      'participantCount', v_participants,
      'reportingStatus', 'SUPPRESSED_SMALL_COHORT',
      'minimumReportableCellSize', 3,
      'competencies', '[]'::jsonb,
      'comparisonCoverage', '[]'::jsonb,
      'limitations', jsonb_build_array(
        'Programme insight is withheld because fewer than five current, consented, exact-version participants are eligible.',
        'Missing evidence is not evidence of inability.'
      )
    );
  end if;

  with members as (
    select distinct cm.learner_user_id as user_id
    from public.cohort_members cm
    join public.learners l on l.user_id = cm.learner_user_id and l.status = 'ACTIVE'
    join public.lab_enrollments le
      on le.user_id = cm.learner_user_id
      and le.lab_code = c.lab_code
      and le.lab_version = c.lab_version
      and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
    where cm.cohort_id = c.id
      and cm.status = 'ACTIVE'
      and (
        select cr.status
        from public.consent_records cr
        where cr.user_id = cm.learner_user_id
          and cr.consent_type = 'LEARNER_PRODUCT'
        order by cr.created_at desc, cr.id desc
        limit 1
      ) = 'GRANTED'
  ),
  current_submissions as (
    select s.*
    from public.evidence_submissions s
    join members mm on mm.user_id = s.user_id
    where s.cohort_id = c.id
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
    select s.user_id, unnest(s.evidence_ids) as evidence_id,
      a.assessment_id, a.rubric_version_id, a.created_at as reviewed_at
    from current_submissions s
    join latest_reviews a on a.submission_id = s.id and a.disposition = 'REVIEWED'
  ),
  latest_mapping as (
    select distinct on (m.lab_code,m.lab_version,m.semantic_field_id)
      m.*
    from public.curriculum_evidence_mappings m
    where m.lab_code = c.lab_code and m.lab_version = c.lab_version
    order by m.lab_code,m.lab_version,m.semantic_field_id,m.created_at desc,m.id desc
  ),
  eligible as (
    select distinct on (r.user_id,e.id)
      r.user_id,
      e.id as evidence_id,
      m.competency,
      m.evidence_class,
      m.stage_ceiling,
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
      and m.competency is not null
      and btrim(m.competency) <> ''
    order by r.user_id,e.id,r.reviewed_at desc,r.assessment_id desc
  ),
  learner_competency as (
    select
      user_id,
      competency,
      bool_or(
        evidence_class = 'LEARNING_CHECK'
        and rubric_version_id is not null
        and stage_ceiling in ('EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER')
      ) as has_rubric_explain,
      bool_or(rubric_version_id is not null) as has_rubric
    from eligible
    group by user_id, competency
  ),
  stage_rows as (
    select
      user_id,
      competency,
      case when has_rubric_explain then 'EXPLAIN' else 'NOTICE' end as stage,
      case when has_rubric then 'MODERATE' else 'WEAK' end as evidence_strength
    from learner_competency
  ),
  counts as (
    select
      competency,
      count(*)::integer as reportable,
      count(*) filter (where stage = 'NOTICE')::integer as notice_count,
      count(*) filter (where stage = 'EXPLAIN')::integer as explain_count,
      count(*) filter (where evidence_strength = 'WEAK')::integer as weak_count,
      count(*) filter (where evidence_strength = 'MODERATE')::integer as moderate_count
    from stage_rows
    group by competency
  ),
  safe_counts as (
    select *
    from counts
    where reportable >= 3
      and (v_participants - reportable = 0 or v_participants - reportable >= 3)
      and (notice_count = 0 or notice_count >= 3)
      and (explain_count = 0 or explain_count >= 3)
      and (weak_count = 0 or weak_count >= 3)
      and (moderate_count = 0 or moderate_count >= 3)
  ),
  rows as (
    select jsonb_build_object(
      'competencyId', competency,
      'label', competency,
      'reportableParticipants', reportable,
      'stageDistribution', jsonb_strip_nulls(jsonb_build_object(
        'NOTICE', case when notice_count > 0 then notice_count else null end,
        'EXPLAIN', case when explain_count > 0 then explain_count else null end
      )),
      'evidenceStrengthDistribution', jsonb_strip_nulls(jsonb_build_object(
        'WEAK', case when weak_count > 0 then weak_count else null end,
        'MODERATE', case when moderate_count > 0 then moderate_count else null end
      )),
      'changeSignal', null
    ) as item
    from safe_counts
    order by reportable desc, competency
  )
  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_competencies from rows;

  return jsonb_build_object(
    'cohortId', c.id,
    'participantCount', v_participants,
    'reportingStatus', case when jsonb_array_length(v_competencies) > 0 then 'AVAILABLE' else 'NO_SAFE_REVIEWED_COMPETENCY_CELLS' end,
    'minimumReportableCellSize', 3,
    'competencies', v_competencies,
    'comparisonCoverage', '[]'::jsonb,
    'limitations', jsonb_build_array(
      'Only current, consented, exact-version learner-shared evidence with a latest REVIEWED human assessment contributes.',
      'Current source contracts conservatively support NOTICE and, for rubric-linked learning checks, EXPLAIN only.',
      'Self-report remains self-report; this aggregate does not establish observed behaviour, mastery, transfer or causation.',
      'A competency is withheld entirely when any non-zero stage, strength or complementary participant cell would contain one or two people.',
      'Missing evidence is not evidence of inability.'
    )
  );
end
$$;

revoke all on function private.bis_agent_programme_aggregate(text) from public, anon, authenticated;

create or replace function public.bis_agent_programme_aggregate(p_cohort text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.bis_agent_programme_aggregate(p_cohort)
$$;

revoke all on function public.bis_agent_programme_aggregate(text) from public, anon;
grant execute on function public.bis_agent_programme_aggregate(text) to authenticated;

comment on function public.bis_agent_programme_aggregate(text) is
  'Agent 5 input: aggregate-only reviewed evidence with current consent/version scope and whole-competency suppression for small or reconstructable cells.';
