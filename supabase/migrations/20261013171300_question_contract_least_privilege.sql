-- Evidence-contract rows are infrastructure metadata in this phase. Runtime consumers
-- use the scoped RPCs; no authenticated client needs direct table reads.

drop policy if exists question_evidence_contract_admin_read on public.question_evidence_contracts;
revoke all on table public.question_evidence_contracts from public, anon, authenticated;

comment on table public.question_evidence_contracts is
  'Source-reviewed question meaning contracts. Direct client access is disabled; scoped BIS RPCs are the runtime boundary.';
