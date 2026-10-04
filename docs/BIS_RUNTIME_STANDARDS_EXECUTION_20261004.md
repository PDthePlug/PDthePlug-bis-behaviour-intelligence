# BIS shared runtime and learning standards execution — 2026-10-04

## Decision

This candidate fixes shared learning presentation, governed Lab selection,
version-scoped staff progress, private photo counts, and the evidence-to-programme
reporting path. It is a reviewable implementation candidate, not a claim that
HAB/DEC/MON have been migrated, that new learning editions have been published, or
that authenticated staging acceptance and production release are complete.

Base: `0bb8181427484ff5e39369ec8e07a8ad73f0bc1c` on `main`.
Branch: `implementation/bis-runtime-standards-20261004`.

## Requirement ledger

| Requirement | Implemented behaviour | Proof and remaining acceptance |
| --- | --- | --- |
| Universal is canonical for every Lab | Learning checks the authenticated governed runtime for HAB, DEC, MON and other codes; Universal links take precedence. Dedicated APIs reject incompatible/offline versions. | Positive/negative loader contracts, runtime-resolution SQL transactions, source-backed Universal browser journeys. HAB/DEC/MON still need governed Universal publication and migration acceptance. |
| Existing learners keep their work | Own published, previously activated version wins; a title taken offline blocks access. Assignments pin versions without copying progress or answers. Universal enrolment waits for the learner privacy acknowledgement. | Runtime-resolution database tests; assignment regression contracts. No live learner migration performed. |
| Translated tables retain meaning | Shared Word reader preserves blank rows, paragraph breaks and horizontal/vertical merges. Simple tables use labelled mobile rows; merged tables retain their geometry. Preview and learning use the same enhancement. | Compiler, adapter, canonical-source audits and 360/430/1280px table journeys. Nested Word tables and every possible Word formatting feature are not certified. |
| Controls remain grouped and save separately | Table/row information groups bind response controls. Duplicate generated IDs receive distinct IDs while the first historic ID stays unchanged. Authored worked examples remain text. | Browser journey restores a historic answer, saves two independent answers and reloads both. Complex merged tables do not infer editable blank cells. |
| Derive values from actual evidence | Universal learning projects named source-defined measurements, preserving pending states; daily coverage uses the authored duration. Weekly windows are not presented as observed days. Bound calculated controls become outputs. | Named-field, pending-value, daily/weekly and authored-example contracts. No invented indices or generic behavioural score. |
| Shared identity survives runtime handoff | Profile, consent and roles are independent of the retired Habit runtime. Setup preserves existing enrolments and creates compatibility enrolments only for the explicit static mode. | Account/consent and guarded endpoint regression contracts. Live role/consent re-entry is pending protected staging sessions. |
| Images contribute to the learner portfolio | Private object counts are scoped to authenticated user, enrolment, Lab and semantic investigation; photo-only anchors can be recorded without inventing a measurement. Enrolment keys clear stale image/form state. | SQL ownership/context negatives and portfolio contracts. Counts do not disclose object paths or image content. Real authenticated upload/removal/re-entry remains pending. |
| Programme reporting updates with evidence | Version-scoped, source-linked responses and anchored measurements feed aggregate stage/totals. Refresh and focus reload results; revoked access clears prior data. | SQL role/scope/version/withdrawal/small-cell tests and responsive refresh/revocation journeys. Counts are activity evidence, not proof of behaviour change. |
| The downloadable report matches Universal results | Universal dashboard and PDF show recorded evidence, learning checks, question patterns and programme decisions without substituting legacy behavioural measures. Cohorts below five and cells below three are withheld. | Generated-PDF tests and dashboard browser journeys. Delivery to an external programme system was not commissioned; the existing programme outcome workspace and PDF are the connected destinations. |
| Admin/facilitator dashboards reflect the selected Lab | Group/assignment choices come from published active Labs. Cohort progress matches Lab and version; started Universal experiments are recognised. Unknown opportunity counts are unavailable, not zero. | Administrator/facilitator journeys, scope SQL tests, regression contracts. Four-role live acceptance remains pending. |
| Content Studio produces current learning and Lab previews | Compiler identity advances to `bis-content-compiler-7`; table preservation and editorial UAT feedback are shared by prepared content. Source hash mismatches fail closed; client-side public handbook fallback is removed. | Existing source-to-compile-to-preview/UAT/publication transaction tests and Studio browser tests. Older prepared editions require preparation and current UAT before explicit publication. No edition was activated in production. |

## Fresh verification

`npm run verify` passed on the final code revision:

- Node runtime check, ESLint and TypeScript.
- **553 acceptance tests**, including migration SQL and generated-PDF checks.
- **32 canonical-source audits**.
- Optimized production build.
- **57 browser tests** at 360px, 430px and 1280px, using the existing one-worker
  configuration and 90-second per-test limit.
- `git diff --check` passed.

These are fresh results from the recovered candidate; earlier lost-workspace
results are not used as acceptance evidence. GitHub CI and deployment results
must be checked separately on the pushed commit.

The three canonical Word files were byte-checked against the supplied project
sources: Volume 1, Volume 2 and Volume 3 are unchanged (101, 134 and 171 tables).
The source audit exercises the real adapters, compiler, presentation and save
contracts, rather than substituting rewritten source text.

Browser tests exercise actual shared components in the deterministic harness;
they do not authenticate against Supabase. The revoked-access test asserts the
intentional 403 and cleared data, while rejecting every other console/page error.
No timeout, worker count or existing acceptance gate was weakened in this change.

## Append-only database changes

The following migrations are present in this candidate and were applied to
**BIS Staging** (`lbmhkddrkhtmkcvfmumd`):

1. `20261004154806_programme_evidence_flow.sql` — aggregate source-linked flow and own private attachment counts.
2. `20261004154823_preserve_static_enrolment_handoff.sql` — published own-version continuity and governed assignment fallback.
3. `20261004190251_staff_experiment_version_scope.sql` — cohort-scoped experiment version metadata without private experiment wording.

The three new reporting/metadata public RPCs are security invokers. Their private
helpers use an empty search path, authenticate and enforce their existing scope;
anonymous execution is revoked. Fresh database tests execute the migration SQL
with positive and negative ownership, scope, version and withdrawal cases.
These tests use isolated fixtures and do not constitute a live RLS acceptance run.

Staging verification found no new advisor warning for these three public
wrappers. Four older public security-definer warnings and the existing disabled
leaked-password protection setting predate this candidate and remain separate
hardening work.

No production migration, account creation, learner mutation, content activation,
legacy deletion or production deployment was performed for this candidate.
Production requires these migrations **before** the new application release.

## Completion gates and order

1. Push this exact candidate, open a PR, and obtain its CI and Vercel preview
   results. Keep a failed or pending check visible rather than implying success.
2. Supply the protected staging-only Auth Admin connection, protected learner and
   staff sessions, synthetic-account credential store, and controlled inbox
   specified in `STAGING_ACCEPTANCE_REPORT_20261004.md`. Execute the R01–R13
   lifecycle and role matrix with approved fixtures, including uploads, removal,
   withdrawal, revoked scope, mobile re-entry and delivery. No synthetic account
   credentials were invented or borrowed from another environment.
3. Prepare the intended Lab and learning editions from immutable authored source
   using compiler 7. Inspect the prepared preview, complete current UAT and the
   explicit publishing decision; preserve previous activation for rollback.
4. For HAB/DEC/MON, map existing semantic fields, measurements, evidence,
   attachments, consent and enrolment versions to each published Universal
   version. Prove parity and rollback on protected staging data before migrating
   real learners. A new assignment must never stand in for a migration.
5. Remove dedicated compatibility implementations after that proof. RES already
   uses Universal; the user's spoken Lab names do not authorise an invented
   rename or deletion of unrelated catalogue titles.
6. Apply the production schema prerequisites and release the accepted exact SHA
   to Vercel, then verify authenticated role journeys and responsive rendering
   on that deployment. Preserve the prior deployment and activations for rollback.

At the production baseline inspected for this work, HAB 4.5.2, DEC 4.2.1 and
MON 4.2 were static; RES 1.0 was published Universal. The three Universal drafts
and new learning editions were not accepted as live merely because they existed.
The earlier authenticated acceptance status therefore remains **blocked**, as
documented in the retained R01–R13 report, until the protected live run succeeds.
