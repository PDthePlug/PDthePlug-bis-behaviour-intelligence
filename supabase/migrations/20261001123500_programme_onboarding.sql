-- BIS programme onboarding: group-scoped facilitators, programme plans, and
-- participant emails that can be entered before first learner sign-in.

alter table public.pilot_cohorts
  add column if not exists programme_format text not null default 'SINGLE_LAB',
  add column if not exists lab_codes text not null default '["HAB"]';

alter table public.pilot_cohorts
  alter column facilitator_email drop not null;

update public.pilot_cohorts
set lab_codes = json_build_array(lab_code)::text
where lab_codes is null
   or btrim(lab_codes) = ''
   or lab_codes = '[]';

create table if not exists public.cohort_participant_invites (
  id text primary key,
  cohort_id text not null references public.pilot_cohorts(id) on delete cascade,
  email text not null,
  status text not null default 'PENDING',
  invited_by text not null,
  claimed_user_id text references public.learners(user_id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint uq_cohort_participant_invite unique (cohort_id, email)
);

create index if not exists idx_cohort_participant_invite_email_status
  on public.cohort_participant_invites (lower(email), status);
create index if not exists idx_cohort_participant_invite_cohort_status
  on public.cohort_participant_invites (cohort_id, status);

-- Preserve current facilitator assignments while making the group scope explicit.
insert into public.role_assignments (
  id,
  principal_email,
  user_id,
  role,
  scope_type,
  scope_id,
  status,
  assigned_by,
  assigned_at,
  revoked_at
)
select
  'cohort-facilitator:' || c.id || ':' || md5(lower(c.facilitator_email)),
  lower(c.facilitator_email),
  null,
  'FACILITATOR',
  'COHORT',
  c.id,
  'ACTIVE',
  c.created_by,
  coalesce(c.created_at, now()),
  null
from public.pilot_cohorts c
where c.status = 'ACTIVE'
  and c.facilitator_email is not null
  and btrim(c.facilitator_email) <> ''
on conflict (principal_email, role, scope_type, scope_id)
do nothing;

create or replace function private.can_manage_cohort(target_cohort_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    private.has_staff_role('SYSTEM_ADMIN')
    or exists (
      select 1
      from public.role_assignments r
      left join public.pilot_cohorts c on c.id = target_cohort_id
      where r.status = 'ACTIVE'
        and r.role = 'FACILITATOR'
        and (
          lower(r.principal_email) = private.current_email()
          or r.user_id = private.current_app_user_id()
        )
        and (
          (r.scope_type = 'COHORT' and r.scope_id = target_cohort_id)
          or (
            r.scope_type = 'GLOBAL'
            and c.status = 'ACTIVE'
            and lower(coalesce(c.facilitator_email, '')) = private.current_email()
          )
        )
    )
  )
$$;

create or replace function private.can_view_learner(target_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
        and private.can_manage_cohort(c.id)
    )
    or exists (
      select 1
      from public.safeguarding_cases s
      where s.learner_user_id = target_user_id
        and private.has_staff_role('SAFEGUARDING_OFFICER')
    )
  )
$$;

revoke all on function private.can_manage_cohort(text) from public, anon;
revoke all on function private.can_view_learner(text) from public, anon;
grant execute on function private.can_manage_cohort(text) to authenticated;
grant execute on function private.can_view_learner(text) to authenticated;

alter table public.cohort_participant_invites enable row level security;

drop policy if exists cohort_participant_invites_read on public.cohort_participant_invites;
create policy cohort_participant_invites_read
on public.cohort_participant_invites
for select
to authenticated
using (
  private.has_staff_role('SYSTEM_ADMIN')
  or private.can_manage_cohort(cohort_id)
  or lower(email) = private.current_email()
);

drop policy if exists cohort_participant_invites_admin_insert on public.cohort_participant_invites;
create policy cohort_participant_invites_admin_insert
on public.cohort_participant_invites
for insert
to authenticated
with check (private.has_staff_role('SYSTEM_ADMIN'));

drop policy if exists cohort_participant_invites_claim on public.cohort_participant_invites;
create policy cohort_participant_invites_claim
on public.cohort_participant_invites
for update
to authenticated
using (
  private.has_staff_role('SYSTEM_ADMIN')
  or lower(email) = private.current_email()
)
with check (
  private.has_staff_role('SYSTEM_ADMIN')
  or lower(email) = private.current_email()
);

drop policy if exists cohort_participant_invites_admin_delete on public.cohort_participant_invites;
create policy cohort_participant_invites_admin_delete
on public.cohort_participant_invites
for delete
to authenticated
using (private.has_staff_role('SYSTEM_ADMIN'));

grant select, insert, update, delete on table public.cohort_participant_invites to authenticated;
