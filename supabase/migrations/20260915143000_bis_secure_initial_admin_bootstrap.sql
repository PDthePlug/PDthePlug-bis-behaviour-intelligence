-- Resolve the initial-admin bootstrap race against row-level security.
-- Runtime callers must never infer global admin state from an RLS-filtered SELECT.

create or replace function public.bootstrap_initial_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id text;
  caller_email text;
  first_user_id text;
  first_email text;
begin
  caller_user_id := private.current_app_user_id();
  caller_email := private.current_email();

  if caller_user_id is null or caller_email is null then
    return false;
  end if;

  if private.has_active_admin() then
    return false;
  end if;

  select l.user_id, lower(l.email)
    into first_user_id, first_email
  from public.learners l
  order by l.created_at asc, l.user_id asc
  limit 1;

  if first_user_id is null then
    return false;
  end if;

  if first_user_id <> caller_user_id and first_email <> caller_email then
    return false;
  end if;

  insert into public.role_assignments (
    id,
    principal_email,
    user_id,
    role,
    scope_type,
    scope_id,
    status,
    assigned_by
  ) values (
    gen_random_uuid()::text,
    caller_email,
    caller_user_id,
    'SYSTEM_ADMIN',
    'GLOBAL',
    'GLOBAL',
    'ACTIVE',
    caller_user_id
  )
  on conflict (principal_email, role, scope_type, scope_id)
  do update set
    user_id = excluded.user_id,
    status = 'ACTIVE',
    revoked_at = null;

  return true;
end;
$$;

revoke all on function public.bootstrap_initial_admin() from public, anon;
grant execute on function public.bootstrap_initial_admin() to authenticated;
