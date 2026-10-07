-- BIS Commercial Intelligence v1
-- AI/operator automation metadata remains isolated from learner evidence.

create or replace function private.can_write_commercial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_staff_role('SYSTEM_ADMIN')
  or exists (
    select 1
    from public.role_assignments r
    where r.status = 'ACTIVE'
      and lower(r.principal_email) = private.current_email()
      and r.role in ('COMMERCIAL_ADMIN','COMMERCIAL_LEAD','COMMERCIAL_RESEARCH')
  );
$$;
revoke all on function private.can_write_commercial() from public, anon;
grant execute on function private.can_write_commercial() to authenticated;

create table public.crm_agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('MORNING_BRIEF','MANUAL_REFRESH','ASK','DRAFT')),
  status text not null default 'COMPLETED' check (status in ('COMPLETED','FAILED','PARTIAL')),
  provider text not null default 'DETERMINISTIC',
  model text,
  summary text,
  metrics jsonb not null default '{}'::jsonb,
  input_fingerprint text not null,
  requested_by text not null,
  created_at timestamptz not null default now()
);
create index idx_crm_agent_runs_created_at on public.crm_agent_runs(created_at desc);
create index idx_crm_agent_runs_type_created on public.crm_agent_runs(run_type, created_at desc);

create table public.crm_recommendations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.crm_agent_runs(id) on delete restrict,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  signal_key text not null,
  kind text not null,
  priority text not null check (priority in ('URGENT','HIGH','MEDIUM','LOW')),
  title text not null,
  rationale text not null,
  recommended_action text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence integer not null check (confidence between 0 and 100),
  score integer not null default 0,
  status text not null default 'OPEN' check (status in ('OPEN','APPROVED','DISMISSED','EXECUTED','EXPIRED')),
  requires_approval boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, signal_key)
);
create index idx_crm_recommendations_status_score on public.crm_recommendations(status, score desc, created_at desc);
create index idx_crm_recommendations_opportunity on public.crm_recommendations(opportunity_id, created_at desc);

create table public.crm_approvals (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.crm_recommendations(id) on delete restrict,
  decision text not null check (decision in ('APPROVED','DISMISSED')),
  decision_note text,
  proposed_action jsonb not null default '{}'::jsonb,
  decided_by text not null,
  created_at timestamptz not null default now()
);
create index idx_crm_approvals_recommendation on public.crm_approvals(recommendation_id, created_at desc);

create table public.crm_research_sources (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.crm_organisations(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  source_url text not null,
  source_title text,
  source_type text not null default 'WEB',
  verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED','VERIFIED','STALE','REJECTED')),
  captured_by text not null,
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  notes text
);
create index idx_crm_research_sources_opportunity on public.crm_research_sources(opportunity_id, captured_at desc);
create index idx_crm_research_sources_organisation on public.crm_research_sources(organisation_id, captured_at desc);

create table public.crm_generated_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.crm_agent_runs(id) on delete set null,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  artifact_type text not null
    check (artifact_type in ('OUTREACH_DRAFT','FOLLOW_UP_DRAFT','MEETING_BRIEF','PROPOSAL_NOTES','FOUNDER_BRIEF')),
  title text not null,
  content text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','SUPERSEDED')),
  model text,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index idx_crm_generated_artifacts_opportunity on public.crm_generated_artifacts(opportunity_id, created_at desc);

create table public.crm_signal_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  signal_type text not null,
  severity text not null check (severity in ('INFO','ATTENTION','HIGH','URGENT')),
  signal_data jsonb not null default '{}'::jsonb,
  detected_by text not null default 'COMMERCIAL_INTELLIGENCE_V1',
  detected_at timestamptz not null default now()
);
create index idx_crm_signal_events_opportunity on public.crm_signal_events(opportunity_id, detected_at desc);
create index idx_crm_signal_events_type on public.crm_signal_events(signal_type, detected_at desc);

do $$
declare t text;
begin
  foreach t in array array[
    'crm_agent_runs','crm_recommendations','crm_approvals',
    'crm_research_sources','crm_generated_artifacts','crm_signal_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_commercial_access())',
      t || '_read', t
    );
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end
$$;

create policy crm_agent_runs_insert
on public.crm_agent_runs for insert to authenticated
with check (private.can_write_commercial());

create policy crm_recommendations_insert
on public.crm_recommendations for insert to authenticated
with check (private.can_write_commercial());

create policy crm_recommendations_update
on public.crm_recommendations for update to authenticated
using (private.can_write_commercial())
with check (private.can_write_commercial());

create policy crm_approvals_insert
on public.crm_approvals for insert to authenticated
with check (private.can_write_commercial());

create policy crm_research_sources_insert
on public.crm_research_sources for insert to authenticated
with check (private.can_write_commercial());

create policy crm_research_sources_update
on public.crm_research_sources for update to authenticated
using (private.can_write_commercial())
with check (private.can_write_commercial());

create policy crm_generated_artifacts_insert
on public.crm_generated_artifacts for insert to authenticated
with check (private.can_write_commercial());

create policy crm_signal_events_insert
on public.crm_signal_events for insert to authenticated
with check (private.can_write_commercial());

revoke delete on public.crm_agent_runs from authenticated;
revoke delete on public.crm_recommendations from authenticated;
revoke delete on public.crm_approvals from authenticated;
revoke delete on public.crm_research_sources from authenticated;
revoke delete on public.crm_generated_artifacts from authenticated;
revoke delete on public.crm_signal_events from authenticated;

comment on table public.crm_agent_runs is
  'Auditable BIS Commercial Intelligence runs. Contains commercial metadata only; never learner evidence.';
comment on table public.crm_recommendations is
  'Commercial next-best-action recommendations with evidence and human approval state.';
comment on table public.crm_approvals is
  'Immutable human approval or dismissal events for commercial recommendations.';
comment on table public.crm_generated_artifacts is
  'AI or deterministic commercial drafts. Draft creation never means external delivery occurred.';
comment on table public.crm_signal_events is
  'Detected commercial pipeline signals. Signals are not learner or participant risk labels.';
