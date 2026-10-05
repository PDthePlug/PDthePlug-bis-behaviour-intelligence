-- RETIRED: PR #32-era Leap9 production demo seed.
--
-- PR #111 (BIS demo evidence certification) is the canonical demo contract.
-- The old fixture hard-coded a founder-owned production cohort, HAB 4.5.2 and
-- synthetic rows without the current version-scoped evidence-certification
-- lifecycle. Keeping that script executable would allow an obsolete demo model
-- to be reintroduced after the Universal/evidence architecture replaced it.
--
-- Canonical demo verification now lives in:
--   docs/BIS_INTELLIGENCE_AUDIT_20261004.md
--   docs/BIS_DEMO_EXECUTION_20261004.md
--   tests/staging/evidence-intelligence.spec.ts
--   tests/sql/evidence-intelligence-staging.sql
--
-- This file intentionally fails closed if invoked by an old workflow.

do $retired_demo_seed$
begin
  raise exception 'Retired BIS demo seed: PR #111 evidence certification supersedes the PR #32 Leap9 fixture.';
end;
$retired_demo_seed$;
