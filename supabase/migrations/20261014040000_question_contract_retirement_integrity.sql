-- Preserve explicit question retirement through source-contract triggers and refresh.
-- Direct contract metadata access remains denied in addition to revoked grants.

create or replace function private.apply_question_contract_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.question_evidence_contracts;
begin
  if new.status='RETIRED' then
    new.model_review_policy := 'DISABLED';
    new.aggregate_policy := 'EXCLUDE';
    return new;
  end if;

  select * into c
  from public.question_evidence_contracts qec
  where qec.lab_code = new.lab_code
    and qec.question_family = new.question_family
    and qec.contract_status = 'APPROVED_MEANING'
  limit 1;

  if c.id is null then
    new.contract_id := null;
    new.status := 'CANDIDATE';
    new.model_review_policy := 'DISABLED';
    new.aggregate_policy := 'EXCLUDE';
    return new;
  end if;

  new.contract_id := c.id;
  new.status := 'ACTIVE';
  new.model_review_policy := case
    when new.sensitivity = 'P3' then 'DISABLED'
    else c.model_review_policy
  end;
  new.aggregate_policy := case
    when c.aggregation_policy = 'STRUCTURED_ONLY'
      and new.sensitivity <> 'P3'
      and new.answer_model in ('INTEGER','BOOLEAN','CATEGORICAL','MULTI_SELECT')
      then 'STRUCTURED_ONLY'
    else 'EXCLUDE'
  end;
  return new;
end
$$;

create or replace function private.append_question_contract_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.question_evidence_contracts;
  previous public.curriculum_evidence_mappings;
begin
  if new.contract_id is null or new.status <> 'ACTIVE' then return new; end if;

  select * into c
  from public.question_evidence_contracts qec
  where qec.id = new.contract_id
    and qec.contract_status = 'APPROVED_MEANING';
  if c.id is null then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended(new.lab_code || ':' || new.lab_version || ':' || new.semantic_field_id, 0));

  select * into previous
  from public.curriculum_evidence_mappings m
  where m.lab_code = new.lab_code
    and m.lab_version = new.lab_version
    and m.semantic_field_id = new.semantic_field_id
  order by m.created_at desc, m.id desc
  limit 1;

  if previous.id is not null
    and previous.classification_status = 'APPROVED'
    and previous.contract_id is not distinct from c.id
    and previous.competency is not distinct from c.competency_id
    and previous.evidence_class is not distinct from c.evidence_class
    and previous.stage_ceiling is not distinct from c.stage_ceiling
    and previous.model_review_policy is not distinct from c.model_review_policy
  then
    return new;
  end if;

  insert into public.curriculum_evidence_mappings(
    registry_id, lab_code, lab_version, semantic_field_id, task_id, prompt_label,
    evidence_class, portfolio_purpose, outcome, competency, source_reference,
    classification_status, supersedes_id, created_by, question_family,
    stage_ceiling, source_nature, model_review_policy, claim_authority,
    allowed_inference, forbidden_inference, contract_id
  ) values (
    new.id, new.lab_code, new.lab_version, new.semantic_field_id,
    new.semantic_field_id, new.label,
    c.evidence_class,
    'Use this response only within its authored evidence meaning and privacy boundary.',
    c.allowed_inference,
    c.competency_id,
    c.source_reference,
    'APPROVED',
    previous.id,
    'SYSTEM_CONTRACT',
    new.question_family,
    c.stage_ceiling,
    c.source_nature,
    c.model_review_policy,
    c.claim_authority,
    c.allowed_inference,
    c.forbidden_inference,
    c.id
  );
  return new;
end
$$;

create or replace function private.refresh_question_evidence_contracts(target_lab text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  update public.question_analysis_registry r
  set
    contract_id = c.id,
    status = 'ACTIVE',
    model_review_policy = case when r.sensitivity = 'P3' then 'DISABLED' else c.model_review_policy end,
    aggregate_policy = case
      when c.aggregation_policy = 'STRUCTURED_ONLY'
        and r.sensitivity <> 'P3'
        and r.answer_model in ('INTEGER','BOOLEAN','CATEGORICAL','MULTI_SELECT')
        then 'STRUCTURED_ONLY'
      else 'EXCLUDE'
    end,
    updated_at = clock_timestamp()
  from public.question_evidence_contracts c
  where r.status <> 'RETIRED'
    and c.lab_code = r.lab_code
    and c.question_family = r.question_family
    and c.contract_status = 'APPROVED_MEANING'
    and (target_lab is null or r.lab_code = target_lab)
    and (
      r.contract_id is distinct from c.id
      or r.status is distinct from 'ACTIVE'
      or r.model_review_policy is distinct from (case when r.sensitivity = 'P3' then 'DISABLED' else c.model_review_policy end)
      or r.aggregate_policy is distinct from (
        case
          when c.aggregation_policy = 'STRUCTURED_ONLY'
            and r.sensitivity <> 'P3'
            and r.answer_model in ('INTEGER','BOOLEAN','CATEGORICAL','MULTI_SELECT')
            then 'STRUCTURED_ONLY'
          else 'EXCLUDE'
        end
      )
    );
  get diagnostics affected = row_count;
  return affected;
end
$$;

revoke all on function private.apply_question_contract_before_write(), private.append_question_contract_mapping(), private.refresh_question_evidence_contracts(text) from public,anon,authenticated;
create policy question_contract_direct_access_denied on public.question_evidence_contracts
for all to authenticated using(false) with check(false);
