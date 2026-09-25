-- Permit organisation staff without learner profiles to create decisions.
-- identityFrom() uses the Auth user id until an application profile exists.

drop policy if exists programme_decisions_insert on public.programme_decisions;
create policy programme_decisions_insert
on public.programme_decisions
for insert
to authenticated
with check (
  private.can_manage_programme_decisions(cohort_id)
  and created_by = coalesce(private.current_app_user_id(), auth.uid()::text)
  and lower(created_by_email) = private.current_email()
);
