-- BIS School Edition formative learning checks
-- Written check responses remain private workbook material (P3).
-- Only learner-selected support signals are exposed through aggregate cohort analytics.

create or replace function public.bis_save_workbook(p_release_id text, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user text := private.current_app_user_id();
  v_release public.content_releases%rowtype;
  v_item jsonb;
  v_previous public.responses%rowtype;
  v_id text;
  v_field text;
  v_step text;
  v_key text;
  v_value text;
  v_purpose text;
  v_check_id text;
  v_check_kind text;
  v_privacy text;
  v_prompt_id text;
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;

  if (
    select c.status
    from public.consent_records c
    where c.user_id = v_user
      and c.consent_type = 'LEARNER_PRODUCT'
    order by c.created_at desc
    limit 1
  ) is distinct from 'GRANTED' then
    raise exception 'Active learner consent is required.';
  end if;

  select r.*
    into v_release
  from public.content_releases r
  join public.learners l on l.delivery_edition = r.delivery_edition
  where r.id = p_release_id
    and l.user_id = v_user
    and r.status in ('PUBLISHED', 'CONTROLLED');

  if not found then
    raise exception 'This handbook release is unavailable for your edition.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 60 then
    raise exception 'Save between 1 and 60 responses.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user || ':' || p_release_id, 0)
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_field := v_item->>'semanticFieldId';
    v_step := v_item->>'semanticStepId';
    v_key := v_item->>'sourceFieldKey';
    v_value := v_item->>'value';
    v_purpose := coalesce(nullif(v_item->>'purpose', ''), 'LEARNING_RESPONSE');
    v_check_id := nullif(v_item->>'checkId', '');
    v_check_kind := nullif(v_item->>'checkKind', '');
    v_privacy := case when v_purpose = 'FORMATIVE_SIGNAL' then 'P2' else 'P3' end;

    if v_purpose not in ('LEARNING_RESPONSE', 'FORMATIVE_CHECK', 'FORMATIVE_SIGNAL') then
      raise exception 'Invalid workbook response purpose.';
    end if;

    if v_field is null
      or v_field !~ ('^' || v_release.lab_code || '\.WB\.[A-Z0-9._-]{3,160}$')
      or v_step is null
      or v_step !~ ('^' || v_release.lab_code || '\.PROGRAMME\.(WELCOME|DAY([1-9]|10)|WEEKEND|CERTIFICATE)$')
      or v_key is null
      or length(v_key) not between 1 and 120
      or v_value is null
      or length(v_value) > 20000 then
      raise exception 'Invalid workbook response.';
    end if;

    if v_purpose in ('FORMATIVE_CHECK', 'FORMATIVE_SIGNAL') then
      if v_check_id is null
        or v_check_id !~ '^[A-Z0-9_-]{3,64}$'
        or v_check_kind is null
        or v_check_kind not in ('RECALL','UNDERSTAND','DISTINGUISH','PREDICT','APPLY','CHALLENGE','CONFIDENCE') then
        raise exception 'Invalid formative check metadata.';
      end if;
    end if;

    if v_purpose = 'FORMATIVE_SIGNAL' then
      if v_field <> v_release.lab_code || '.WB.CHECK.' || v_check_id || '.SIGNAL'
        or v_value not in ('UNDERSTOOD','UNSURE','NEEDS_EXAMPLE') then
        raise exception 'Invalid formative learning signal.';
      end if;
    end if;

    select *
      into v_previous
    from public.responses
    where user_id = v_user
      and content_release_id = p_release_id
      and semantic_field_id = v_field
      and response_status <> 'SUPERSEDED'
    order by recorded_at desc, id desc
    limit 1;

    -- A retry of the same acknowledged value should not create response history twice.
    if found and v_previous.value = to_jsonb(v_value)::text then
      continue;
    end if;

    v_id := gen_random_uuid()::text;
    v_prompt_id :=
      'LEARNING:' || v_step || ':' || v_key ||
      case
        when v_purpose in ('FORMATIVE_CHECK','FORMATIVE_SIGNAL')
          then ':' || v_purpose || ':' || v_check_kind
        else ''
      end;

    insert into public.responses(
      id,
      user_id,
      prompt_id,
      semantic_field_id,
      lab_code,
      lab_version,
      content_release_id,
      delivery_edition,
      prompt_version,
      privacy_class,
      provenance,
      value,
      response_status,
      occurred_at,
      recorded_at,
      supersedes_response_id
    )
    values(
      v_id,
      v_user,
      v_prompt_id,
      v_field,
      v_release.lab_code,
      'HANDBOOK-' || v_release.content_version,
      p_release_id,
      v_release.delivery_edition,
      v_release.content_version,
      v_privacy,
      'LR',
      to_jsonb(v_value)::text,
      'ANSWERED',
      clock_timestamp(),
      clock_timestamp(),
      v_previous.id
    );

    if v_previous.id is not null then
      update public.responses
      set response_status = 'SUPERSEDED'
      where id = v_previous.id
        and user_id = v_user;
    end if;

    insert into public.audit_events(
      id,
      actor_id,
      action,
      object_type,
      object_id,
      metadata
    )
    values(
      gen_random_uuid()::text,
      v_user,
      'HANDBOOK_RESPONSE_SAVED',
      case when v_purpose = 'FORMATIVE_SIGNAL' then 'LEARNING_CHECK_SIGNAL' else 'LEARNING_RESPONSE' end,
      v_id,
      jsonb_build_object(
        'labCode', v_release.lab_code,
        'semanticFieldId', v_field,
        'semanticStepId', v_step,
        'contentReleaseId', p_release_id,
        'provenance', 'LR',
        'privacyClass', v_privacy,
        'responseClass', v_purpose,
        'checkId', v_check_id,
        'checkKind', v_check_kind
      )::text
    );
  end loop;
end;
$$;

revoke all on function public.bis_save_workbook(text, jsonb) from public, anon;
grant execute on function public.bis_save_workbook(text, jsonb) to authenticated;


create or replace function public.facilitator_cohort_learning_checks(target_cohort_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lab_code text;
  v_member_count integer;
  v_signal_count integer;
  v_understood integer;
  v_unsure integer;
  v_needs_example integer;
  v_by_day jsonb;
  v_by_kind jsonb;
begin
  select c.lab_code
    into v_lab_code
  from public.pilot_cohorts c
  where c.id = target_cohort_id
    and c.status = 'ACTIVE'
    and private.can_manage_cohort(c.id)
  limit 1;

  if not found then
    raise insufficient_privilege using message = 'You do not have access to this programme learning view.';
  end if;

  select count(*)::integer
    into v_member_count
  from public.cohort_members m
  where m.cohort_id = target_cohort_id
    and m.status = 'ACTIVE';

  with signals as (
    select r.user_id, r.prompt_id, r.value
    from public.responses r
    join public.cohort_members m
      on m.learner_user_id = r.user_id
     and m.cohort_id = target_cohort_id
     and m.status = 'ACTIVE'
    where r.lab_code = v_lab_code
      and r.provenance = 'LR'
      and r.response_status <> 'SUPERSEDED'
      and r.semantic_field_id like v_lab_code || '.WB.CHECK.%.SIGNAL'
      and split_part(r.prompt_id, ':', 4) = 'FORMATIVE_SIGNAL'
      and r.value in ('"UNDERSTOOD"','"UNSURE"','"NEEDS_EXAMPLE"')
  )
  select
    count(*)::integer,
    count(*) filter (where value = '"UNDERSTOOD"')::integer,
    count(*) filter (where value = '"UNSURE"')::integer,
    count(*) filter (where value = '"NEEDS_EXAMPLE"')::integer
  into v_signal_count, v_understood, v_unsure, v_needs_example
  from signals;

  with signals as (
    select
      split_part(r.prompt_id, ':', 2) as semantic_step_id,
      r.value
    from public.responses r
    join public.cohort_members m
      on m.learner_user_id = r.user_id
     and m.cohort_id = target_cohort_id
     and m.status = 'ACTIVE'
    where r.lab_code = v_lab_code
      and r.provenance = 'LR'
      and r.response_status <> 'SUPERSEDED'
      and r.semantic_field_id like v_lab_code || '.WB.CHECK.%.SIGNAL'
      and split_part(r.prompt_id, ':', 4) = 'FORMATIVE_SIGNAL'
      and r.value in ('"UNDERSTOOD"','"UNSURE"','"NEEDS_EXAMPLE"')
  ),
  grouped as (
    select
      semantic_step_id,
      count(*)::integer as signals_recorded,
      count(*) filter (where value = '"UNDERSTOOD"')::integer as understood,
      count(*) filter (where value = '"UNSURE"')::integer as unsure,
      count(*) filter (where value = '"NEEDS_EXAMPLE"')::integer as needs_example
    from signals
    group by semantic_step_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'semanticStepId', semantic_step_id,
        'signalsRecorded', signals_recorded,
        'understood', understood,
        'unsure', unsure,
        'needsExample', needs_example,
        'understoodRate', case when signals_recorded = 0 then null else round((understood * 100.0) / signals_recorded, 1) end,
        'supportSignalRate', case when signals_recorded = 0 then null else round(((unsure + needs_example) * 100.0) / signals_recorded, 1) end
      )
      order by semantic_step_id
    ),
    '[]'::jsonb
  )
  into v_by_day
  from grouped;

  with signals as (
    select
      split_part(r.prompt_id, ':', 5) as check_kind,
      r.value
    from public.responses r
    join public.cohort_members m
      on m.learner_user_id = r.user_id
     and m.cohort_id = target_cohort_id
     and m.status = 'ACTIVE'
    where r.lab_code = v_lab_code
      and r.provenance = 'LR'
      and r.response_status <> 'SUPERSEDED'
      and r.semantic_field_id like v_lab_code || '.WB.CHECK.%.SIGNAL'
      and split_part(r.prompt_id, ':', 4) = 'FORMATIVE_SIGNAL'
      and r.value in ('"UNDERSTOOD"','"UNSURE"','"NEEDS_EXAMPLE"')
  ),
  grouped as (
    select
      check_kind,
      count(*)::integer as signals_recorded,
      count(*) filter (where value = '"UNDERSTOOD"')::integer as understood,
      count(*) filter (where value in ('"UNSURE"','"NEEDS_EXAMPLE"'))::integer as support_signals
    from signals
    where check_kind <> ''
    group by check_kind
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'checkKind', check_kind,
        'signalsRecorded', signals_recorded,
        'understood', understood,
        'supportSignals', support_signals
      )
      order by check_kind
    ),
    '[]'::jsonb
  )
  into v_by_kind
  from grouped;

  return jsonb_build_object(
    'cohortId', target_cohort_id,
    'participantCount', v_member_count,
    'signalsRecorded', coalesce(v_signal_count, 0),
    'understood', coalesce(v_understood, 0),
    'unsure', coalesce(v_unsure, 0),
    'needsExample', coalesce(v_needs_example, 0),
    'understoodRate',
      case when coalesce(v_signal_count, 0) = 0 then null
        else round((v_understood * 100.0) / v_signal_count, 1)
      end,
    'supportSignalRate',
      case when coalesce(v_signal_count, 0) = 0 then null
        else round(((v_unsure + v_needs_example) * 100.0) / v_signal_count, 1)
      end,
    'byDay', v_by_day,
    'byKind', v_by_kind,
    'interpretationBoundary', jsonb_build_object(
      'learnerReportedNotScored', true,
      'excludedFromBEI', true,
      'note', 'These signals show learner-reported understanding after formative checks. They are not marks, BEI evidence, psychometric scores, or proof of concept mastery.'
    )
  );
end;
$$;

revoke all on function public.facilitator_cohort_learning_checks(text) from public, anon;
grant execute on function public.facilitator_cohort_learning_checks(text) to authenticated;


create or replace function public.sponsor_cohort_learning_checks(target_cohort_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lab_code text;
  v_member_count integer;
  v_signal_count integer;
  v_understood integer;
  v_unsure integer;
  v_needs_example integer;
  v_by_day jsonb;
begin
  select c.lab_code
    into v_lab_code
  from public.pilot_cohorts c
  where c.id = target_cohort_id
    and c.status = 'ACTIVE'
  limit 1;

  if not found then
    raise exception 'Active cohort not found.';
  end if;

  if not private.can_view_sponsor_cohort(target_cohort_id) then
    raise insufficient_privilege using message = 'You do not have access to this programme learning view.';
  end if;

  select count(*)::integer
    into v_member_count
  from public.cohort_members m
  where m.cohort_id = target_cohort_id
    and m.status = 'ACTIVE';

  if v_member_count < 5 then
    return jsonb_build_object(
      'cohortId', target_cohort_id,
      'suppressed', true,
      'participantCount', v_member_count,
      'minimumReportableCohortSize', 5,
      'signalsRecorded', null,
      'understoodRate', null,
      'supportSignalRate', null,
      'byDay', '[]'::jsonb,
      'interpretationBoundary', jsonb_build_object(
        'learnerReportedNotScored', true,
        'excludedFromBEI', true,
        'note', 'Learning-check signals are suppressed for cohorts smaller than five learners.'
      )
    );
  end if;

  with signals as (
    select r.prompt_id, r.value
    from public.responses r
    join public.cohort_members m
      on m.learner_user_id = r.user_id
     and m.cohort_id = target_cohort_id
     and m.status = 'ACTIVE'
    where r.lab_code = v_lab_code
      and r.provenance = 'LR'
      and r.response_status <> 'SUPERSEDED'
      and r.semantic_field_id like v_lab_code || '.WB.CHECK.%.SIGNAL'
      and split_part(r.prompt_id, ':', 4) = 'FORMATIVE_SIGNAL'
      and r.value in ('"UNDERSTOOD"','"UNSURE"','"NEEDS_EXAMPLE"')
  )
  select
    count(*)::integer,
    count(*) filter (where value = '"UNDERSTOOD"')::integer,
    count(*) filter (where value = '"UNSURE"')::integer,
    count(*) filter (where value = '"NEEDS_EXAMPLE"')::integer
  into v_signal_count, v_understood, v_unsure, v_needs_example
  from signals;

  with signals as (
    select
      split_part(r.prompt_id, ':', 2) as semantic_step_id,
      r.value
    from public.responses r
    join public.cohort_members m
      on m.learner_user_id = r.user_id
     and m.cohort_id = target_cohort_id
     and m.status = 'ACTIVE'
    where r.lab_code = v_lab_code
      and r.provenance = 'LR'
      and r.response_status <> 'SUPERSEDED'
      and r.semantic_field_id like v_lab_code || '.WB.CHECK.%.SIGNAL'
      and split_part(r.prompt_id, ':', 4) = 'FORMATIVE_SIGNAL'
      and r.value in ('"UNDERSTOOD"','"UNSURE"','"NEEDS_EXAMPLE"')
  ),
  grouped as (
    select
      semantic_step_id,
      count(*)::integer as signals_recorded,
      count(*) filter (where value = '"UNDERSTOOD"')::integer as understood,
      count(*) filter (where value in ('"UNSURE"','"NEEDS_EXAMPLE"'))::integer as support_signals
    from signals
    group by semantic_step_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'semanticStepId', semantic_step_id,
        'signalsRecorded', signals_recorded,
        'understoodRate', case when signals_recorded = 0 then null else round((understood * 100.0) / signals_recorded, 1) end,
        'supportSignalRate', case when signals_recorded = 0 then null else round((support_signals * 100.0) / signals_recorded, 1) end
      )
      order by semantic_step_id
    ),
    '[]'::jsonb
  )
  into v_by_day
  from grouped;

  return jsonb_build_object(
    'cohortId', target_cohort_id,
    'suppressed', false,
    'participantCount', v_member_count,
    'minimumReportableCohortSize', 5,
    'signalsRecorded', coalesce(v_signal_count, 0),
    'understoodRate',
      case when coalesce(v_signal_count, 0) = 0 then null
        else round((v_understood * 100.0) / v_signal_count, 1)
      end,
    'supportSignalRate',
      case when coalesce(v_signal_count, 0) = 0 then null
        else round(((v_unsure + v_needs_example) * 100.0) / v_signal_count, 1)
      end,
    'byDay', v_by_day,
    'interpretationBoundary', jsonb_build_object(
      'learnerReportedNotScored', true,
      'excludedFromBEI', true,
      'descriptiveNotCausal', true,
      'note', 'These aggregate learning-check signals describe self-reported understanding during programme delivery. They are not marks, BEI evidence, psychometric scores, or causal impact estimates.'
    )
  );
end;
$$;

revoke all on function public.sponsor_cohort_learning_checks(text) from public, anon;
grant execute on function public.sponsor_cohort_learning_checks(text) to authenticated;

comment on function public.facilitator_cohort_learning_checks(text) is
  'Cohort-level formative support signals for facilitators. Never returns private workbook response text.';
comment on function public.sponsor_cohort_learning_checks(text) is
  'Privacy-thresholded aggregate formative learning signals for authorised programme sponsors.';
