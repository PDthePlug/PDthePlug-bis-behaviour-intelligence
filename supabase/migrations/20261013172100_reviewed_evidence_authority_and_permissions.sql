-- Correct guarded invoker adapter execution and revalidate current source authority.
-- Explicit facilitator sharing is not aggregation permission. Review disposition,
-- rubric presence and source stage ceilings are not achievement assessments.
-- No learner evidence, rubric or contract permission is modified by this migration.

-- Evidence Intelligence context now binds to the explicit source contract rather
-- than treating aggregation policy as AI permission or deriving a stage in code.
-- Only the assigned facilitator reviewing a current learner-shared submission may
-- resolve raw learner text. Sponsors, admins and the learner herself gain no new
-- raw-response endpoint through this function.

create or replace function private.bis_evidence_agent_context(p_evidence_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.evidence_records;
  q public.question_analysis_registry;
  m public.curriculum_evidence_mappings;
  r public.assessment_rubric_versions;
  v_submission_id text;
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'Sign in is required.';
  end if;
  if not private.has_staff_role('FACILITATOR') then
    raise insufficient_privilege using message = 'Facilitator review access is required.';
  end if;

  select * into e
  from public.evidence_records er
  where er.id = p_evidence_id
    and er.status = 'ACTIVE'
    and er.sensitivity in ('P0','P1','P2')
    and er.source_object_type = 'RESPONSE'
    and er.provenance = 'LR'
    and er.value_type = 'TEXT'
    and er.value is not null
    and btrim(er.value) <> ''
  limit 1;

  if e.id is null then
    raise exception 'Eligible learner-authored evidence not found.';
  end if;

  -- Current learner, consent and exact Lab/version enrolment are universal gates.
  if not exists (
    select 1
    from public.lab_enrollments le
    join public.learners l on l.user_id = le.user_id and l.status = 'ACTIVE'
    where le.id = e.enrolment_id
      and le.user_id = e.user_id
      and le.lab_code = e.lab_code
      and le.lab_version = e.lab_version
      and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
      and (
        select cr.status
        from public.consent_records cr
        where cr.user_id = e.user_id
          and cr.consent_type = 'LEARNER_PRODUCT'
        order by cr.created_at desc, cr.id desc
        limit 1
      ) = 'GRANTED'
  ) then
    raise insufficient_privilege using message = 'This evidence is not currently eligible for model-assisted review.';
  end if;

  select s.id into v_submission_id
  from public.evidence_submissions s
  join public.pilot_cohorts c on c.id = s.cohort_id and c.status = 'ACTIVE'
  where e.id = any(s.evidence_ids)
    and s.user_id = e.user_id
    and c.lab_code = e.lab_code
    and c.lab_version = e.lab_version
    and lower(c.facilitator_email) = private.current_email()
    and private.submission_is_current(s.id)
  order by s.created_at desc, s.id desc
  limit 1;

  if v_submission_id is null then
    raise insufficient_privilege using message = 'This learner has not shared this evidence for your current review.';
  end if;

  select * into q
  from public.question_analysis_registry qar
  where qar.lab_code = e.lab_code
    and qar.lab_version = e.lab_version
    and qar.semantic_field_id = e.semantic_field_id
    and qar.status = 'ACTIVE'
    and qar.model_review_policy = 'FACILITATOR_SHARED_ONLY'
    and qar.answer_model = 'TEXT'
    and qar.sensitivity <> 'P3'
    and qar.contract_id is not null
    and exists (select 1 from public.question_evidence_contracts qc where qc.id=qar.contract_id
      and qc.lab_code=qar.lab_code and qc.question_family=qar.question_family
      and qc.contract_status='APPROVED_MEANING' and qc.model_review_policy='FACILITATOR_SHARED_ONLY')
  order by qar.updated_at desc, qar.id desc
  limit 1;

  if q.id is null then
    raise exception 'This question is not approved for facilitator model-assisted interpretation.';
  end if;

  select * into m
  from public.curriculum_evidence_mappings cem
  where cem.lab_code = e.lab_code
    and cem.lab_version = e.lab_version
    and cem.semantic_field_id = e.semantic_field_id
    and cem.id = (select newest.id from public.curriculum_evidence_mappings newest
      where newest.lab_code=e.lab_code and newest.lab_version=e.lab_version
        and newest.semantic_field_id=e.semantic_field_id
      order by newest.created_at desc,newest.id desc limit 1)
    and cem.classification_status = 'APPROVED'
    and cem.contract_id = q.contract_id
    and cem.model_review_policy = 'FACILITATOR_SHARED_ONLY'
    and cem.competency is not null
    and btrim(cem.competency) <> ''
  order by cem.created_at desc, cem.id desc
  limit 1;

  if m.id is null then
    raise exception 'This evidence does not have a current source-governed competency contract.';
  end if;

  select * into r
  from public.assessment_rubric_versions arv
  where arv.lab_code = e.lab_code
    and arv.lab_version = e.lab_version
    and e.semantic_field_id = any(arv.semantic_field_ids)
  order by arv.created_at desc, arv.id desc
  limit 1;

  return jsonb_build_object(
    'evidenceId', e.id,
    'labCode', e.lab_code,
    'labVersion', e.lab_version,
    'semanticFieldId', e.semantic_field_id,
    'questionLabel', coalesce(q.label, m.prompt_label),
    'portfolioPurpose', m.portfolio_purpose,
    'authoredOutcome', coalesce(m.outcome, m.allowed_inference, ''),
    'evidenceClass', m.evidence_class,
    'sensitivity', e.sensitivity,
    'sourceNature', m.source_nature,
    'mappingStatus', m.classification_status,
    'competencyId', m.competency,
    'stageCeiling', m.stage_ceiling,
    'occurredAt', e.occurred_at,
    'learnerText', e.value,
    'contractId', m.contract_id,
    'allowedInference', coalesce(m.allowed_inference, ''),
    'forbiddenInference', coalesce(m.forbidden_inference, ''),
    'rubric', case when r.id is null then null else jsonb_build_object(
      'id', r.id,
      'title', r.title,
      'criteria', r.criteria,
      'scaleMin', r.scale_min,
      'scaleMax', r.scale_max
    ) end
  );
end
$$;

revoke all on function private.bis_evidence_agent_context(text) from public, anon, authenticated;

create or replace function public.bis_evidence_agent_context(p_evidence_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.bis_evidence_agent_context(p_evidence_id)
$$;

revoke all on function public.bis_evidence_agent_context(text) from public, anon;
grant execute on function public.bis_evidence_agent_context(text) to authenticated;

comment on function public.bis_evidence_agent_context(text) is
  'Facilitator-only resolver for current learner-shared P0-P2 text whose exact question has an approved FACILITATOR_SHARED_ONLY source contract. Aggregation permission is unrelated.';

grant execute on function private.bis_evidence_agent_context(text) to authenticated;

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
      and (p_competency is null or m.competency = p_competency)
    join public.question_evidence_contracts qc on qc.id=m.contract_id
      and qc.lab_code=m.lab_code and qc.question_family=m.question_family
      and qc.contract_status='APPROVED_MEANING'
      and qc.competency_id=m.competency and qc.evidence_class=m.evidence_class
    join public.question_analysis_registry qr on qr.id=m.registry_id
      and qr.lab_code=e.lab_code and qr.lab_version=e.lab_version
      and qr.semantic_field_id=e.semantic_field_id and qr.status='ACTIVE'
      and qr.contract_id=qc.id and qr.sensitivity in ('P0','P1','P2')
    order by e.id, r.reviewed_at desc, r.assessment_id desc
  ),
  projected as (
    select
      evidence_id,
      occurred_at,
      competency,
      'NOT_YET_EVIDENCED'::text as stage,
      'WEAK'::text as evidence_strength,
      0::numeric as confidence,
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
      'meaningSummary', 'Human-reviewed task evidence. No authored achievement rule is available to assign a competency stage or calibrated confidence.',
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
  'Facilitator-only Agent 3 input: current, consented, learner-shared evidence whose latest assessment is REVIEWED; review does not establish an achievement stage and whose latest curriculum mapping is source-contract-backed. Returns no raw learner wording.';

grant execute on function private.bis_agent_reviewed_evidence_history(text,text,text) to authenticated;

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
      'evidenceBasis', 'HUMAN_REVIEWED_TASK_COVERAGE',
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
    join public.question_evidence_contracts qc on qc.id=m.contract_id
      and qc.lab_code=m.lab_code and qc.question_family=m.question_family
      and qc.contract_status='APPROVED_MEANING'
      and qc.competency_id=m.competency and qc.evidence_class=m.evidence_class
    join public.question_analysis_registry qr on qr.id=m.registry_id
      and qr.lab_code=e.lab_code and qr.lab_version=e.lab_version
      and qr.semantic_field_id=e.semantic_field_id and qr.status='ACTIVE'
      and qr.contract_id=qc.id and qr.sensitivity in ('P0','P1','P2')
      and qc.aggregation_policy='STRUCTURED_ONLY' and qc.privacy_scope='AGGREGATE_ALLOWED'
      and qr.aggregate_policy='STRUCTURED_ONLY' and qr.answer_model in ('INTEGER','BOOLEAN','CATEGORICAL','MULTI_SELECT')
    order by r.user_id,e.id,r.reviewed_at desc,r.assessment_id desc
  ),
  learner_competency as (
    select
      user_id,
      competency,
      false as has_rubric_explain,
      false as has_rubric
    from eligible
    group by user_id, competency
  ),
  stage_rows as (
    select
      user_id,
      competency,
      'NOT_YET_EVIDENCED'::text as stage,
      'WEAK'::text as evidence_strength
    from learner_competency
  ),
  counts as (
    select
      competency,
      count(*)::integer as reportable,
      count(*) filter (where stage = 'NOT_YET_EVIDENCED')::integer as notice_count,
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
        'NOT_YET_EVIDENCED', case when notice_count > 0 then notice_count else null end,
        'EXPLAIN', null
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
      'evidenceBasis', 'HUMAN_REVIEWED_TASK_COVERAGE',
    'competencies', v_competencies,
    'comparisonCoverage', '[]'::jsonb,
    'limitations', jsonb_build_array(
      'Only current, consented, exact-version learner-shared evidence with a latest REVIEWED human assessment contributes.',
      'Reviewed task coverage is available; no authored achievement rule currently establishes a competency stage.',
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

grant execute on function private.bis_agent_programme_aggregate(text) to authenticated;
