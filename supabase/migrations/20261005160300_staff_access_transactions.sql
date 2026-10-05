-- Access edits and their audit record must succeed or fail together.
create function private.change_staff_access(payload jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare actor text=coalesce(private.current_app_user_id(),auth.uid()::text); action text=payload->>'action'; previous public.role_assignments; email_text text=lower(btrim(payload->>'email')); role_text text=payload->>'role'; scope_type_text text; scope_id_text text; assignment_id text;
begin
 if auth.uid() is null or not private.has_staff_role('SYSTEM_ADMIN') then raise exception 'Administrator required'; end if;
 perform pg_advisory_xact_lock(hashtext('bis_staff_access'));
 if action not in ('assignRole','updateRoleAssignment','revokeRole') then raise exception 'Supported access action required'; end if;
 if action in ('updateRoleAssignment','revokeRole') then
  select * into previous from public.role_assignments where id=payload->>'assignmentId' and status='ACTIVE' for update;
  if previous.id is null then raise exception 'Active access assignment required'; end if;
  if previous.role='SYSTEM_ADMIN' and (action='revokeRole' or role_text is distinct from 'SYSTEM_ADMIN' or email_text is distinct from previous.principal_email) and
    (select count(*) from public.role_assignments where role='SYSTEM_ADMIN' and status='ACTIVE')<=1 then
   raise exception 'The final system administrator cannot be revoked';
  end if;
 end if;
 if action='revokeRole' then
  update public.role_assignments set status='REVOKED',revoked_at=now() where id=previous.id;
  assignment_id=previous.id;
 else
  if coalesce(email_text,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(role_text,'') not in ('SYSTEM_ADMIN','FACILITATOR','SAFEGUARDING_OFFICER','SPONSOR_VIEWER','PROGRAMME_OWNER') then raise exception 'Valid staff email and role required'; end if;
  scope_type_text=case when role_text in ('FACILITATOR','SPONSOR_VIEWER','PROGRAMME_OWNER') then 'COHORT' else 'GLOBAL' end;
  scope_id_text=case when scope_type_text='COHORT' then payload->>'cohortId' else 'GLOBAL' end;
  if scope_type_text='COHORT' and not exists(select 1 from public.pilot_cohorts where id=scope_id_text and status='ACTIVE') then raise exception 'Choose an active programme group'; end if;
  insert into public.role_assignments(id,principal_email,role,scope_type,scope_id,assigned_by)
  values(gen_random_uuid()::text,email_text,role_text,scope_type_text,scope_id_text,actor)
  on conflict(principal_email,role,scope_type,scope_id) do update set status='ACTIVE',assigned_by=actor,assigned_at=now(),revoked_at=null
  returning id into assignment_id;
  if previous.id is not null and previous.id<>assignment_id then update public.role_assignments set status='REVOKED',revoked_at=now() where id=previous.id; end if;
 end if;
 insert into public.audit_events(id,actor_id,actor_type,action,object_type,object_id,metadata)
 values(gen_random_uuid()::text,actor,'STAFF',case when action='revokeRole' then 'STAFF_ROLE_REVOKED' else 'STAFF_ROLE_ASSIGNED' end,'ROLE_ASSIGNMENT',assignment_id,jsonb_build_object('role',role_text,'principalEmail',email_text,'previousId',previous.id)::text);
 return assignment_id;
end $$;
revoke all on function private.change_staff_access(jsonb) from public,anon;
grant execute on function private.change_staff_access(jsonb) to authenticated;
create function public.bis_change_staff_access(payload jsonb) returns text language sql security invoker set search_path='' as $$select private.change_staff_access(payload)$$;
revoke all on function public.bis_change_staff_access(jsonb) from public,anon;
grant execute on function public.bis_change_staff_access(jsonb) to authenticated;

-- The same final-administrator invariant holds for direct authenticated writes.
create function private.guard_final_administrator() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('bis_staff_access'));
 if old.role='SYSTEM_ADMIN' and old.status='ACTIVE' and
   (TG_OP='DELETE' or new.role is distinct from old.role or new.status is distinct from 'ACTIVE' or new.principal_email is distinct from old.principal_email or new.user_id is distinct from old.user_id) and
   (select count(*) from public.role_assignments where role='SYSTEM_ADMIN' and status='ACTIVE')<=1 then
  raise exception 'The final system administrator cannot be revoked';
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function private.guard_final_administrator() from public,anon,authenticated;
create trigger final_administrator_guard before update or delete on public.role_assignments for each row execute function private.guard_final_administrator();
