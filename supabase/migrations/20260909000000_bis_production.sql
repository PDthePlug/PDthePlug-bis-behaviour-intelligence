-- BIS Behaviour Intelligence System
-- Canonical content versions: Habit 4.5.2, Decision 4.2.1, Money 4.2
-- This migration preserves legacy application user IDs and binds them to
-- Supabase Auth UUIDs through learners.auth_user_id.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.learners (
  user_id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  display_name text not null,
  age_band text not null,
  mode text not null default 'INDEPENDENT',
  language text not null default 'en',
  timezone text not null default 'Africa/Johannesburg',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_learners_email on public.learners (lower(email));

create table public.consent_records (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  consent_type text not null default 'LEARNER_PRODUCT',
  policy_version text not null,
  scope text not null,
  status text not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_consent_user_id on public.consent_records (user_id);

create table public.lab_enrollments (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  lab_code text not null default 'HAB',
  lab_version text not null default '4.5.2',
  status text not null default 'IN_PROGRESS',
  current_investigation integer not null default 0,
  started_at timestamptz not null default now(),
  phase_a_completed_at timestamptz,
  experiment_started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint uq_enrolment_user_lab_version unique (user_id, lab_code, lab_version)
);
create index idx_enrolment_user_id on public.lab_enrollments (user_id);

create table public.responses (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  prompt_id text not null,
  semantic_field_id text not null,
  lab_version text not null default '4.5.2',
  value text,
  response_status text not null default 'ANSWERED',
  language text not null default 'en',
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  supersedes_response_id text references public.responses(id) on delete set null
);
create index idx_responses_user_field on public.responses (user_id, semantic_field_id);
create index idx_responses_user_recorded on public.responses (user_id, recorded_at);

create table public.evidence_records (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  lab_code text not null default 'HAB',
  lab_version text not null default '4.5.2',
  investigation_id text not null,
  semantic_field_id text not null,
  source_object_type text not null,
  source_object_id text not null,
  provenance text not null,
  value_type text not null,
  value text,
  status text not null default 'ACTIVE',
  sensitivity text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
create index idx_evidence_user_field on public.evidence_records (user_id, semantic_field_id);
create index idx_evidence_user_recorded on public.evidence_records (user_id, recorded_at);

create table public.hypotheses (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  lab_code text not null default 'HAB',
  lab_version text not null default '4.5.2',
  statement text not null,
  falsification_statement text not null,
  learner_confidence integer not null,
  status text not null default 'ACTIVE',
  evidence_strength text not null default 'NONE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_by text references public.hypotheses(id) on delete set null
);
create index idx_hypotheses_user_id on public.hypotheses (user_id);

create table public.experiments (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  lab_version text not null default '4.5.2',
  hypothesis_id text references public.hypotheses(id) on delete set null,
  status text not null default 'ACTIVE',
  target_pattern text not null,
  target_condition text not null,
  alternative_behaviour text not null,
  expected_reward text not null,
  witness text,
  restart_plan text not null,
  minimum_version text not null,
  failure_signal text not null,
  impact_domains text not null default '[]',
  predicted_value integer not null,
  prediction_unit text not null default 'PERCENT',
  start_date date not null,
  planned_end_date date not null,
  actual_end_date date,
  minimum_evidence_threshold integer not null default 3,
  parameter_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_experiments_user_id on public.experiments (user_id);

create table public.experiment_events (
  id text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  user_id text not null references public.learners(user_id) on delete cascade,
  day_number integer not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  eligible_opportunity boolean not null,
  target_condition_occurred boolean not null,
  alternative_used boolean,
  notes text,
  source text not null default 'LEARNER',
  constraint uq_experiment_event_day unique (experiment_id, day_number)
);
create index idx_experiment_events_user_id on public.experiment_events (user_id);

create table public.experiment_parameter_versions (
  id text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  user_id text not null references public.learners(user_id) on delete cascade,
  version integer not null,
  effective_from timestamptz not null,
  target_condition text not null,
  alternative_behaviour text not null,
  expected_reward text not null,
  restart_plan text not null,
  minimum_version text not null,
  failure_signal text not null,
  change_reason text not null,
  created_at timestamptz not null default now(),
  constraint uq_experiment_parameter_version unique (experiment_id, version)
);
create index idx_experiment_parameter_user_id on public.experiment_parameter_versions (user_id);

create table public.experiment_checkpoints (
  id text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  user_id text not null references public.learners(user_id) on delete cascade,
  day_number integer not null,
  surprise text not null,
  observability text not null,
  evidence_support text not null,
  evidence_challenge text not null,
  decision text not null,
  adjustment_summary text,
  created_at timestamptz not null default now(),
  constraint uq_experiment_checkpoint_day unique (experiment_id, day_number)
);
create index idx_experiment_checkpoint_user_id on public.experiment_checkpoints (user_id);

create table public.measurement_values (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  experiment_id text references public.experiments(id) on delete cascade,
  code text not null,
  value text,
  status text not null,
  evidence_strength text not null,
  formula_version text not null default '1.0',
  calculated_at timestamptz not null default now(),
  constraint uq_measurement_user_experiment_code unique (user_id, experiment_id, code)
);
create index idx_measurement_user_id on public.measurement_values (user_id);

create table public.measurement_sources (
  id text primary key,
  measurement_id text not null references public.measurement_values(id) on delete cascade,
  user_id text not null references public.learners(user_id) on delete cascade,
  source_object_type text not null,
  source_object_id text not null,
  input_role text not null,
  input_value text,
  created_at timestamptz not null default now(),
  constraint uq_measurement_source_role unique (measurement_id, source_object_id, input_role)
);
create index idx_measurement_source_user_id on public.measurement_sources (user_id);

create table public.notification_preferences (
  user_id text primary key references public.learners(user_id) on delete cascade,
  enabled boolean not null default true,
  experiment_started boolean not null default true,
  daily_observation boolean not null default true,
  day_three_checkpoint boolean not null default true,
  experiment_ending boolean not null default true,
  review_ready boolean not null default true,
  reminder_time time not null default '18:00',
  timezone text not null default 'Africa/Johannesburg',
  updated_at timestamptz not null default now()
);

create table public.pilot_events (
  id text primary key,
  user_id text not null,
  name text not null,
  lab_version text not null default '4.5.2',
  object_type text not null,
  object_id text not null,
  metadata text not null default '{}',
  occurred_at timestamptz not null default now()
);
create index idx_pilot_event_user_name on public.pilot_events (user_id, name);
create index idx_pilot_event_occurred_at on public.pilot_events (occurred_at);

create table public.memory_items (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  memory_type text not null,
  statement text not null,
  status text not null default 'ACTIVE',
  source_type text not null,
  source_id text not null,
  confirmation_level text not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);
create index idx_memory_user_id on public.memory_items (user_id);

create table public.companion_turns (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  role text not null,
  content text not null,
  mode text not null,
  evidence_refs text not null default '[]',
  generated_at timestamptz not null default now(),
  policy_version text not null default 'MVP-1.0'
);
create index idx_companion_turns_user_id on public.companion_turns (user_id);

create table public.role_assignments (
  id text primary key,
  principal_email text not null,
  user_id text,
  role text not null,
  scope_type text not null default 'GLOBAL',
  scope_id text not null default 'GLOBAL',
  status text not null default 'ACTIVE',
  assigned_by text not null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint uq_role_principal_scope unique (principal_email, role, scope_type, scope_id)
);
create index idx_role_user_status on public.role_assignments (user_id, status);
create index idx_role_email_status on public.role_assignments (lower(principal_email), status);

create table public.pilot_cohorts (
  id text primary key,
  name text not null,
  lab_code text not null default 'HAB',
  lab_version text not null default '4.5.2',
  facilitator_email text not null,
  status text not null default 'ACTIVE',
  starts_on date,
  ends_on date,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cohort_facilitator_status on public.pilot_cohorts (lower(facilitator_email), status);
create index idx_cohort_lab_version on public.pilot_cohorts (lab_code, lab_version);

create table public.cohort_members (
  id text primary key,
  cohort_id text not null references public.pilot_cohorts(id) on delete cascade,
  learner_user_id text not null references public.learners(user_id) on delete cascade,
  learner_email text not null,
  status text not null default 'ACTIVE',
  added_by text not null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint uq_cohort_learner unique (cohort_id, learner_user_id)
);
create index idx_cohort_member_learner_status on public.cohort_members (learner_user_id, status);
create index idx_cohort_member_cohort_status on public.cohort_members (cohort_id, status);

create table public.facilitator_notes (
  id text primary key,
  cohort_id text not null references public.pilot_cohorts(id) on delete cascade,
  learner_user_id text not null references public.learners(user_id) on delete cascade,
  author_id text not null,
  author_email text not null,
  category text not null,
  content text not null,
  visibility text not null default 'FACILITATOR_TEAM',
  created_at timestamptz not null default now()
);
create index idx_facilitator_note_cohort_learner on public.facilitator_notes (cohort_id, learner_user_id);
create index idx_facilitator_note_author on public.facilitator_notes (author_id);

create table public.safeguarding_cases (
  id text primary key,
  learner_user_id text not null references public.learners(user_id) on delete cascade,
  learner_email text not null,
  cohort_id text references public.pilot_cohorts(id) on delete set null,
  source_type text not null,
  category text not null,
  summary text not null,
  status text not null default 'OPEN',
  severity text not null default 'UNASSESSED',
  opened_by text not null,
  opened_by_email text not null,
  assigned_to_email text,
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text
);
create index idx_safeguarding_status_opened on public.safeguarding_cases (status, opened_at);
create index idx_safeguarding_learner_status on public.safeguarding_cases (learner_user_id, status);
create index idx_safeguarding_assignee_status on public.safeguarding_cases (lower(assigned_to_email), status);
create index idx_safeguarding_opened_by on public.safeguarding_cases (opened_by);

create table public.lab_assignments (
  id text primary key,
  learner_user_id text not null references public.learners(user_id) on delete cascade,
  learner_email text not null,
  lab_code text not null default 'HAB',
  lab_version text not null,
  status text not null default 'ACTIVE',
  assigned_by text not null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint uq_lab_assignment_learner_version unique (learner_user_id, lab_code, lab_version)
);
create index idx_lab_assignment_learner_status on public.lab_assignments (learner_user_id, status);

create table public.audit_events (
  id text primary key,
  actor_id text not null,
  actor_type text not null default 'LEARNER',
  action text not null,
  object_type text not null,
  object_id text not null,
  reason text,
  metadata text not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_audit_actor_id on public.audit_events (actor_id);

create or replace function private.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select l.user_id
  from public.learners l
  where l.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function private.current_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function private.has_staff_role(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.role_assignments r
    where r.status = 'ACTIVE'
      and r.role = requested_role
      and (
        lower(r.principal_email) = private.current_email()
        or r.user_id = private.current_app_user_id()
      )
  )
$$;

create or replace function private.has_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.role_assignments r
    where r.role = 'SYSTEM_ADMIN' and r.status = 'ACTIVE'
  )
$$;

create or replace function private.can_manage_cohort(target_cohort_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    private.has_staff_role('SYSTEM_ADMIN')
    or (
      private.has_staff_role('FACILITATOR')
      and exists (
        select 1 from public.pilot_cohorts c
        where c.id = target_cohort_id
          and c.status = 'ACTIVE'
          and lower(c.facilitator_email) = private.current_email()
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
        and lower(c.facilitator_email) = private.current_email()
        and private.has_staff_role('FACILITATOR')
    )
    or exists (
      select 1 from public.safeguarding_cases s
      where s.learner_user_id = target_user_id
        and private.has_staff_role('SAFEGUARDING_OFFICER')
    )
  )
$$;

revoke all on function private.current_app_user_id() from public, anon;
revoke all on function private.current_email() from public, anon;
revoke all on function private.has_staff_role(text) from public, anon;
revoke all on function private.has_active_admin() from public, anon;
revoke all on function private.can_manage_cohort(text) from public, anon;
revoke all on function private.can_view_learner(text) from public, anon;
grant execute on function private.current_app_user_id() to authenticated;
grant execute on function private.current_email() to authenticated;
grant execute on function private.has_staff_role(text) to authenticated;
grant execute on function private.has_active_admin() to authenticated;
grant execute on function private.can_manage_cohort(text) to authenticated;
grant execute on function private.can_view_learner(text) to authenticated;

create or replace function private.bind_legacy_learner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  legacy_user_id text;
begin
  select l.user_id into legacy_user_id
  from public.learners l
  where lower(l.email) = lower(new.email)
    and l.auth_user_id is null
  order by l.created_at asc
  limit 1;
  if legacy_user_id is not null then
    update public.learners
      set auth_user_id = new.id, updated_at = now()
      where user_id = legacy_user_id;
  end if;
  return new;
end
$$;
revoke all on function private.bind_legacy_learner() from public, anon, authenticated;
create trigger on_auth_user_bind_legacy
  after insert on auth.users
  for each row execute function private.bind_legacy_learner();

alter table public.learners enable row level security;
create policy learners_read on public.learners for select to authenticated
  using (private.can_view_learner(user_id));
create policy learners_insert on public.learners for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    and user_id = auth.uid()::text
    and lower(email) = private.current_email()
  );
create policy learners_update on public.learners for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and lower(email) = private.current_email());

alter table public.lab_enrollments enable row level security;
create policy enrolments_read on public.lab_enrollments for select to authenticated
  using (private.can_view_learner(user_id));
create policy enrolments_insert on public.lab_enrollments for insert to authenticated
  with check (user_id = private.current_app_user_id() or private.has_staff_role('SYSTEM_ADMIN'));
create policy enrolments_update on public.lab_enrollments for update to authenticated
  using (user_id = private.current_app_user_id() or private.has_staff_role('SYSTEM_ADMIN'))
  with check (user_id = private.current_app_user_id() or private.has_staff_role('SYSTEM_ADMIN'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'consent_records', 'responses', 'evidence_records', 'hypotheses',
    'experiments', 'experiment_events', 'experiment_parameter_versions',
    'experiment_checkpoints', 'measurement_values', 'measurement_sources',
    'notification_preferences', 'memory_items', 'companion_turns'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy learner_owns_row on public.%I for all to authenticated using (user_id = private.current_app_user_id()) with check (user_id = private.current_app_user_id())',
      table_name
    );
  end loop;
end
$$;

alter table public.role_assignments enable row level security;
create policy roles_read on public.role_assignments for select to authenticated
  using (
    private.has_staff_role('SYSTEM_ADMIN')
    or lower(principal_email) = private.current_email()
    or user_id = private.current_app_user_id()
  );
create policy roles_bootstrap_or_admin_insert on public.role_assignments for insert to authenticated
  with check (
    private.has_staff_role('SYSTEM_ADMIN')
    or (
      not private.has_active_admin()
      and role = 'SYSTEM_ADMIN'
      and lower(principal_email) = private.current_email()
      and assigned_by = private.current_app_user_id()
    )
  );
create policy roles_admin_update on public.role_assignments for update to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

alter table public.pilot_cohorts enable row level security;
create policy cohorts_read on public.pilot_cohorts for select to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN') or private.can_manage_cohort(id));
create policy cohorts_admin_write on public.pilot_cohorts for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

alter table public.cohort_members enable row level security;
create policy members_read on public.cohort_members for select to authenticated
  using (
    learner_user_id = private.current_app_user_id()
    or private.has_staff_role('SYSTEM_ADMIN')
    or private.can_manage_cohort(cohort_id)
  );
create policy members_admin_write on public.cohort_members for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

alter table public.lab_assignments enable row level security;
create policy lab_assignments_read on public.lab_assignments for select to authenticated
  using (learner_user_id = private.current_app_user_id() or private.has_staff_role('SYSTEM_ADMIN'));
create policy lab_assignments_admin_write on public.lab_assignments for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

alter table public.facilitator_notes enable row level security;
create policy notes_staff_read on public.facilitator_notes for select to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN') or private.can_manage_cohort(cohort_id));
create policy notes_facilitator_insert on public.facilitator_notes for insert to authenticated
  with check (
    private.has_staff_role('FACILITATOR')
    and private.can_manage_cohort(cohort_id)
    and lower(author_email) = private.current_email()
  );

alter table public.safeguarding_cases enable row level security;
create policy cases_staff_read on public.safeguarding_cases for select to authenticated
  using (
    private.has_staff_role('SAFEGUARDING_OFFICER')
    or private.has_staff_role('SYSTEM_ADMIN')
    or (private.has_staff_role('FACILITATOR') and lower(opened_by_email) = private.current_email())
  );
create policy cases_facilitator_insert on public.safeguarding_cases for insert to authenticated
  with check (
    private.has_staff_role('FACILITATOR')
    and lower(opened_by_email) = private.current_email()
    and (cohort_id is null or private.can_manage_cohort(cohort_id))
  );
create policy cases_officer_update on public.safeguarding_cases for update to authenticated
  using (private.has_staff_role('SAFEGUARDING_OFFICER'))
  with check (private.has_staff_role('SAFEGUARDING_OFFICER'));

alter table public.audit_events enable row level security;
create policy audit_read on public.audit_events for select to authenticated
  using (actor_id = private.current_app_user_id() or private.has_staff_role('SYSTEM_ADMIN'));
create policy audit_insert on public.audit_events for insert to authenticated
  with check (actor_id in (private.current_app_user_id(), auth.uid()::text));

alter table public.pilot_events enable row level security;
create policy pilot_read on public.pilot_events for select to authenticated
  using (user_id = private.current_app_user_id() or private.has_staff_role('SYSTEM_ADMIN'));
create policy pilot_insert on public.pilot_events for insert to authenticated
  with check (user_id in (private.current_app_user_id(), auth.uid()::text));

create view public.staff_experiment_progress
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
  e.created_at
from public.experiments e
where private.can_view_learner(e.user_id);

create view public.staff_experiment_event_progress
with (security_barrier = true)
as
select
  e.user_id,
  e.experiment_id,
  e.eligible_opportunity,
  e.recorded_at
from public.experiment_events e
where private.can_view_learner(e.user_id);

revoke all on all tables in schema public from public, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.staff_experiment_progress from authenticated;
revoke insert, update, delete on public.staff_experiment_event_progress from authenticated;

comment on view public.staff_experiment_progress is
  'Structural experiment progress only; excludes learner pattern, equation, reward, and notes.';
comment on view public.staff_experiment_event_progress is
  'Structural daily progress only; excludes learner event notes and choices.';
