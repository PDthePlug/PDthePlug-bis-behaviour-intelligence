-- BIS Programme Outcomes — Deeper Analysis
-- Adds aggregate experiment context for sponsors without exposing learner wording.
-- Experiment themes come only from the fixed learner-selected impact domain taxonomy.
-- Small theme cells are suppressed independently of the cohort-level threshold.

create or replace function public.sponsor_cohort_deeper_analysis(target_cohort_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.sponsor_cohort_deeper_analysis(text) from public, anon;
grant execute on function public.sponsor_cohort_deeper_analysis(text) to authenticated;

comment on function public.sponsor_cohort_deeper_analysis(text) is
  'Privacy-preserving aggregate experiment landscape for sponsors. Uses only fixed structured impact-domain tags and suppresses cells under three participants.';
