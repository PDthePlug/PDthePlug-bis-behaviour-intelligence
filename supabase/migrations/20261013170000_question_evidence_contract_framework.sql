-- BIS question evidence contract framework
--
-- Separates four concerns that were previously easy to conflate:
--   1. what an authored question means,
--   2. what developmental stage it can at most support,
--   3. whether its response may be aggregated, and
--   4. whether explicitly shared free text may enter facilitator-only model review.
--
-- Contracts contain no learner data and no manuscript question wording. They bind
-- the stable question_family hash already produced by the content compiler to a
-- source-reviewed competency/evidence meaning contract.

create table public.question_evidence_contracts (
  id text primary key,
  lab_code text not null,
  question_family text not null,
  competency_id text not null,
  evidence_class text not null check (evidence_class in (
    'BASELINE','CONTEXT','PREDICTION','PLAN','OBSERVATION','OUTCOME',
    'INTERPRETATION','TRANSFER','LEARNING_CHECK','SUPPORT_SIGNAL','UNCLASSIFIED'
  )),
  stage_ceiling text not null check (stage_ceiling in (
    'NOT_YET_EVIDENCED','NOTICE','EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER'
  )),
  source_nature text not null default 'SELF_REPORT' check (source_nature in (
    'SELF_REPORT','OBSERVED','ASSESSED','MIXED'
  )),
  aggregation_policy text not null default 'EXCLUDE' check (aggregation_policy in (
    'EXCLUDE','STRUCTURED_ONLY'
  )),
  model_review_policy text not null default 'DISABLED' check (model_review_policy in (
    'DISABLED','FACILITATOR_SHARED_ONLY'
  )),
  claim_authority text not null check (claim_authority in (
    'MEANING_ONLY','HUMAN_REVIEW_REQUIRED'
  )),
  contract_status text not null check (contract_status in (
    'APPROVED_MEANING','REVIEW_REQUIRED','RETIRED'
  )),
  measurement_status text not null default 'NOT_VALIDATED' check (measurement_status in (
    'NOT_VALIDATED','VALIDATED'
  )),
  privacy_scope text not null default 'PRIVATE_BY_DEFAULT' check (privacy_scope in (
    'PRIVATE_BY_DEFAULT','AGGREGATE_ALLOWED'
  )),
  allowed_inference text not null,
  forbidden_inference text not null,
  source_reference text not null,
  source_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (lab_code, question_family)
);

create index idx_question_evidence_contract_lookup
  on public.question_evidence_contracts(lab_code, question_family, contract_status);
create index idx_question_evidence_contract_competency
  on public.question_evidence_contracts(competency_id, contract_status);

alter table public.question_evidence_contracts enable row level security;
revoke all on table public.question_evidence_contracts from public, anon, authenticated;
grant select on table public.question_evidence_contracts to authenticated;
create policy question_evidence_contract_admin_read
  on public.question_evidence_contracts for select to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'));

comment on table public.question_evidence_contracts is
  'Source-reviewed question meaning contracts. Hashes and claim limits only; no learner responses or manuscript wording are stored here.';

alter table public.question_analysis_registry
  add column if not exists model_review_policy text not null default 'DISABLED',
  add column if not exists contract_id text references public.question_evidence_contracts(id);

alter table public.question_analysis_registry
  drop constraint if exists question_analysis_model_review_policy_check;
alter table public.question_analysis_registry
  add constraint question_analysis_model_review_policy_check
  check (model_review_policy in ('DISABLED','FACILITATOR_SHARED_ONLY'));

create index if not exists idx_question_analysis_contract
  on public.question_analysis_registry(contract_id, status);
create index if not exists idx_question_analysis_model_review
  on public.question_analysis_registry(lab_code, lab_version, model_review_policy, status);

alter table public.curriculum_evidence_mappings
  add column if not exists question_family text,
  add column if not exists stage_ceiling text not null default 'NOT_YET_EVIDENCED',
  add column if not exists source_nature text not null default 'SELF_REPORT',
  add column if not exists model_review_policy text not null default 'DISABLED',
  add column if not exists claim_authority text not null default 'MEANING_ONLY',
  add column if not exists allowed_inference text,
  add column if not exists forbidden_inference text,
  add column if not exists contract_id text references public.question_evidence_contracts(id);

alter table public.curriculum_evidence_mappings
  drop constraint if exists curriculum_mapping_stage_ceiling_check;
alter table public.curriculum_evidence_mappings
  add constraint curriculum_mapping_stage_ceiling_check
  check (stage_ceiling in ('NOT_YET_EVIDENCED','NOTICE','EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER'));
alter table public.curriculum_evidence_mappings
  drop constraint if exists curriculum_mapping_source_nature_check;
alter table public.curriculum_evidence_mappings
  add constraint curriculum_mapping_source_nature_check
  check (source_nature in ('SELF_REPORT','OBSERVED','ASSESSED','MIXED'));
alter table public.curriculum_evidence_mappings
  drop constraint if exists curriculum_mapping_model_review_policy_check;
alter table public.curriculum_evidence_mappings
  add constraint curriculum_mapping_model_review_policy_check
  check (model_review_policy in ('DISABLED','FACILITATOR_SHARED_ONLY'));
alter table public.curriculum_evidence_mappings
  drop constraint if exists curriculum_mapping_claim_authority_check;
alter table public.curriculum_evidence_mappings
  add constraint curriculum_mapping_claim_authority_check
  check (claim_authority in ('MEANING_ONLY','HUMAN_REVIEW_REQUIRED'));

create index if not exists idx_curriculum_mapping_contract
  on public.curriculum_evidence_mappings(contract_id, classification_status);

-- Approved meaning is applied before the registry row is written. Aggregation and
-- model review remain separate permissions. Structured aggregation is only allowed
-- when both the source contract and the runtime answer type permit it.
create or replace function private.apply_question_contract_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.question_evidence_contracts;
begin
  select * into c
  from public.question_evidence_contracts qec
  where qec.lab_code = new.lab_code
    and qec.question_family = new.question_family
    and qec.contract_status = 'APPROVED_MEANING'
  limit 1;

  if c.id is null then
    new.contract_id := null;
    new.model_review_policy := 'DISABLED';
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

revoke all on function private.apply_question_contract_before_write() from public, anon, authenticated;

drop trigger if exists question_contract_before_write on public.question_analysis_registry;
create trigger question_contract_before_write
before insert or update of lab_code, question_family, sensitivity, answer_model, aggregate_policy, status
on public.question_analysis_registry
for each row execute function private.apply_question_contract_before_write();

-- The existing curriculum_prompt_mapping trigger writes a STRUCTURAL row first.
-- This deliberately runs afterwards and appends a source-governed APPROVED version.
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
  if new.contract_id is null then return new; end if;

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

revoke all on function private.append_question_contract_mapping() from public, anon, authenticated;

drop trigger if exists zz_question_contract_mapping on public.question_analysis_registry;
create trigger zz_question_contract_mapping
after insert or update of contract_id, status, model_review_policy
on public.question_analysis_registry
for each row execute function private.append_question_contract_mapping();

-- Called by source-contract seed migrations and by certification tooling. Updating
-- registry metadata is enough to invoke the append-only mapping trigger above.
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
  where c.lab_code = r.lab_code
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

revoke all on function private.refresh_question_evidence_contracts(text) from public, anon, authenticated;

comment on function private.refresh_question_evidence_contracts(text) is
  'Applies approved source meaning contracts to matching runtime question families and appends governed curriculum mappings.';
