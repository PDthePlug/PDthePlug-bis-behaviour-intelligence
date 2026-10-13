-- BIS Evidence Intelligence Agents
-- AI receives only explicitly eligible learner-authored text. Original evidence remains immutable.
-- AI proposals are intentionally not persisted by a privileged service-role path in v1; a human-reviewed
-- assessment remains the reportable authority. Sponsor/programme surfaces never receive this RPC.

-- Resolve one eligible free-text learner response for model-assisted interpretation.
-- Access is limited to the learner who owns it or the explicitly assigned facilitator
-- reviewing a current, revocable submission. System administrators and sponsors do not
-- gain a new raw-evidence path through this function.
create or replace function public.bis_evidence_agent_context(p_evidence_id text)
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
  v_cohort_id text;
  v_allowed boolean := false;
  v_stage_ceiling text := 'NOT_YET_EVIDENCED';
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'Sign in is required.';
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

  -- Consent, learner state and exact Lab/version enrolment are universal eligibility
  -- requirements. No role, including an administrator role, bypasses these checks.
  if not exists(
    select 1
    from public.lab_enrollments le
    join public.learners l on l.user_id = le.user_id
    where le.id = e.enrolment_id
      and le.user_id = e.user_id
      and le.lab_code = e.lab_code
      and le.lab_version = e.lab_version
      and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
      and l.status = 'ACTIVE'
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

  if e.user_id = private.current_app_user_id() then
    v_allowed := true;
  elsif private.has_staff_role('FACILITATOR') then
    select s.cohort_id into v_cohort_id
    from public.evidence_submissions s
    join public.pilot_cohorts c on c.id = s.cohort_id
    where e.id = any(s.evidence_ids)
      and s.user_id = e.user_id
      and c.lab_code = e.lab_code
      and c.lab_version = e.lab_version
      and lower(c.facilitator_email) = private.current_email()
      and private.submission_is_current(s.id)
    order by s.created_at desc
    limit 1;
    v_allowed := v_cohort_id is not null;
  end if;

  if not v_allowed then
    raise insufficient_privilege using message = 'This evidence is not available for model-assisted review.';
  end if;

  select * into q
  from public.question_analysis_registry qar
  where qar.lab_code = e.lab_code
    and qar.lab_version = e.lab_version
    and qar.semantic_field_id = e.semantic_field_id
    and qar.status = 'ACTIVE'
    and qar.aggregate_policy = 'MODEL_ASSISTED'
    and qar.answer_model = 'TEXT'
    and qar.sensitivity <> 'P3'
  order by qar.updated_at desc, qar.id desc
  limit 1;

  if q.id is null then
    raise exception 'This question is not approved for model-assisted interpretation.';
  end if;

  select * into m
  from public.curriculum_evidence_mappings cem
  where cem.lab_code = e.lab_code
    and cem.lab_version = e.lab_version
    and cem.semantic_field_id = e.semantic_field_id
    and cem.classification_status = 'APPROVED'
    and cem.competency is not null
    and btrim(cem.competency) <> ''
  order by cem.created_at desc, cem.id desc
  limit 1;

  if m.id is null then
    raise exception 'This evidence does not yet have an approved competency mapping.';
  end if;

  select * into r
  from public.assessment_rubric_versions arv
  where arv.lab_code = e.lab_code
    and arv.lab_version = e.lab_version
    and e.semantic_field_id = any(arv.semantic_field_ids)
  order by arv.created_at desc, arv.id desc
  limit 1;

  -- These are deliberately conservative ceilings. They prevent a model from turning
  -- a learner reflection, prediction or plan into a claim of observed behaviour or transfer.
  v_stage_ceiling := case m.evidence_class
    when 'BASELINE' then 'NOTICE'
    when 'CONTEXT' then 'NOTICE'
    when 'PREDICTION' then 'EXPLAIN'
    when 'PLAN' then 'EXPLAIN'
    when 'LEARNING_CHECK' then 'EXPLAIN'
    when 'OBSERVATION' then 'APPLY'
    when 'OUTCOME' then 'APPLY'
    when 'INTERPRETATION' then 'TEST_AND_REVISE'
    when 'TRANSFER' then 'TRANSFER'
    when 'SUPPORT_SIGNAL' then 'NOTICE'
    else 'NOT_YET_EVIDENCED'
  end;

  return jsonb_build_object(
    'evidenceId', e.id,
    'labCode', e.lab_code,
    'labVersion', e.lab_version,
    'semanticFieldId', e.semantic_field_id,
    'questionLabel', coalesce(q.label, m.prompt_label),
    'portfolioPurpose', m.portfolio_purpose,
    'authoredOutcome', coalesce(m.outcome, ''),
    'evidenceClass', m.evidence_class,
    'sensitivity', e.sensitivity,
    'sourceNature', 'SELF_REPORT',
    'mappingStatus', m.classification_status,
    'competencyId', m.competency,
    'stageCeiling', v_stage_ceiling,
    'occurredAt', e.occurred_at,
    'learnerText', e.value,
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

revoke all on function public.bis_evidence_agent_context(text) from public, anon;
grant execute on function public.bis_evidence_agent_context(text) to authenticated;

comment on function public.bis_evidence_agent_context(text) is
  'Returns one consent-current, version-scoped learner-authored response for explicitly governed MODEL_ASSISTED interpretation. Access is learner-owned or explicit facilitator submission only; sponsors and administrators gain no raw-text path.';
