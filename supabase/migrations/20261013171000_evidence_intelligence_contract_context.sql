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
