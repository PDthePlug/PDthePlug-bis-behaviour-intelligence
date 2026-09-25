-- BIS Programme Design Insight / Organisational Learning
-- Aggregate-only cohort diagnostics for programme teams and sponsors.
-- No learner identity, response text, checkpoint wording, experiment notes, or support message content is returned.

create or replace function public.sponsor_cohort_organisational_learning(target_cohort_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.sponsor_cohort_organisational_learning(text) from public, anon;
grant execute on function public.sponsor_cohort_organisational_learning(text) to authenticated;

comment on function public.sponsor_cohort_organisational_learning(text) is
  'Privacy-preserving programme-design and organisational-learning signals for authorised cohort sponsors.';
