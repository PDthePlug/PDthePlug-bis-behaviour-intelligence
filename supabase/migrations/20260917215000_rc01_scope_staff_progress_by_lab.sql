-- BIS Release Candidate 01
-- Keep direct experiment access learner-owned while exposing only structural
-- progress to authorized staff through a private projection.

create or replace function private.staff_experiment_progress_rows()
returns table (
  id text,
  user_id text,
  status text,
  start_date date,
  planned_end_date date,
  actual_end_date date,
  minimum_evidence_threshold integer,
  created_at timestamptz,
  lab_code text
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function private.staff_experiment_progress_rows() from public, anon;
grant execute on function private.staff_experiment_progress_rows() to authenticated;

create or replace view public.staff_experiment_progress
with (security_barrier = true, security_invoker = true)
as
select * from private.staff_experiment_progress_rows();

revoke insert, update, delete on public.staff_experiment_progress from authenticated;
grant select on public.staff_experiment_progress to authenticated;

comment on function private.staff_experiment_progress_rows() is
  'Private least-privilege projection for authorized staff; excludes learner experiment wording and notes.';
comment on view public.staff_experiment_progress is
  'Security-invoker public view over the private structural staff projection.';
