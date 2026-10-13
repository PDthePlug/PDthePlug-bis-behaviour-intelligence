-- BIS Evidence Intelligence Agents
-- AI may propose derived interpretations; original learner evidence remains immutable and authoritative.
-- Raw learner text is never stored in the agent ledger. Sponsor/programme surfaces never receive this RPC.

create table public.evidence_agent_runs (
  id text primary key default gen_random_uuid()::text,
  subject_user_id text not null references public.learners(user_id) on delete cascade,
  cohort_id text references public.pilot_cohorts(id) on delete set null,
  evidence_id text references public.evidence_records(id) on delete set null,
  lab_code text not null,
  lab_version text not null,
  semantic_field_id text not null,
  agent_type text not null,
  input_fingerprint text not null,
  model text not null,
  prompt_version text not null,
  disposition text not null,
  confidence numeric(5,4),
  requires_human_review boolean not null default true,
  output jsonb not null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_by text not null default 'BIS_EVIDENCE_AGENT',
  created_at timestamptz not null default clock_timestamp(),
  constraint evidence_agent_type_check check (agent_type in (
    'RESPONSE_INTERPRETATION',
    'EVIDENCE_CLASSIFICATION',
    'LONGITUDINAL_SYNTHESIS',
    'QUALITY_CONTRADICTION',
    'PROGRAMME_INSIGHT'
  )),
  constraint evidence_agent_disposition_check check (disposition in (
    'NOT_AVAILABLE','NOT_SUPPORTED','PROPOSED','REVIEW_REQUIRED','REVIEWED','REJECTED'
  )),
  constraint evidence_agent_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint evidence_agent_output_object_check check (jsonb_typeof(output) = 'object'),
  constraint evidence_agent_source_metadata_object_check check (jsonb_typeof(source_metadata) = 'object')
);

create index idx_evidence_agent_runs_subject_history
  on public.evidence_agent_runs(subject_user_id, lab_code, lab_version, created_at desc, id desc);
create index idx_evidence_agent_runs_evidence
  on public.evidence_agent_runs(evidence_id, created_at desc, id desc);
create index idx_evidence_agent_runs_review
  on public.evidence_agent_runs(requires_human_review, disposition, created_at desc)
  where requires_human_review = true;

alter table public.evidence_agent_runs enable row level security;
revoke all on table public.evidence_agent_runs from public, anon, authenticated;
grant select, insert on table public.evidence_agent_runs to service_role;

create or replace function private.evidence_agent_run_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Evidence agent runs are append-only.';
end
$$;

create trigger evidence_agent_run_immutable
before update or delete on public.evidence_agent_runs
for each row execute function private.evidence_agent_run_immutable();

revoke all on function private.evidence_agent_run_immutable() from public, anon, authenticated;

comment on table public.evidence_agent_runs is
  'Append-only derived AI analysis ledger. Contains no raw learner response text and never replaces original evidence or human assessment.';

-- Resolve one eligible free-text evidence item for model-assisted interpretation.
-- Access is limited to the learner who owns it, a SYSTEM_ADMIN, or the explicitly
-- assigned facilitator reviewing a current evidence submission. Sponsors never receive raw evidence here.
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
  from public.evidence_records
  where id = p_evidence_id
    and status = 'ACTIVE'
    and sensitivity in ('P0','P1','P2')
    and value is not null
    and btrim(value) <> ''
  limit 1;

  if e.id is null then
    raise exception 'Eligible evidence not found.';
  end if;

  if e.user_id = private.current_app_user_id() then
    v_allowed := exists(
      select 1
      from public.lab_enrollments le
      join public.learners l on l.user_id = le.user_id
      where le.id = e.enrolment_id
        and le.user_id = e.user_id
        and le.lab_code = e.lab_code
        and le.lab_version = e.lab_version
        and le.status = 'ACTIVE'
        and l.status = 'ACTIVE'
        and (
          select cr.status
          from public.consent_records cr
          where cr.user_id = e.user_id
            and cr.consent_type = 'LEARNER_PRODUCT'
          order by cr.created_at desc, cr.id desc
          limit 1
        ) = 'GRANTED'
    );
  elsif private.has_staff_role('SYSTEM_ADMIN') then
    v_allowed := true;
  elsif private.has_staff_role('FACILITATOR') then
    select s.cohort_id into v_cohort_id
    from public.evidence_submissions s
    join public.pilot_cohorts c on c.id = s.cohort_id
    where e.id = any(s.evidence_ids)
      and s.user_id = e.user_id
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
    'subjectUserId', e.user_id,
    'cohortId', v_cohort_id,
    'evidenceId', e.id,
    'labCode', e.lab_code,
    'labVersion', e.lab_version,
    'semanticFieldId', e.semantic_field_id,
    'questionLabel', coalesce(q.label, m.prompt_label),
    'portfolioPurpose', m.portfolio_purpose,
    'evidenceClass', m.evidence_class,
    'sensitivity', e.sensitivity,
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
  'Returns one explicitly eligible model-assisted free-text evidence context to its learner, assigned facilitator or system administrator. Sponsors are excluded.';
