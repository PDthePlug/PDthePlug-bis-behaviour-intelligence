-- Commercial Intelligence least-privilege table grants.
-- RLS remains the row-level authorization boundary; table grants expose only
-- the operations each audited commercial object actually needs.

do $$
begin
  revoke all on table public.crm_agent_runs from public, anon, authenticated;
  revoke all on table public.crm_recommendations from public, anon, authenticated;
  revoke all on table public.crm_approvals from public, anon, authenticated;
  revoke all on table public.crm_research_sources from public, anon, authenticated;
  revoke all on table public.crm_generated_artifacts from public, anon, authenticated;
  revoke all on table public.crm_signal_events from public, anon, authenticated;

  grant select, insert on table public.crm_agent_runs to authenticated;
  grant select, insert, update on table public.crm_recommendations to authenticated;
  grant select, insert on table public.crm_approvals to authenticated;
  grant select, insert, update on table public.crm_research_sources to authenticated;
  grant select, insert on table public.crm_generated_artifacts to authenticated;
  grant select, insert on table public.crm_signal_events to authenticated;
end
$$;
