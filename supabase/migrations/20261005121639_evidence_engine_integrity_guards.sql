-- Explicit deny policies document the intentional RPC-only access path.
create policy submission_direct_access_denied on public.evidence_submissions for all to authenticated using(false) with check(false);
create policy assessment_direct_access_denied on public.evidence_assessments for all to authenticated using(false) with check(false);
alter policy mapping_read on public.curriculum_evidence_mappings using((select auth.uid()) is not null);
alter policy rubric_read on public.assessment_rubric_versions using((select auth.uid()) is not null);
create index idx_evidence_enrolment_fk on public.evidence_records(enrolment_id);

-- A superseded or withdrawn source cannot be resurrected by updating its status.
-- Corrections create new linked originals through the atomic capture functions.
create or replace function private.preserve_evidence_original() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(new)-'status'-'response_status') is distinct from (to_jsonb(old)-'status'-'response_status')
  then raise exception 'Original evidence is immutable. Save a linked correction.'; end if;
 if (to_jsonb(old)->>'status' in ('WITHDRAWN','SUPERSEDED') and to_jsonb(new)->>'status'='ACTIVE')
  or (to_jsonb(old)->>'response_status'='SUPERSEDED' and to_jsonb(new)->>'response_status'='ANSWERED')
  then raise exception 'Retired evidence cannot be restored. Save a linked correction.'; end if;
 return new;
end $$;
