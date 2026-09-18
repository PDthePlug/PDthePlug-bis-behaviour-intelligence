-- BIS Programme Outcomes — learning journey context
-- Produces organisation-safe summaries from structured programme fields.
-- Never exposes free-text learner responses.

create or replace function public.sponsor_cohort_learning_summary(target_cohort_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lab_code text;
  v_member_count integer;
  v_days jsonb;
  v_baseline_themes jsonb;
  v_skill_shifts jsonb;
  v_activity jsonb;
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
    raise insufficient_privilege using message = 'You do not have access to this programme summary.';
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
      'learningJourney', null
    );
  end if;

  with members as (
    select m.learner_user_id as user_id
    from public.cohort_members m
    where m.cohort_id = target_cohort_id
      and m.status = 'ACTIVE'
  ),
  progress as (
    select
      hp.user_id,
      hp.semantic_step_id,
      hp.status
    from public.handbook_progress hp
    join members m on m.user_id = hp.user_id
    where hp.lab_code = v_lab_code
  ),
  day_numbers(day_number) as (
    values (1),(2),(3),(4),(5),(6),(7),(8),(9),(10)
  ),
  day_rollup as (
    select
      d.day_number,
      count(distinct p.user_id) filter (
        where p.semantic_step_id = v_lab_code || '.PROGRAMME.DAY' || d.day_number::text
          and p.status in ('STARTED','COMPLETED')
      )::integer as reached,
      count(distinct p.user_id) filter (
        where p.semantic_step_id = v_lab_code || '.PROGRAMME.DAY' || d.day_number::text
          and p.status = 'COMPLETED'
      )::integer as completed
    from day_numbers d
    left join progress p on true
    group by d.day_number
    order by d.day_number
  )
  select jsonb_agg(
    jsonb_build_object(
      'day', day_number,
      'reached', reached,
      'completed', completed,
      'reachedRate', round((reached * 100.0) / nullif(v_member_count,0),1),
      'completionRate', round((completed * 100.0) / nullif(v_member_count,0),1)
    )
    order by day_number
  )
  into v_days
  from day_rollup;

  if v_lab_code = 'HAB' then
    with members as (
      select m.learner_user_id as user_id
      from public.cohort_members m
      where m.cohort_id = target_cohort_id
        and m.status = 'ACTIVE'
    ),
    theme_map(field_id, label, area) as (
      values
        ('HAB.BASELINE.PROCRASTINATION'::text, 'Procrastination'::text, 'Follow-through'::text),
        ('HAB.BASELINE.PHONE_CHECKING'::text, 'Frequent phone checking'::text, 'Focus'::text),
        ('HAB.BASELINE.LATE_SLEEP'::text, 'Late sleep routines'::text, 'Routine'::text),
        ('HAB.BASELINE.MISSED_COMMITMENTS'::text, 'Missed commitments'::text, 'Follow-through'::text),
        ('HAB.BASELINE.IMPULSE_BUYING'::text, 'Impulse buying'::text, 'Impulse control'::text),
        ('HAB.BASELINE.STRESS_REACTION'::text, 'Automatic stress reactions'::text, 'Self-regulation'::text),
        ('HAB.BASELINE.GIVE_UP'::text, 'Giving up early'::text, 'Persistence'::text),
        ('HAB.BASELINE.UNFINISHED_PROJECTS'::text, 'Unfinished projects'::text, 'Follow-through'::text),
        ('HAB.BASELINE.SKIP_SELF_CARE'::text, 'Skipping self-care'::text, 'Routine'::text),
        ('HAB.BASELINE.EATING_NOT_HUNGRY'::text, 'Eating without hunger'::text, 'Automatic behaviour'::text)
    ),
    baseline as (
      select distinct on (r.user_id, r.semantic_field_id)
        r.user_id,
        r.semantic_field_id,
        trim(both '"' from coalesce(r.value,'')) as answer,
        case lower(trim(both '"' from coalesce(r.value,'')))
          when 'never' then 0
          when 'rarely' then 1
          when 'sometimes' then 2
          when 'often' then 3
          when 'always' then 4
          else null
        end as score
      from public.responses r
      join members m on m.user_id = r.user_id
      join theme_map tm on tm.field_id = r.semantic_field_id
      where r.lab_code = 'HAB'
        and r.response_status = 'ANSWERED'
      order by r.user_id, r.semantic_field_id, r.recorded_at desc
    ),
    theme_rollup as (
      select
        tm.field_id,
        tm.label,
        tm.area,
        count(b.user_id)::integer as respondents,
        count(b.user_id) filter (where b.score >= 3)::integer as frequent_count,
        round(avg(b.score)::numeric,2) as average_score
      from theme_map tm
      left join baseline b on b.semantic_field_id = tm.field_id
      group by tm.field_id, tm.label, tm.area
    ),
    reportable as (
      select *
      from theme_rollup
      where respondents >= 3
        and frequent_count >= 3
      order by frequent_count desc, average_score desc, label
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', field_id,
          'label', label,
          'area', area,
          'respondents', respondents,
          'frequentCount', frequent_count,
          'frequentShare', round((frequent_count * 100.0) / nullif(respondents,0),1),
          'averageScore', average_score,
          'scale', 'Never to Always'
        )
        order by frequent_count desc, average_score desc, label
      ),
      '[]'::jsonb
    )
    into v_baseline_themes
    from reportable;

    with members as (
      select m.learner_user_id as user_id
      from public.cohort_members m
      where m.cohort_id = target_cohort_id
        and m.status = 'ACTIVE'
    ),
    latest as (
      select distinct on (r.user_id, r.semantic_field_id)
        r.user_id,
        r.semantic_field_id,
        case when r.value ~ '^-?[0-9]+([.][0-9]+)?$' then r.value::numeric else null end as value
      from public.responses r
      join members m on m.user_id = r.user_id
      where r.lab_code = 'HAB'
        and r.semantic_field_id in (
          'HAB.CONTROL.PRE','HAB.CONTROL.POST',
          'HAB.EQUATION.CONFIDENCE_PRE','HAB.EQUATION.CONFIDENCE_POST'
        )
        and r.response_status = 'ANSWERED'
      order by r.user_id, r.semantic_field_id, r.recorded_at desc
    ),
    paired as (
      select
        user_id,
        max(value) filter (where semantic_field_id='HAB.CONTROL.PRE') as control_pre,
        max(value) filter (where semantic_field_id='HAB.CONTROL.POST') as control_post,
        max(value) filter (where semantic_field_id='HAB.EQUATION.CONFIDENCE_PRE') as confidence_pre,
        max(value) filter (where semantic_field_id='HAB.EQUATION.CONFIDENCE_POST') as confidence_post
      from latest
      group by user_id
    ),
    shifts as (
      select *
      from (
        select
          'perceived_control'::text as id,
          'Perceived control'::text as label,
          count(*) filter (where control_pre is not null and control_post is not null)::integer as paired_count,
          round(avg(control_pre) filter (where control_pre is not null and control_post is not null),2) as average_pre,
          round(avg(control_post) filter (where control_pre is not null and control_post is not null),2) as average_post,
          round(avg(control_post-control_pre) filter (where control_pre is not null and control_post is not null),2) as average_shift
        from paired
        union all
        select
          'pattern_understanding'::text,
          'Confidence understanding the pattern'::text,
          count(*) filter (where confidence_pre is not null and confidence_post is not null)::integer,
          round(avg(confidence_pre) filter (where confidence_pre is not null and confidence_post is not null),2),
          round(avg(confidence_post) filter (where confidence_pre is not null and confidence_post is not null),2),
          round(avg(confidence_post-confidence_pre) filter (where confidence_pre is not null and confidence_post is not null),2)
        from paired
      ) s
      where paired_count >= 3
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'label', label,
          'pairedParticipants', paired_count,
          'averagePre', average_pre,
          'averagePost', average_post,
          'averageShift', average_shift
        )
        order by id
      ),
      '[]'::jsonb
    )
    into v_skill_shifts
    from shifts;
  else
    v_baseline_themes := '[]'::jsonb;
    v_skill_shifts := '[]'::jsonb;
  end if;

  with members as (
    select m.learner_user_id as user_id
    from public.cohort_members m
    where m.cohort_id = target_cohort_id
      and m.status = 'ACTIVE'
  ),
  activity as (
    select
      (select count(distinct hp.user_id)::integer
       from public.handbook_progress hp
       join members m on m.user_id=hp.user_id
       where hp.lab_code=v_lab_code) as handbook_participants,
      (select count(distinct r.user_id)::integer
       from public.responses r
       join members m on m.user_id=r.user_id
       where r.lab_code=v_lab_code and r.response_status='ANSWERED') as response_participants,
      (select count(*)::integer
       from public.responses r
       join members m on m.user_id=r.user_id
       where r.lab_code=v_lab_code and r.response_status='ANSWERED') as structured_responses
  )
  select jsonb_build_object(
    'participantsWithHandbookActivity', handbook_participants,
    'participantsWithStructuredResponses', response_participants,
    'structuredResponsesRecorded', structured_responses
  )
  into v_activity
  from activity;

  return jsonb_build_object(
    'cohortId', target_cohort_id,
    'suppressed', false,
    'participantCount', v_member_count,
    'learningJourney', jsonb_build_object(
      'days', coalesce(v_days,'[]'::jsonb),
      'baselineThemes', coalesce(v_baseline_themes,'[]'::jsonb),
      'skillShifts', coalesce(v_skill_shifts,'[]'::jsonb),
      'activity', v_activity,
      'privacyNote', 'Only structured group fields are used. Free-text reflections are excluded.'
    )
  );
end
$$;

revoke all on function public.sponsor_cohort_learning_summary(text) from public, anon;
grant execute on function public.sponsor_cohort_learning_summary(text) to authenticated;

comment on function public.sponsor_cohort_learning_summary(text) is
  'Organisation-safe learning journey summary using programme progress, structured baseline fields and paired pre/post measures. Free-text response content is excluded.';
