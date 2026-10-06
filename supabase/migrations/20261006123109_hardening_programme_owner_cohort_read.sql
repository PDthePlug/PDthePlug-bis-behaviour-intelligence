-- Programme owners need their assigned group's metadata to validate team decisions.
-- Add SELECT only; keep facilitator, participant, response and write access unchanged.
create policy cohorts_programme_owner_read
on public.pilot_cohorts for select to authenticated
using (private.can_manage_programme_decisions(id));
