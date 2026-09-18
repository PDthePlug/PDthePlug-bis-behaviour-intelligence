-- BIS Programme Outcomes / Sponsor View
-- Aggregate-only cohort reporting. No learner names, emails, reflection text,
-- hypotheses, experiment notes, or private response values leave this function.

create or replace function private.can_view_sponsor_cohort(target_cohort_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    private.has_staff_role('SYSTEM_ADMIN')
    or exists (
      select 1
      from public.role_assignments r
      where r.status = 'ACTIVE'
        and r.role = 'SPONSOR_VIEWER'
        and r.scope_type = 'COHORT'
        and r.scope_id = target_cohort_id
        and (
          lower(r.principal_email) = private.current_email()
          or r.user_id = private.current_app_user_id()
        )
    )
  )
$$;

revoke all on function private.can_view_sponsor_cohort(text) from public, anon;
grant execute on function private.can_view_sponsor_cohort(text) to authenticated;

create or replace function public.sponsor_cohort_outcomes(target_cohort_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.sponsor_cohort_outcomes(text) from public, anon;
grant execute on function public.sponsor_cohort_outcomes(text) to authenticated;

comment on function private.can_view_sponsor_cohort(text) is
  'Authorizes aggregate sponsor reporting for a cohort-scoped SPONSOR_VIEWER or system administrator.';

comment on function public.sponsor_cohort_outcomes(text) is
  'Aggregate-only BIS programme outcomes. Never returns learner identity, reflection text, hypotheses, event notes, or private response values.';
