-- BIS Programme Decision Register
-- Connects aggregate programme evidence to an explicit organisational decision,
-- expected outcome and next-cycle review. No learner-level fields are stored here.

create or replace function private.can_view_sponsor_cohort(target_cohort_id text)
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
      where r.status = 'ACTIVE'
        and r.role in ('SPONSOR_VIEWER', 'PROGRAMME_OWNER')
        and r.scope_type = 'COHORT'
        and r.scope_id = target_cohort_id
        and (
          lower(r.principal_email) = private.current_email()
          or r.user_id = private.current_app_user_id()
        )
    )
  )
$$;

revoke all on function private.can_view_sponsor_cohort(text) from public, anon;
grant execute on function private.can_view_sponsor_cohort(text) to authenticated;

create or replace function private.can_manage_programme_decisions(target_cohort_id text)
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
      where r.status = 'ACTIVE'
        and r.role = 'PROGRAMME_OWNER'
        and r.scope_type = 'COHORT'
        and r.scope_id = target_cohort_id
        and (
          lower(r.principal_email) = private.current_email()
          or r.user_id = private.current_app_user_id()
        )
    )
  )
$$;

revoke all on function private.can_manage_programme_decisions(text) from public, anon;
grant execute on function private.can_manage_programme_decisions(text) to authenticated;

create table if not exists public.programme_decisions (
  id text primary key,
  cohort_id text not null references public.pilot_cohorts(id) on delete cascade,
  source_signal text not null
    check (source_signal in (
      'PROGRAMME_TRANSITION',
      'SUPPORT_RESPONSE',
      'ADAPTATION',
      'EVIDENCE_STRENGTH',
      'LEARNING_JOURNEY',
      'DELIVERY_CONDITION',
      'OTHER'
    )),
  source_title text not null check (char_length(source_title) between 3 and 240),
  source_evidence text not null check (char_length(source_evidence) between 3 and 1200),
  decision_text text not null check (char_length(decision_text) between 3 and 1200),
  expected_outcome text not null check (char_length(expected_outcome) between 3 and 1200),
  owner_label text check (owner_label is null or char_length(owner_label) between 2 and 160),
  review_on date,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'REVIEWED', 'CLOSED')),
  review_outcome text
    check (
      review_outcome is null
      or review_outcome in ('IMPROVED', 'MIXED', 'UNCHANGED', 'WORSE', 'NOT_ENOUGH_EVIDENCE')
    ),
  review_note text check (review_note is null or char_length(review_note) <= 1200),
  comparison_cohort_id text references public.pilot_cohorts(id) on delete set null,
  created_by text not null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_programme_decisions_cohort_status
  on public.programme_decisions(cohort_id, status, created_at desc);

create index if not exists idx_programme_decisions_review_on
  on public.programme_decisions(review_on)
  where status = 'OPEN';

alter table public.programme_decisions enable row level security;

revoke all on table public.programme_decisions from anon;
revoke all on table public.programme_decisions from authenticated;
grant select, insert on table public.programme_decisions to authenticated;
grant update (
  decision_text,
  expected_outcome,
  owner_label,
  review_on,
  status,
  review_outcome,
  review_note,
  comparison_cohort_id,
  updated_at,
  reviewed_at
) on table public.programme_decisions to authenticated;

drop policy if exists programme_decisions_select on public.programme_decisions;
create policy programme_decisions_select
on public.programme_decisions
for select
to authenticated
using (private.can_view_sponsor_cohort(cohort_id));

drop policy if exists programme_decisions_insert on public.programme_decisions;
create policy programme_decisions_insert
on public.programme_decisions
for insert
to authenticated
with check (
  private.can_manage_programme_decisions(cohort_id)
  and created_by = private.current_app_user_id()
  and lower(created_by_email) = private.current_email()
);

drop policy if exists programme_decisions_update on public.programme_decisions;
create policy programme_decisions_update
on public.programme_decisions
for update
to authenticated
using (private.can_manage_programme_decisions(cohort_id))
with check (private.can_manage_programme_decisions(cohort_id));

comment on table public.programme_decisions is
  'Organisation-level programme decisions linked only to aggregate BIS evidence and next-cycle review.';

comment on function private.can_manage_programme_decisions(text) is
  'Allows SYSTEM_ADMIN or cohort-scoped PROGRAMME_OWNER accounts to create and review programme decisions.';
