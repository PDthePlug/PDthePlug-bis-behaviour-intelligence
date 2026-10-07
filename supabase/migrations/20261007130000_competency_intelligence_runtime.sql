-- BIS competency intelligence runtime
-- Aggregate-only cohort development reporting. This function never returns
-- learner identity, response wording, reflection text, experiment notes or
-- private P3 evidence.

create or replace function private.can_view_competency_cohort(target_cohort_id text)
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
        and r.role in ('SPONSOR_VIEWER','PROGRAMME_OWNER','FACILITATOR')
        and r.scope_type = 'COHORT'
        and r.scope_id = target_cohort_id
        and (
          lower(r.principal_email) = private.current_email()
          or r.user_id = private.current_app_user_id()
        )
    )
    or exists (
      select 1
      from public.pilot_cohorts c
      where c.id = target_cohort_id
        and c.status = 'ACTIVE'
        and lower(c.facilitator_email) = private.current_email()
    )
  )
$$;

revoke all on function private.can_view_competency_cohort(text) from public, anon, authenticated;

create or replace function public.bis_cohort_competency_summary(target_cohort_id text)
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
  v_competencies jsonb;
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

  if not private.can_view_competency_cohort(target_cohort_id) then
    raise insufficient_privilege using message = 'You do not have access to this development view.';
  end if;

  select count(*)::integer
    into v_member_count
  from public.cohort_members m
  where m.cohort_id = target_cohort_id
    and m.status = 'ACTIVE';

  if v_member_count < 5 then
    return jsonb_build_object(
      'status', 'SUPPRESSED',
      'participantCount', v_member_count,
      'minimumReportableCohortSize', 5,
      'minimumReportableCellSize', 3,
      'competencies', '[]'::jsonb,
      'boundary', 'Group development appears only when privacy thresholds are met.'
    );
  end if;

  with members as (
    select m.learner_user_id as user_id
    from public.cohort_members m
    where m.cohort_id = target_cohort_id
      and m.status = 'ACTIVE'
      and exists (
        select 1
        from public.consent_records cr
        where cr.user_id = m.learner_user_id
          and cr.consent_type = 'LEARNER_PRODUCT'
          and cr.status = 'GRANTED'
          and cr.id = (
            select cr2.id
            from public.consent_records cr2
            where cr2.user_id = m.learner_user_id
              and cr2.consent_type = 'LEARNER_PRODUCT'
            order by cr2.created_at desc, cr2.id desc
            limit 1
          )
      )
  ),
  latest_mapping as (
    select distinct on (m.lab_code, m.lab_version, m.semantic_field_id)
      m.lab_code,
      m.lab_version,
      m.semantic_field_id,
      m.evidence_class,
      m.competency,
      m.classification_status
    from public.curriculum_evidence_mappings m
    where m.lab_code = v_lab_code
      and m.lab_version = v_lab_version
    order by m.lab_code, m.lab_version, m.semantic_field_id, m.created_at desc, m.id desc
  ),
  eligible as (
    select
      e.user_id,
      lm.competency,
      lm.evidence_class
    from public.evidence_records e
    join members members on members.user_id = e.user_id
    join latest_mapping lm
      on lm.lab_code = e.lab_code
      and lm.lab_version = e.lab_version
      and lm.semantic_field_id = e.semantic_field_id
    where e.lab_code = v_lab_code
      and e.lab_version = v_lab_version
      and e.status = 'ACTIVE'
      and e.sensitivity in ('P0','P1','P2')
      and lm.classification_status = 'APPROVED'
      and lm.competency is not null
      and btrim(lm.competency) <> ''
      and lm.evidence_class <> 'UNCLASSIFIED'
  ),
  per_learner as (
    select
      user_id,
      competency,
      bool_or(evidence_class = 'TRANSFER') as has_transfer,
      bool_or(evidence_class <> 'TRANSFER') as has_non_transfer,
      bool_or(evidence_class in ('PLAN','OBSERVATION','OUTCOME')) as has_apply,
      bool_or(evidence_class in ('LEARNING_CHECK','INTERPRETATION')) as has_explain,
      bool_or(evidence_class in ('BASELINE','CONTEXT','OBSERVATION','LEARNING_CHECK')) as has_notice
    from eligible
    group by user_id, competency
  ),
  levelled as (
    select
      user_id,
      competency,
      case
        when has_transfer and has_non_transfer then 5
        when has_apply then 3
        when has_explain then 2
        when has_notice then 1
        else 0
      end as level
    from per_learner
  ),
  competency_list as (
    select distinct competency
    from levelled
  ),
  counts as (
    select
      c.competency,
      count(l.user_id) filter (where l.level > 0)::integer as reportable,
      count(l.user_id) filter (where l.level = 1)::integer as notice_count,
      count(l.user_id) filter (where l.level = 2)::integer as explain_count,
      count(l.user_id) filter (where l.level = 3)::integer as apply_count,
      count(l.user_id) filter (where l.level = 4)::integer as revise_count,
      count(l.user_id) filter (where l.level = 5)::integer as transfer_count
    from competency_list c
    left join levelled l on l.competency = c.competency
    group by c.competency
  ),
  rows as (
    select jsonb_build_object(
      'competency', c.competency,
      'reportableParticipants',
        case when c.reportable = 0 or c.reportable >= 3 then c.reportable else null end,
      'participantsWithRecordedProgression', null,
      'distribution', jsonb_build_array(
        jsonb_build_object(
          'code','NOT_YET_EVIDENCED',
          'label','Not yet evidenced',
          'count', case
            when greatest(v_member_count - c.reportable, 0) = 0 or greatest(v_member_count - c.reportable, 0) >= 3
              then greatest(v_member_count - c.reportable, 0)
            else null
          end,
          'denominator', v_member_count,
          'suppressed', greatest(v_member_count - c.reportable, 0) between 1 and 2
        ),
        jsonb_build_object(
          'code','NOTICE',
          'label','Notices',
          'count', case when c.notice_count = 0 or c.notice_count >= 3 then c.notice_count else null end,
          'denominator', v_member_count,
          'suppressed', c.notice_count between 1 and 2
        ),
        jsonb_build_object(
          'code','EXPLAIN',
          'label','Explains',
          'count', case when c.explain_count = 0 or c.explain_count >= 3 then c.explain_count else null end,
          'denominator', v_member_count,
          'suppressed', c.explain_count between 1 and 2
        ),
        jsonb_build_object(
          'code','APPLY',
          'label','Applies',
          'count', case when c.apply_count = 0 or c.apply_count >= 3 then c.apply_count else null end,
          'denominator', v_member_count,
          'suppressed', c.apply_count between 1 and 2
        ),
        jsonb_build_object(
          'code','TEST_AND_REVISE',
          'label','Tests and revises',
          'count', case when c.revise_count = 0 or c.revise_count >= 3 then c.revise_count else null end,
          'denominator', v_member_count,
          'suppressed', c.revise_count between 1 and 2
        ),
        jsonb_build_object(
          'code','TRANSFER',
          'label','Transfers',
          'count', case when c.transfer_count = 0 or c.transfer_count >= 3 then c.transfer_count else null end,
          'denominator', v_member_count,
          'suppressed', c.transfer_count between 1 and 2
        )
      )
    ) as item
    from counts c
    where c.reportable > 0
    order by c.reportable desc, c.competency
  )
  select coalesce(jsonb_agg(item), '[]'::jsonb)
    into v_competencies
  from rows;

  return jsonb_build_object(
    'status', 'AVAILABLE',
    'participantCount', v_member_count,
    'minimumReportableCohortSize', 5,
    'minimumReportableCellSize', 3,
    'competencies', coalesce(v_competencies, '[]'::jsonb),
    'boundary', 'Only active, consented, non-P3 evidence with the latest approved curriculum mapping contributes. Missing evidence is not evidence of inability.'
  );
end
$$;

revoke all on function public.bis_cohort_competency_summary(text) from public, anon;
grant execute on function public.bis_cohort_competency_summary(text) to authenticated;

comment on function public.bis_cohort_competency_summary(text) is
  'Privacy-safe BIS competency-development summary. Returns aggregate progression states only; never learner identity or response wording.';
