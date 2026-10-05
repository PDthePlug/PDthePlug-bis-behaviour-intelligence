-- Production function definitions captured before the consolidated release.
-- Restore only through a reviewed additive rollback migration; retain new evidence/audit records.
CREATE OR REPLACE FUNCTION private.can_manage_cohort(target_cohort_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and (
    private.has_staff_role('SYSTEM_ADMIN')
    or (private.has_staff_role('FACILITATOR') and exists (
      select 1 from public.pilot_cohorts c
      where c.id = target_cohort_id and c.status = 'ACTIVE' and (
        lower(c.facilitator_email) = private.current_email()
        or exists (select 1 from public.role_assignments r
          where lower(r.principal_email) = private.current_email()
            and r.role = 'FACILITATOR' and r.status = 'ACTIVE'
            and r.scope_type = 'COHORT' and r.scope_id = c.id)
      )
    ))
  );
$function$

CREATE OR REPLACE FUNCTION private.can_view_learner(target_user_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and (
    target_user_id = private.current_app_user_id()
    or private.has_staff_role('SYSTEM_ADMIN')
    or exists (
      select 1
      from public.cohort_members m
      join public.pilot_cohorts c on c.id = m.cohort_id
      where m.learner_user_id = target_user_id
        and m.status = 'ACTIVE'
        and c.status = 'ACTIVE'
        and lower(c.facilitator_email) = private.current_email()
        and private.has_staff_role('FACILITATOR')
    )
    or exists (
      select 1 from public.safeguarding_cases s
      where s.learner_user_id = target_user_id
        and private.has_staff_role('SAFEGUARDING_OFFICER')
    )
  )
$function$

CREATE OR REPLACE FUNCTION private.has_commercial_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.has_staff_role('SYSTEM_ADMIN')
  or exists (
    select 1
    from public.role_assignments r
    where r.status = 'ACTIVE'
      and lower(r.principal_email) = private.current_email()
      and r.role in ('COMMERCIAL_ADMIN','COMMERCIAL_LEAD','COMMERCIAL_RESEARCH','COMMERCIAL_READ_ONLY')
  );
$function$

