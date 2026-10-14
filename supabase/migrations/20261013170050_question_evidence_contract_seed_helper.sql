-- Compact seed helper for source-reviewed question evidence contracts.
-- The payload contains only question-family hashes, competency IDs and occurrence counts:
--   QF-XXXX|AC-CNN|3,QF-YYYY|AC-CNN|1
-- No manuscript wording or learner response content is persisted by this helper.

create or replace function private.seed_question_evidence_contract_set(
  p_lab text,
  p_payload text,
  p_evidence_class text,
  p_stage_ceiling text,
  p_model_review_policy text,
  p_claim_authority text,
  p_contract_status text,
  p_allowed_inference text,
  p_forbidden_inference text,
  p_source_kind text,
  p_source_hash text
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if p_evidence_class not in (
    'BASELINE','CONTEXT','PREDICTION','PLAN','OBSERVATION','OUTCOME',
    'INTERPRETATION','TRANSFER','LEARNING_CHECK','SUPPORT_SIGNAL','UNCLASSIFIED'
  ) or p_stage_ceiling not in (
    'NOT_YET_EVIDENCED','NOTICE','EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER'
  ) or p_model_review_policy not in ('DISABLED','FACILITATOR_SHARED_ONLY')
    or p_claim_authority not in ('MEANING_ONLY','HUMAN_REVIEW_REQUIRED')
    or p_contract_status not in ('APPROVED_MEANING','REVIEW_REQUIRED','RETIRED')
    or coalesce(length(p_source_hash),0) <> 64
  then
    raise exception 'Invalid question evidence contract seed metadata.';
  end if;

  with expanded as (
    select
      split_part(entry, '|', 1) as question_family,
      split_part(entry, '|', 2) as competency_id,
      split_part(entry, '|', 3)::integer as occurrences
    from regexp_split_to_table(coalesce(p_payload,''), ',') entry
    where entry <> ''
  ), ins as (
    insert into public.question_evidence_contracts(
      id,lab_code,question_family,competency_id,evidence_class,stage_ceiling,source_nature,
      aggregation_policy,model_review_policy,claim_authority,contract_status,measurement_status,
      privacy_scope,allowed_inference,forbidden_inference,source_reference,source_hash
    )
    select
      'V1:' || p_lab || ':' || question_family,
      p_lab,
      question_family,
      competency_id,
      p_evidence_class,
      p_stage_ceiling,
      'SELF_REPORT',
      'EXCLUDE',
      p_model_review_policy,
      p_claim_authority,
      p_contract_status,
      'NOT_VALIDATED',
      'PRIVATE_BY_DEFAULT',
      p_allowed_inference,
      p_forbidden_inference,
      'Volume 1 forensic map ' || left(p_source_hash,12) || '; ' || p_source_kind || '; occurrences=' || occurrences::text,
      p_source_hash
    from expanded
    where question_family ~ '^QF-[A-Z0-9]+$'
      and competency_id ~ '^AC-C[0-9]{2}$'
      and occurrences > 0
    on conflict (id) do nothing
    returning 1
  )
  select count(*)::integer into inserted_count from ins;

  return inserted_count;
end
$$;

revoke all on function private.seed_question_evidence_contract_set(text,text,text,text,text,text,text,text,text,text,text)
from public, anon, authenticated;

comment on function private.seed_question_evidence_contract_set(text,text,text,text,text,text,text,text,text,text,text) is
  'Migration-only helper that expands compact source-review hashes into governed question evidence contract rows.';
