-- BIS Commercial Workspace 0.1
-- Commercial data is isolated from learner evidence and participant-facing tables.

create or replace function private.has_commercial_access()
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
      and r.role in ('COMMERCIAL_ADMIN','COMMERCIAL_LEAD','COMMERCIAL_RESEARCH','COMMERCIAL_READ_ONLY')
  );
$$;
revoke all on function private.has_commercial_access() from public, anon;
grant execute on function private.has_commercial_access() to authenticated;

create table public.crm_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  organisation_type text not null,
  website text,
  country text not null default 'South Africa',
  province text,
  status text not null default 'ACTIVE',
  research_status text not null default 'NEEDS_VERIFICATION',
  notes text,
  created_by text not null default 'BIS-COMMERCIAL-0.1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.crm_organisations(id) on delete cascade,
  full_name text,
  job_title text,
  email text,
  phone text,
  linkedin_url text,
  buying_role text,
  verification_status text not null default 'UNVERIFIED',
  is_primary boolean not null default false,
  source_url text,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_crm_contacts_org on public.crm_contacts(organisation_id);
create index idx_crm_contacts_email on public.crm_contacts(lower(email));

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  organisation_id uuid not null references public.crm_organisations(id) on delete cascade,
  opportunity_name text not null,
  lane text not null check(lane in ('SCHOOL','EMERGING_ADULT','WORKPLACE')),
  edition text not null,
  buyer_group text not null,
  opportunity_type text not null,
  priority text not null default 'MEDIUM',
  stage text not null default 'RESEARCH',
  strategic_question text,
  commercial_thesis text,
  recommended_tier text,
  pathway text,
  proposal_code text,
  proposal_status text not null default 'NOT_STARTED',
  contact_status text not null default 'NEEDS_VERIFICATION',
  owner_email text,
  wave text not null default 'BACKLOG',
  next_action text,
  next_action_due date,
  hold_reason text,
  estimated_value_zar numeric(14,2),
  probability_percent integer,
  last_activity_at timestamptz,
  created_by text not null default 'BIS-COMMERCIAL-0.1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_crm_opportunities_org on public.crm_opportunities(organisation_id);
create index idx_crm_opportunities_lane_stage on public.crm_opportunities(lane,stage);
create index idx_crm_opportunities_next_action on public.crm_opportunities(next_action_due);

create table public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_code text not null unique,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  title text not null,
  status text not null default 'DRAFT',
  edition text not null,
  version text not null,
  frozen_at date,
  sent_at timestamptz,
  document_url text,
  notes text,
  created_by text not null default 'BIS-COMMERCIAL-0.1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_crm_proposals_opportunity on public.crm_proposals(opportunity_id);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  activity_type text not null,
  direction text not null default 'INTERNAL',
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  actor_email text not null,
  created_at timestamptz not null default now()
);
create index idx_crm_activities_opportunity_time on public.crm_activities(opportunity_id,occurred_at desc);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  title text not null,
  status text not null default 'OPEN',
  priority text not null default 'MEDIUM',
  due_at timestamptz,
  owner_email text,
  completed_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index idx_crm_tasks_status_due on public.crm_tasks(status,due_at);

create table public.crm_discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  scheduled_at timestamptz,
  completed_at timestamptz,
  attendees text not null default '[]',
  strategic_questions text not null default '[]',
  evidence_requirements text,
  privacy_boundary text,
  deployment_constraints text,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  object_type text not null,
  object_id text not null,
  metadata text not null default '{}',
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'crm_organisations','crm_contacts','crm_opportunities','crm_proposals',
    'crm_activities','crm_tasks','crm_discovery_sessions','crm_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format(
      'create policy crm_commercial_access on public.%I for all to authenticated using (private.has_commercial_access()) with check (private.has_commercial_access())',
      t
    );
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end
$$;

comment on table public.crm_opportunities is 'BIS commercial opportunities. This table contains no learner evidence.';
comment on table public.crm_contacts is 'Verified or candidate commercial buyer contacts only; not programme participants.';
comment on table public.crm_discovery_sessions is 'Commercial discovery notes and deployment requirements; never participant behavioural evidence.';
