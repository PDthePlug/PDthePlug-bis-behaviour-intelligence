-- Questions without an approved source meaning contract must not inherit automatic
-- aggregation or model-review permission from compiler heuristics. They remain
-- candidates until content governance explicitly approves their meaning.

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

revoke all on function private.apply_question_contract_before_write() from public, anon, authenticated;

-- Existing compiler-generated candidates that have no source contract are also
-- closed immediately rather than waiting for a future content republication.
update public.question_analysis_registry r
set
  aggregate_policy = 'EXCLUDE',
  model_review_policy = 'DISABLED',
  status = 'CANDIDATE',
  contract_id = null,
  updated_at = clock_timestamp()
where not exists (
  select 1
  from public.question_evidence_contracts c
  where c.lab_code = r.lab_code
    and c.question_family = r.question_family
    and c.contract_status = 'APPROVED_MEANING'
);
