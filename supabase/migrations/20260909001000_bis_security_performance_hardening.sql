-- BIS production hardening after the first Supabase advisory pass.

alter view public.staff_experiment_progress
  set (security_invoker = true);

alter view public.staff_experiment_event_progress
  set (security_invoker = true);

create index if not exists idx_experiments_hypothesis_id
  on public.experiments (hypothesis_id);
create index if not exists idx_facilitator_notes_learner_user_id
  on public.facilitator_notes (learner_user_id);
create index if not exists idx_hypotheses_superseded_by
  on public.hypotheses (superseded_by);
create index if not exists idx_measurement_values_experiment_id
  on public.measurement_values (experiment_id);
create index if not exists idx_responses_supersedes_response_id
  on public.responses (supersedes_response_id);
create index if not exists idx_safeguarding_cases_cohort_id
  on public.safeguarding_cases (cohort_id);

drop policy if exists learners_insert on public.learners;
create policy learners_insert on public.learners for insert to authenticated
  with check (
    auth_user_id = (select auth.uid())
    and user_id = (select auth.uid())::text
    and lower(email) = (select private.current_email())
  );

drop policy if exists learners_update on public.learners;
create policy learners_update on public.learners for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (
    auth_user_id = (select auth.uid())
    and lower(email) = (select private.current_email())
  );

drop policy if exists audit_insert on public.audit_events;
create policy audit_insert on public.audit_events for insert to authenticated
  with check (
    actor_id in (
      (select private.current_app_user_id()),
      (select auth.uid())::text
    )
  );

drop policy if exists pilot_insert on public.pilot_events;
create policy pilot_insert on public.pilot_events for insert to authenticated
  with check (
    user_id in (
      (select private.current_app_user_id()),
      (select auth.uid())::text
    )
  );

drop policy if exists cohorts_admin_write on public.pilot_cohorts;
create policy cohorts_admin_insert on public.pilot_cohorts for insert to authenticated
  with check (private.has_staff_role('SYSTEM_ADMIN'));
create policy cohorts_admin_update on public.pilot_cohorts for update to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));
create policy cohorts_admin_delete on public.pilot_cohorts for delete to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'));

drop policy if exists members_admin_write on public.cohort_members;
create policy members_admin_insert on public.cohort_members for insert to authenticated
  with check (private.has_staff_role('SYSTEM_ADMIN'));
create policy members_admin_update on public.cohort_members for update to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));
create policy members_admin_delete on public.cohort_members for delete to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'));

drop policy if exists lab_assignments_admin_write on public.lab_assignments;
create policy lab_assignments_admin_insert on public.lab_assignments for insert to authenticated
  with check (private.has_staff_role('SYSTEM_ADMIN'));
create policy lab_assignments_admin_update on public.lab_assignments for update to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));
create policy lab_assignments_admin_delete on public.lab_assignments for delete to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'));
