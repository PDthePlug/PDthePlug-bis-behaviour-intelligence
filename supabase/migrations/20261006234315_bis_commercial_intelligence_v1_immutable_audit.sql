-- Keep Commercial Intelligence evidence and source provenance immutable
-- while allowing explicit decision state / source verification updates.

create or replace function private.guard_crm_recommendation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.run_id is distinct from old.run_id
    or new.opportunity_id is distinct from old.opportunity_id
    or new.signal_key is distinct from old.signal_key
    or new.kind is distinct from old.kind
    or new.priority is distinct from old.priority
    or new.title is distinct from old.title
    or new.rationale is distinct from old.rationale
    or new.recommended_action is distinct from old.recommended_action
    or new.evidence is distinct from old.evidence
    or new.confidence is distinct from old.confidence
    or new.score is distinct from old.score
    or new.requires_approval is distinct from old.requires_approval
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Commercial recommendation evidence is immutable after creation.';
  end if;
  return new;
end
$$;

revoke all on function private.guard_crm_recommendation_update() from public, anon, authenticated;

drop trigger if exists crm_recommendations_immutable_evidence on public.crm_recommendations;
create trigger crm_recommendations_immutable_evidence
before update on public.crm_recommendations
for each row execute function private.guard_crm_recommendation_update();

create or replace function private.guard_crm_research_source_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organisation_id is distinct from old.organisation_id
    or new.opportunity_id is distinct from old.opportunity_id
    or new.source_url is distinct from old.source_url
    or new.source_title is distinct from old.source_title
    or new.source_type is distinct from old.source_type
    or new.captured_by is distinct from old.captured_by
    or new.captured_at is distinct from old.captured_at
  then
    raise exception 'Commercial research source provenance is immutable after capture.';
  end if;
  return new;
end
$$;

revoke all on function private.guard_crm_research_source_update() from public, anon, authenticated;

drop trigger if exists crm_research_sources_immutable_provenance on public.crm_research_sources;
create trigger crm_research_sources_immutable_provenance
before update on public.crm_research_sources
for each row execute function private.guard_crm_research_source_update();
