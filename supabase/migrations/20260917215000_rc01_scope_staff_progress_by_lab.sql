-- BIS Release Candidate 01
-- Keep staff experiment progress structural while allowing cohort-scoped Lab filtering.

create or replace view public.staff_experiment_progress
with (security_barrier = true)
as
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
where private.can_view_learner(e.user_id);

revoke insert, update, delete on public.staff_experiment_progress from authenticated;
grant select on public.staff_experiment_progress to authenticated;

comment on view public.staff_experiment_progress is
  'Structural experiment progress only; includes Lab identity but excludes learner pattern, equation, reward, and notes.';
