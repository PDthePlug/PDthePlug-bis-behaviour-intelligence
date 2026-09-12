-- BIS Commercial Workspace 0.1 performance hardening
-- Cover foreign keys flagged by Supabase performance advisors.

create index if not exists idx_crm_activities_contact
  on public.crm_activities(contact_id);

create index if not exists idx_crm_discovery_sessions_opportunity
  on public.crm_discovery_sessions(opportunity_id);

create index if not exists idx_crm_tasks_opportunity
  on public.crm_tasks(opportunity_id);
