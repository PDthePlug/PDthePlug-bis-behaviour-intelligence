-- Preserve typed JSON rating observations and historical published question families.
-- Only active, consenting members contribute to current structured reporting.
create or replace function public.sponsor_cohort_question_patterns(target_cohort_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lab_code text;
  v_lab_version text;
  v_member_count integer;
  v_questions jsonb := '[]'::jsonb;
  q record;
  v_respondents integer;
  v_average numeric;
  v_categories jsonb;
  v_suppressed integer;
begin
  select c.lab_code, c.lab_version
    into v_lab_code, v_lab_version
  from public.pilot_cohorts c
  where c.id = target_cohort_id
    and c.status = 'ACTIVE'
  limit 1;

  if not found then
    raise exception 'Active cohort not found.';
  end if;

  if not private.can_view_sponsor_cohort(target_cohort_id) then
    raise insufficient_privilege using message = 'You do not have access to this programme analysis.';
  end if;

  select count(*)::integer
    into v_member_count
  from public.cohort_members m
  where m.cohort_id = target_cohort_id
    and m.status = 'ACTIVE'
    and exists(select 1 from public.learners l where l.user_id=m.learner_user_id and l.status='ACTIVE')
    and (select c.status from public.consent_records c where c.user_id=m.learner_user_id and c.consent_type='LEARNER_PRODUCT' order by c.created_at desc,c.id desc limit 1)='GRANTED';

  if v_member_count < 5 then
    return jsonb_build_object(
      'cohortId', target_cohort_id,
      'suppressed', true,
      'participantCount', v_member_count,
      'minimumReportableCohortSize', 5,
      'minimumReportableCellSize', 3,
      'questions', '[]'::jsonb,
      'privacyNote', 'Question-level patterns are hidden for groups smaller than five.'
    );
  end if;

  for q in
    select distinct on (r.semantic_field_id)
      r.semantic_field_id,
      r.question_family,
      r.label,
      r.evidence_class,
      r.answer_model
    from public.question_analysis_registry r
    where r.lab_code = v_lab_code
      and r.lab_version = v_lab_version
      and r.status in ('ACTIVE','RETIRED')
      and exists (select 1 from public.content_library_versions v where v.id=r.version_id and v.status='PUBLISHED')
      and r.aggregate_policy = 'STRUCTURED_ONLY'
      and r.sensitivity <> 'P3'
      and r.answer_model in ('INTEGER','BOOLEAN','CATEGORICAL','MULTI_SELECT')
    order by r.semantic_field_id, r.updated_at desc
  loop
    v_respondents := 0;
    v_average := null;
    v_categories := '[]'::jsonb;
    v_suppressed := 0;

    if q.answer_model = 'INTEGER' then
      with members as (
        select m.learner_user_id as user_id
        from public.cohort_members m
        where m.cohort_id = target_cohort_id
          and m.status = 'ACTIVE'
          and exists(select 1 from public.learners l where l.user_id=m.learner_user_id and l.status='ACTIVE')
          and (select c.status from public.consent_records c where c.user_id=m.learner_user_id and c.consent_type='LEARNER_PRODUCT' order by c.created_at desc,c.id desc limit 1)='GRANTED'
      ),
      latest as (
        select distinct on (r.user_id)
          r.user_id,
          r.value
        from public.responses r
        join members m on m.user_id = r.user_id
        where r.lab_code = v_lab_code
          and r.lab_version = v_lab_version
          and r.semantic_field_id = q.semantic_field_id
          and r.response_status = 'ANSWERED'
          and btrim(trim(both '"' from r.value)) ~ '^-?[0-9]+([.][0-9]+)?$'
        order by r.user_id, r.recorded_at desc
      )
      select count(*)::integer, round(avg(btrim(trim(both '"' from value))::numeric), 2)
        into v_respondents, v_average
      from latest;

      if v_respondents >= 3 then
        v_questions := v_questions || jsonb_build_array(
          jsonb_build_object(
            'semanticFieldId', q.semantic_field_id,
            'questionFamily', q.question_family,
            'label', q.label,
            'evidenceClass', q.evidence_class,
            'answerModel', q.answer_model,
            'respondents', v_respondents,
            'coverageRate', round((v_respondents * 100.0) / nullif(v_member_count,0), 1),
            'summary', jsonb_build_object(
              'type', 'NUMERIC',
              'average', v_average
            )
          )
        );
      end if;

    elsif q.answer_model in ('BOOLEAN','CATEGORICAL') then
      with members as (
        select m.learner_user_id as user_id
        from public.cohort_members m
        where m.cohort_id = target_cohort_id
          and m.status = 'ACTIVE'
          and exists(select 1 from public.learners l where l.user_id=m.learner_user_id and l.status='ACTIVE')
          and (select c.status from public.consent_records c where c.user_id=m.learner_user_id and c.consent_type='LEARNER_PRODUCT' order by c.created_at desc,c.id desc limit 1)='GRANTED'
      ),
      latest as (
        select distinct on (r.user_id)
          r.user_id,
          trim(both '"' from coalesce(r.value,'')) as answer
        from public.responses r
        join members m on m.user_id = r.user_id
        where r.lab_code = v_lab_code
          and r.lab_version = v_lab_version
          and r.semantic_field_id = q.semantic_field_id
          and r.response_status = 'ANSWERED'
        order by r.user_id, r.recorded_at desc
      ),
      counts as (
        select answer, count(*)::integer as participants
        from latest
        where answer <> ''
        group by answer
      ),
      reportable as (
        select answer, participants
        from counts
        where participants >= 3
        order by participants desc, answer
      )
      select
        (select count(*)::integer from latest where answer <> ''),
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'value', answer,
                'participants', participants,
                'shareOfRespondents', round((participants * 100.0) / nullif((select count(*) from latest where answer <> ''),0), 1)
              )
              order by participants desc, answer
            )
            from reportable
          ),
          '[]'::jsonb
        ),
        coalesce((select sum(participants)::integer from counts where participants < 3), 0)
      into v_respondents, v_categories, v_suppressed;

      if v_respondents >= 3 and jsonb_array_length(v_categories) > 0 then
        v_questions := v_questions || jsonb_build_array(
          jsonb_build_object(
            'semanticFieldId', q.semantic_field_id,
            'questionFamily', q.question_family,
            'label', q.label,
            'evidenceClass', q.evidence_class,
            'answerModel', q.answer_model,
            'respondents', v_respondents,
            'coverageRate', round((v_respondents * 100.0) / nullif(v_member_count,0), 1),
            'summary', jsonb_build_object(
              'type', 'CATEGORICAL',
              'categories', v_categories,
              'suppressedResponses', v_suppressed
            )
          )
        );
      end if;

    elsif q.answer_model = 'MULTI_SELECT' then
      with members as (
        select m.learner_user_id as user_id
        from public.cohort_members m
        where m.cohort_id = target_cohort_id
          and m.status = 'ACTIVE'
          and exists(select 1 from public.learners l where l.user_id=m.learner_user_id and l.status='ACTIVE')
          and (select c.status from public.consent_records c where c.user_id=m.learner_user_id and c.consent_type='LEARNER_PRODUCT' order by c.created_at desc,c.id desc limit 1)='GRANTED'
      ),
      latest as (
        select distinct on (r.user_id)
          r.user_id,
          r.value
        from public.responses r
        join members m on m.user_id = r.user_id
        where r.lab_code = v_lab_code
          and r.lab_version = v_lab_version
          and r.semantic_field_id = q.semantic_field_id
          and r.response_status = 'ANSWERED'
          and left(trim(r.value), 1) = '['
        order by r.user_id, r.recorded_at desc
      ),
      exploded as (
        select distinct
          l.user_id,
          option_value
        from latest l
        cross join lateral jsonb_array_elements_text(l.value::jsonb) option(option_value)
      ),
      counts as (
        select option_value, count(distinct user_id)::integer as participants
        from exploded
        group by option_value
      ),
      reportable as (
        select option_value, participants
        from counts
        where participants >= 3
        order by participants desc, option_value
      )
      select
        (select count(*)::integer from latest),
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'value', option_value,
                'participants', participants,
                'shareOfRespondents', round((participants * 100.0) / nullif((select count(*) from latest),0), 1)
              )
              order by participants desc, option_value
            )
            from reportable
          ),
          '[]'::jsonb
        ),
        coalesce((select sum(participants)::integer from counts where participants < 3), 0)
      into v_respondents, v_categories, v_suppressed;

      if v_respondents >= 3 and jsonb_array_length(v_categories) > 0 then
        v_questions := v_questions || jsonb_build_array(
          jsonb_build_object(
            'semanticFieldId', q.semantic_field_id,
            'questionFamily', q.question_family,
            'label', q.label,
            'evidenceClass', q.evidence_class,
            'answerModel', q.answer_model,
            'respondents', v_respondents,
            'coverageRate', round((v_respondents * 100.0) / nullif(v_member_count,0), 1),
            'summary', jsonb_build_object(
              'type', 'MULTI_SELECT',
              'categories', v_categories,
              'suppressedSelections', v_suppressed
            )
          )
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'cohortId', target_cohort_id,
    'suppressed', false,
    'participantCount', v_member_count,
    'minimumReportableCohortSize', 5,
    'minimumReportableCellSize', 3,
    'questions', v_questions,
    'privacyNote', 'Only questions registered for structured aggregation are included. Free-text and P3 responses are excluded; category cells under three participants are suppressed.'
  );
end
$$;

revoke all on function public.sponsor_cohort_question_patterns(text) from public, anon;
grant execute on function public.sponsor_cohort_question_patterns(text) to authenticated;

comment on function public.sponsor_cohort_question_patterns(text) is
  'Organisation-safe cross-participant patterns for governed structured questions. Free text is excluded and cells under three participants are suppressed.';
