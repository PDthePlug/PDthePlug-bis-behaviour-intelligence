-- Scoped co-facilitators preserve account access during demo cohort reconciliation.
create or replace function private.can_manage_cohort(target_cohort_id text)
returns boolean language sql stable security definer set search_path = '' as $$
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
$$;
revoke all on function private.can_manage_cohort(text) from public, anon;
grant execute on function private.can_manage_cohort(text) to authenticated;

-- IDs are deliberate: other organisations/cohorts are never matched by display name.
do $consolidation$
declare source_cohort public.pilot_cohorts%rowtype;
declare target_cohort public.pilot_cohorts%rowtype;
begin
  select * into source_cohort from public.pilot_cohorts where id='d7843748-88fd-4ee5-8f19-c78d9eb0a55a' for update;
  select * into target_cohort from public.pilot_cohorts where id='LEAP9-DEMO-HAB-20' for update;
  if source_cohort.id is null or target_cohort.id is null or source_cohort.status <> 'ACTIVE' then return; end if;
  if source_cohort.name <> 'Leap9' or target_cohort.name <> 'Leap9'
    or target_cohort.status <> 'ACTIVE' or source_cohort.lab_code <> target_cohort.lab_code
    or source_cohort.lab_version <> target_cohort.lab_version
    or source_cohort.created_by <> target_cohort.created_by then
    raise exception 'Leap9 reconciliation preconditions changed; inspect before applying.';
  end if;
  if exists(select 1 from public.facilitator_notes where cohort_id=source_cohort.id)
    or exists(select 1 from public.safeguarding_cases where cohort_id=source_cohort.id)
    or exists(select 1 from public.programme_decisions where cohort_id=source_cohort.id or comparison_cohort_id=source_cohort.id)
    or exists(select 1 from public.cohort_members s join public.cohort_members t
      on t.cohort_id=target_cohort.id and (t.learner_user_id=s.learner_user_id or lower(t.learner_email)=lower(s.learner_email))
      where s.cohort_id=source_cohort.id) then
    raise exception 'Secondary Leap9 has new dependencies or duplicate memberships; inspect before applying.';
  end if;
  insert into public.role_assignments(id,principal_email,role,scope_type,scope_id,status,assigned_by)
    values('LEAP9-SECOND-FACILITATOR',lower(source_cohort.facilitator_email),'FACILITATOR','COHORT',target_cohort.id,'ACTIVE',target_cohort.created_by)
    on conflict(principal_email,role,scope_type,scope_id) do update set status='ACTIVE',revoked_at=null;
  update public.cohort_members set cohort_id=target_cohort.id where cohort_id=source_cohort.id;
  -- Preserve historical assignments; add equivalent canonical scoped access.
  insert into public.role_assignments(id,principal_email,user_id,role,scope_type,scope_id,status,assigned_by)
    select gen_random_uuid()::text,principal_email,user_id,role,scope_type,target_cohort.id,status,assigned_by
    from public.role_assignments where scope_type='COHORT' and scope_id=source_cohort.id and status='ACTIVE'
    on conflict(principal_email,role,scope_type,scope_id) do nothing;
  update public.pilot_cohorts set status='RETIRED',updated_at=now() where id=source_cohort.id;
  insert into public.audit_events(id,actor_id,actor_type,action,object_type,object_id,metadata)
    values(gen_random_uuid()::text,target_cohort.created_by,'STAFF','PILOT_COHORT_CONSOLIDATED','PILOT_COHORT',target_cohort.id,
      jsonb_build_object('sourceCohortId',source_cohort.id,'preservedMemberships',true,'preservedFacilitator',true)::text);
end;
$consolidation$;
