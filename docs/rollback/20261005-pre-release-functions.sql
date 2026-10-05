-- Captured production function definitions before the BIS completion prerequisites.
-- Administrative rollback reference; restoration requires the corresponding view/schema review.

CREATE OR REPLACE FUNCTION private.staff_experiment_progress_rows()
 RETURNS TABLE(id text, user_id text, status text, start_date date, planned_end_date date, actual_end_date date, minimum_evidence_threshold integer, created_at timestamp with time zone, lab_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    e.id,
    e.user_id,
    e.status,
    e.start_date,
    e.planned_end_date,
    e.actual_end_date,
    e.minimum_evidence_threshold,
    e.created_at,
    e.lab_code
  from public.experiments e
  where private.can_view_learner(e.user_id)
$function$
;

CREATE OR REPLACE FUNCTION private.sponsor_cohort_deeper_analysis(target_cohort_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lab_code text;
  v_member_count integer;
  v_started_count integer;
  v_tagged_participants integer;
  v_suppressed_theme_count integer;
  v_themes jsonb;
  v_archetype jsonb;
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
    raise insufficient_privilege using message = 'You do not have access to this programme analysis.';
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
      'minimumReportableThemeSize', 3,
      'experimentLandscape', null
    );
  end if;

  v_archetype :=
    case v_lab_code
      when 'HAB' then jsonb_build_object(
        'code', 'HABIT_REPLACEMENT',
        'label', 'Habit replacement experiments',
        'description', 'Participants test whether a chosen alternative can interrupt an automatic pattern when a target condition occurs.'
      )
      when 'DEC' then jsonb_build_object(
        'code', 'DECISION_PAUSE',
        'label', 'Decision pause experiments',
        'description', 'Participants test whether a deliberate pause changes decision behaviour and creates room for additional options.'
      )
      when 'MON' then jsonb_build_object(
        'code', 'SPENDING_PAUSE',
        'label', 'Spending pause experiments',
        'description', 'Participants test whether a deliberate pause before purchase changes spending behaviour or the eventual purchase outcome.'
      )
      else jsonb_build_object(
        'code', 'BEHAVIOURAL_EXPERIMENT',
        'label', 'Behavioural experiments',
        'description', 'Participants test a defined behavioural hypothesis in real-world situations.'
      )
    end;

  with members as (
    select m.learner_user_id as user_id
    from public.cohort_members m
    where m.cohort_id = target_cohort_id
      and m.status = 'ACTIVE'
  ),
  latest_experiment as (
    select distinct on (e.user_id)
      e.user_id,
      e.impact_domains,
      e.created_at
    from public.experiments e
    join members m on m.user_id = e.user_id
    where e.lab_code = v_lab_code
    order by e.user_id, e.created_at desc
  ),
  allowed_domains(domain_key, domain_label) as (
    values
      ('Health'::text, 'Health and wellbeing'::text),
      ('Money'::text, 'Money and spending'::text),
      ('Relationships'::text, 'Relationships and social context'::text),
      ('School'::text, 'School and learning'::text),
      ('Work'::text, 'Work routines and performance'::text),
      ('Mental wellbeing'::text, 'Mental wellbeing and self-regulation'::text)
  ),
  exploded as (
    select distinct
      e.user_id,
      d.domain_key,
      d.domain_label
    from latest_experiment e
    cross join lateral jsonb_array_elements_text(
      coalesce(nullif(e.impact_domains, ''), '[]')::jsonb
    ) raw(domain_value)
    join allowed_domains d on d.domain_key = raw.domain_value
  ),
  theme_counts as (
    select
      domain_key,
      domain_label,
      count(distinct user_id)::integer as participants
    from exploded
    group by domain_key, domain_label
  ),
  reportable_themes as (
    select
      domain_key,
      domain_label,
      participants,
      round((participants * 100.0) / nullif((select count(*) from latest_experiment), 0), 1) as share_of_started
    from theme_counts
    where participants >= 3
    order by participants desc, domain_label asc
  )
  select
    (select count(*)::integer from latest_experiment),
    (select count(distinct user_id)::integer from exploded),
    (select count(*)::integer from theme_counts where participants < 3),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', domain_key,
            'label', domain_label,
            'participants', participants,
            'shareOfStarted', share_of_started
          )
          order by participants desc, domain_label asc
        )
        from reportable_themes
      ),
      '[]'::jsonb
    )
  into
    v_started_count,
    v_tagged_participants,
    v_suppressed_theme_count,
    v_themes;

  return jsonb_build_object(
    'cohortId', target_cohort_id,
    'suppressed', false,
    'participantCount', v_member_count,
    'minimumReportableCohortSize', 5,
    'minimumReportableThemeSize', 3,
    'experimentLandscape', jsonb_build_object(
      'archetype', v_archetype,
      'participantsStarted', v_started_count,
      'participantsWithStructuredThemes', v_tagged_participants,
      'participantsWithoutStructuredThemes', greatest(v_started_count - v_tagged_participants, 0),
      'themes', v_themes,
      'suppressedSmallThemeCount', v_suppressed_theme_count,
      'themeSource', 'Learner-selected structured impact domains only'
    ),
    'interpretationBoundary', jsonb_build_object(
      'descriptiveNotCausal', true,
      'rawExperimentWordingExcluded', true,
      'note', 'Themes describe where experiments were situated. They do not prove why a behaviour occurred or whether the organisation caused it.'
    )
  );
end
$function$
;

CREATE OR REPLACE FUNCTION private.sponsor_cohort_learning_summary(target_cohort_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION private.sponsor_cohort_outcomes(target_cohort_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_name text;
  v_lab_code text;
  v_lab_version text;
  v_starts_on date;
  v_ends_on date;
  v_member_count integer;
  v_metrics jsonb;
begin
  select c.name, c.lab_code, c.lab_version, c.starts_on, c.ends_on
    into v_name, v_lab_code, v_lab_version, v_starts_on, v_ends_on
  from public.pilot_cohorts c
  where c.id = target_cohort_id
    and c.status = 'ACTIVE'
  limit 1;

  if not found then
    raise exception 'Active cohort not found.';
  end if;

  if not private.can_view_sponsor_cohort(target_cohort_id) then
    raise insufficient_privilege using message = 'You do not have access to this programme outcome view.';
  end if;

  select count(*)::integer
    into v_member_count
  from public.cohort_members m
  where m.cohort_id = target_cohort_id
    and m.status = 'ACTIVE';

  if v_member_count < 5 then
    return jsonb_build_object(
      'cohort', jsonb_build_object(
        'id', target_cohort_id,
        'name', v_name,
        'labCode', v_lab_code,
        'labVersion', v_lab_version,
        'startsOn', v_starts_on,
        'endsOn', v_ends_on
      ),
      'participantCount', v_member_count,
      'suppressed', true,
      'minimumReportableCohortSize', 5,
      'metrics', null
    );
  end if;

  with members as (
    select m.learner_user_id as user_id
    from public.cohort_members m
    where m.cohort_id = target_cohort_id
      and m.status = 'ACTIVE'
  ),
  latest_enrolment as (
    select distinct on (le.user_id)
      le.user_id,
      le.status,
      le.current_investigation,
      le.experiment_started_at,
      le.completed_at,
      le.updated_at
    from public.lab_enrollments le
    join members m on m.user_id = le.user_id
    where le.lab_code = v_lab_code
    order by le.user_id, le.updated_at desc
  ),
  latest_experiment as (
    select distinct on (e.user_id)
      e.id,
      e.user_id,
      e.status,
      e.predicted_value,
      e.minimum_evidence_threshold,
      e.start_date,
      e.planned_end_date,
      e.actual_end_date,
      e.created_at
    from public.experiments e
    join members m on m.user_id = e.user_id
    where e.lab_code = v_lab_code
    order by e.user_id, e.created_at desc
  ),
  event_rollup as (
    select
      e.user_id,
      count(ev.id)::integer as recorded_days,
      count(ev.id) filter (where ev.eligible_opportunity = true)::integer as eligible_count,
      count(ev.id) filter (
        where ev.eligible_opportunity = true and ev.alternative_used = true
      )::integer as alternative_count,
      (
        array_agg(ev.alternative_used order by ev.day_number)
        filter (where ev.eligible_opportunity = true and ev.alternative_used is not null)
      )[1] as first_response,
      (
        array_agg(ev.alternative_used order by ev.day_number desc)
        filter (where ev.eligible_opportunity = true and ev.alternative_used is not null)
      )[1] as last_response
    from latest_experiment e
    left join public.experiment_events ev on ev.experiment_id = e.id
    group by e.user_id
  ),
  measure_rollup as (
    select
      e.user_id,
      max((mv.value)::numeric) filter (
        where mv.code like '%.BEI06'
          and mv.status = 'VALUE'
          and mv.value ~ '^[0-9]+([.][0-9]+)?$'
      ) as actual_rate,
      max((mv.value)::numeric) filter (
        where mv.code like '%.BEI03'
          and mv.status = 'VALUE'
          and mv.value ~ '^[0-9]+([.][0-9]+)?$'
      ) as prediction_accuracy
    from latest_experiment e
    left join public.measurement_values mv on mv.experiment_id = e.id
    group by e.user_id
  ),
  participant_rollup as (
    select
      m.user_id,
      le.status as enrolment_status,
      coalesce(le.current_investigation, 0) as current_investigation,
      e.id as experiment_id,
      e.status as experiment_status,
      e.predicted_value,
      coalesce(e.minimum_evidence_threshold, 3) as minimum_evidence_threshold,
      coalesce(er.recorded_days, 0) as recorded_days,
      coalesce(er.eligible_count, 0) as eligible_count,
      coalesce(er.alternative_count, 0) as alternative_count,
      er.first_response,
      er.last_response,
      mr.actual_rate,
      mr.prediction_accuracy
    from members m
    left join latest_enrolment le on le.user_id = m.user_id
    left join latest_experiment e on e.user_id = m.user_id
    left join event_rollup er on er.user_id = m.user_id
    left join measure_rollup mr on mr.user_id = m.user_id
  ),
  support_rollup as (
    select
      count(s.id)::integer as request_count,
      count(distinct s.learner_user_id)::integer as participant_count
    from public.safeguarding_cases s
    join members m on m.user_id = s.learner_user_id
    where s.source_type = 'LEARNER_REQUEST'
  ),
  totals as (
    select
      count(*) filter (
        where current_investigation >= 6 or experiment_id is not null
      )::integer as reached_experiment_stage,
      count(*) filter (where experiment_id is not null)::integer as experiment_started,
      count(*) filter (
        where current_investigation >= 6 and experiment_id is null
      )::integer as ready_not_started,
      count(*) filter (where enrolment_status = 'COMPLETED')::integer as lab_completed,
      coalesce(sum(recorded_days), 0)::integer as observations_recorded,
      coalesce(sum(eligible_count), 0)::integer as eligible_opportunities,
      count(*) filter (
        where experiment_id is not null and eligible_count = 0
      )::integer as evidence_none,
      count(*) filter (
        where experiment_id is not null
          and eligible_count > 0
          and eligible_count < minimum_evidence_threshold
      )::integer as evidence_limited,
      count(*) filter (
        where experiment_id is not null
          and eligible_count >= minimum_evidence_threshold
      )::integer as evidence_sufficient,
      round((avg(predicted_value) filter (
        where experiment_id is not null
      ))::numeric, 1) as average_predicted_rate,
      round((avg(actual_rate) filter (
        where actual_rate is not null
      ))::numeric, 1) as average_actual_rate,
      round((avg(prediction_accuracy) filter (
        where prediction_accuracy is not null
      ))::numeric, 1) as average_prediction_accuracy,
      round((avg(100 - prediction_accuracy) filter (
        where prediction_accuracy is not null
      ))::numeric, 1) as average_prediction_gap,
      count(*) filter (
        where eligible_count >= 2
          and first_response is not null
          and last_response is not null
      )::integer as repeat_opportunity_participants,
      count(*) filter (
        where eligible_count >= 2
          and first_response = false
          and last_response = true
      )::integer as improved_later_response,
      count(*) filter (
        where eligible_count >= 2
          and first_response = true
          and last_response = false
      )::integer as changed_other_direction,
      count(*) filter (
        where eligible_count >= 2
          and first_response = last_response
      )::integer as same_later_response
    from participant_rollup
  )
  select jsonb_build_object(
    'completionContext', jsonb_build_object(
      'completed', t.lab_completed,
      'completionRate', round((t.lab_completed * 100.0) / nullif(v_member_count, 0), 1)
    ),
    'action', jsonb_build_object(
      'reachedExperimentStage', t.reached_experiment_stage,
      'startedExperiment', t.experiment_started,
      'readyButNotStarted', t.ready_not_started,
      'experimentAttemptRate', round((t.experiment_started * 100.0) / nullif(v_member_count, 0), 1)
    ),
    'prediction', jsonb_build_object(
      'averagePredictedRate', t.average_predicted_rate,
      'averageActualRate', t.average_actual_rate,
      'averagePredictionAccuracy', t.average_prediction_accuracy,
      'averagePredictionGap', t.average_prediction_gap
    ),
    'experiment', jsonb_build_object(
      'participantsStarted', t.experiment_started,
      'observationsRecorded', t.observations_recorded,
      'eligibleOpportunities', t.eligible_opportunities
    ),
    'evidence', jsonb_build_object(
      'sufficient', t.evidence_sufficient,
      'limited', t.evidence_limited,
      'none', t.evidence_none,
      'notEnoughYet', t.evidence_limited + t.evidence_none
    ),
    'change', jsonb_build_object(
      'repeatOpportunityParticipants', t.repeat_opportunity_participants,
      'improvedLaterResponse', t.improved_later_response,
      'changedOtherDirection', t.changed_other_direction,
      'sameLaterResponse', t.same_later_response
    ),
    'support', jsonb_build_object(
      'participantsRequestingHelp', s.participant_count,
      'supportRequests', s.request_count,
      'supportRequestRate', round((s.participant_count * 100.0) / nullif(v_member_count, 0), 1)
    )
  )
  into v_metrics
  from totals t
  cross join support_rollup s;

  return jsonb_build_object(
    'cohort', jsonb_build_object(
      'id', target_cohort_id,
      'name', v_name,
      'labCode', v_lab_code,
      'labVersion', v_lab_version,
      'startsOn', v_starts_on,
      'endsOn', v_ends_on
    ),
    'participantCount', v_member_count,
    'suppressed', false,
    'minimumReportableCohortSize', 5,
    'metrics', v_metrics
  );
end
$function$
;

CREATE OR REPLACE FUNCTION private.sponsor_cohort_organisational_learning(target_cohort_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lab_code text;
  v_member_count integer;
  v_handbook_active integer;
  v_reached_experiment integer;
  v_started_experiment integer;
  v_repeat_participants integer;
  v_completed integer;
  v_support_requests integer;
  v_support_acknowledged integer;
  v_support_resolved integer;
  v_checkpoint_participants integer;
  v_adjusted_participants integer;
  v_kept_participants integer;
  v_comparable_cohorts integer;
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
      'transition', null,
      'supportResponse', null,
      'adaptation', null,
      'comparison', null
    );
  end if;

  with members as (
    select m.learner_user_id as user_id
    from public.cohort_members m
    where m.cohort_id = target_cohort_id
      and m.status = 'ACTIVE'
  ),
  latest_enrolment as (
    select distinct on (le.user_id)
      le.user_id,
      le.status,
      le.current_investigation,
      le.updated_at
    from public.lab_enrollments le
    join members m on m.user_id = le.user_id
    where le.lab_code = v_lab_code
    order by le.user_id, le.updated_at desc
  ),
  latest_experiment as (
    select distinct on (e.user_id)
      e.id,
      e.user_id,
      e.created_at
    from public.experiments e
    join members m on m.user_id = e.user_id
    where e.lab_code = v_lab_code
    order by e.user_id, e.created_at desc
  ),
  event_rollup as (
    select
      e.user_id,
      count(ev.id) filter (where ev.eligible_opportunity = true)::integer as eligible_count
    from latest_experiment e
    left join public.experiment_events ev on ev.experiment_id = e.id
    group by e.user_id
  )
  select
    count(distinct hp.user_id)::integer,
    count(distinct le.user_id) filter (
      where le.current_investigation >= 6 or ex.id is not null
    )::integer,
    count(distinct ex.user_id)::integer,
    count(distinct er.user_id) filter (where er.eligible_count >= 2)::integer,
    count(distinct le.user_id) filter (where le.status = 'COMPLETED')::integer
  into
    v_handbook_active,
    v_reached_experiment,
    v_started_experiment,
    v_repeat_participants,
    v_completed
  from members m
  left join latest_enrolment le on le.user_id = m.user_id
  left join latest_experiment ex on ex.user_id = m.user_id
  left join event_rollup er on er.user_id = m.user_id
  left join public.handbook_progress hp
    on hp.user_id = m.user_id
   and hp.lab_code = v_lab_code;

  with members as (
    select m.learner_user_id as user_id
    from public.cohort_members m
    where m.cohort_id = target_cohort_id
      and m.status = 'ACTIVE'
  )
  select
    count(s.id)::integer,
    count(s.id) filter (where s.acknowledged_at is not null)::integer,
    count(s.id) filter (where s.resolved_at is not null)::integer
  into
    v_support_requests,
    v_support_acknowledged,
    v_support_resolved
  from public.safeguarding_cases s
  join members m on m.user_id = s.learner_user_id
  where s.source_type = 'LEARNER_REQUEST';

  with members as (
    select m.learner_user_id as user_id
    from public.cohort_members m
    where m.cohort_id = target_cohort_id
      and m.status = 'ACTIVE'
  ),
  latest_experiment as (
    select distinct on (e.user_id)
      e.id,
      e.user_id,
      e.created_at
    from public.experiments e
    join members m on m.user_id = e.user_id
    where e.lab_code = v_lab_code
    order by e.user_id, e.created_at desc
  )
  select
    count(distinct cp.user_id)::integer,
    count(distinct cp.user_id) filter (where cp.decision = 'ADJUST')::integer,
    count(distinct cp.user_id) filter (where cp.decision = 'KEEP')::integer
  into
    v_checkpoint_participants,
    v_adjusted_participants,
    v_kept_participants
  from public.experiment_checkpoints cp
  join latest_experiment e on e.id = cp.experiment_id;

  select count(*)::integer
    into v_comparable_cohorts
  from public.pilot_cohorts c
  where c.status = 'ACTIVE'
    and c.lab_code = v_lab_code
    and c.id <> target_cohort_id;

  return jsonb_build_object(
    'cohortId', target_cohort_id,
    'suppressed', false,
    'participantCount', v_member_count,
    'minimumReportableCohortSize', 5,
    'transition', jsonb_build_object(
      'participants', v_member_count,
      'activeInLearning', coalesce(v_handbook_active, 0),
      'reachedExperimentStage', coalesce(v_reached_experiment, 0),
      'startedExperiment', coalesce(v_started_experiment, 0),
      'repeatSituationParticipants', coalesce(v_repeat_participants, 0),
      'completed', coalesce(v_completed, 0)
    ),
    'supportResponse', jsonb_build_object(
      'requests', coalesce(v_support_requests, 0),
      'acknowledged', coalesce(v_support_acknowledged, 0),
      'resolved', coalesce(v_support_resolved, 0),
      'acknowledgementRate',
        case when coalesce(v_support_requests, 0) = 0 then null
          else round((v_support_acknowledged * 100.0) / v_support_requests, 1)
        end,
      'resolutionRate',
        case when coalesce(v_support_requests, 0) = 0 then null
          else round((v_support_resolved * 100.0) / v_support_requests, 1)
        end
    ),
    'adaptation', jsonb_build_object(
      'checkpointParticipants', coalesce(v_checkpoint_participants, 0),
      'adjustedParticipants', coalesce(v_adjusted_participants, 0),
      'keptPlanParticipants', coalesce(v_kept_participants, 0),
      'checkpointCoverageRate',
        case when coalesce(v_started_experiment, 0) = 0 then null
          else round((v_checkpoint_participants * 100.0) / v_started_experiment, 1)
        end,
      'adjustmentRate',
        case when coalesce(v_checkpoint_participants, 0) = 0 then null
          else round((v_adjusted_participants * 100.0) / v_checkpoint_participants, 1)
        end
    ),
    'comparison', jsonb_build_object(
      'comparableCohorts', coalesce(v_comparable_cohorts, 0),
      'baselineOnly', coalesce(v_comparable_cohorts, 0) = 0
    ),
    'interpretationBoundary', jsonb_build_object(
      'descriptiveNotCausal', true,
      'note', 'These signals describe programme delivery and participant behaviour. They do not prove why an outcome occurred or that BIS caused it.'
    )
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.learner_bis_lab_runtime(target_code text)
 RETURNS TABLE(item_id text, code text, slug text, title text, route_path text, version_id text, version text, runtime_mode text, artifact_key text, storage_path text, artifact_hash text, compiler_version text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with live as (
    select * from public.active_bis_lab_runtime(target_code)
  ), enrolled as (
    select i.id,i.code,i.slug,i.title,coalesce(i.route_path,'/labs/' || lower(i.code)) as route_path,
      v.id as version_id,v.version,'DYNAMIC'::text as runtime_mode,r.artifact_key,r.storage_path,r.artifact_hash,r.compiler_version
    from live l
    join public.content_library_items i on i.id=l.item_id
    join public.lab_enrollments e on e.user_id=private.current_app_user_id() and e.lab_code=i.code
      and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
    join public.content_library_versions v on v.item_id=i.id and v.version=e.lab_version
      and v.status='PUBLISHED' and v.runtime_status in ('LIVE','READY')
    join public.content_runtime_artifacts r on r.version_id=v.id and r.artifact_key='lab:universal'
    where auth.uid() is not null and exists (
      select 1 from public.content_runtime_activations a
      where a.version_id=v.id and a.runtime_mode='DYNAMIC'
    )
    order by e.updated_at desc,e.id desc limit 1
  )
  select * from enrolled
  union all select * from live where not exists(select 1 from enrolled);
$function$
;
