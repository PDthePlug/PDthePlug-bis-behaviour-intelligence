-- Keep the exposed RPC security-invoker while the guarded implementation
-- remains in the private schema. This matches the existing BIS sponsor RPC
-- pattern and removes a public SECURITY DEFINER endpoint.

alter function public.bis_cohort_competency_summary(text) set schema private;

revoke all on function private.bis_cohort_competency_summary(text) from public, anon;
grant execute on function private.bis_cohort_competency_summary(text) to authenticated;

create or replace function public.bis_cohort_competency_summary(target_cohort_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.bis_cohort_competency_summary(target_cohort_id);
$$;

revoke all on function public.bis_cohort_competency_summary(text) from public, anon;
grant execute on function public.bis_cohort_competency_summary(text) to authenticated;

comment on function public.bis_cohort_competency_summary(text) is
  'Security-invoker wrapper for the private, role-gated BIS competency-development cohort summary.';
