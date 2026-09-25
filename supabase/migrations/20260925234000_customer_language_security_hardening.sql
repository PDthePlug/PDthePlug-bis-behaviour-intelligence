-- BIS customer-facing hardening: close the one-time bootstrap path and
-- remove avoidable RLS/index warnings introduced by the Programme Decision Register.

revoke execute on function public.bootstrap_initial_admin() from public, anon, authenticated;

drop policy if exists programme_decisions_insert on public.programme_decisions;
create policy programme_decisions_insert
on public.programme_decisions
for insert
to authenticated
with check (
  (select private.can_manage_programme_decisions(cohort_id))
  and created_by = coalesce((select private.current_app_user_id()), (select auth.uid())::text)
  and lower(created_by_email) = (select private.current_email())
);

create index if not exists idx_programme_decisions_comparison_cohort
  on public.programme_decisions(comparison_cohort_id)
  where comparison_cohort_id is not null;
