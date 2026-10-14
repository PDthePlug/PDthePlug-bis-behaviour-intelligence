# BIS development reporting implementation — 14 October 2026

## Delivered in PR #162

The draft now includes the released PR #161 changes and connects current human-reviewed task metadata to the facilitator development view and the shared institutional dashboard/PDF report model. It retains the separate participation, baseline, practice, task-review, support and delivery sections. It does not turn record presence, a review disposition, a rubric link or a question's potential ceiling into an attained competency stage.

Three append-only corrections address defects found during takeover:

- `20261013172000_reporting_exact_cohort_and_release_scope.sql`: support counts belong to the selected cohort; handbook progress must match the exact enrolled content release; comparison candidates must be authorised, meet current-consent population thresholds and share the same explicit content releases. An unresolved release cannot be inferred from a Lab code.
- `20261013172100_reviewed_evidence_authority_and_permissions.sql`: guarded private adapter execution is granted so public invoker wrappers function; reviewed evidence requires the current approved contract, latest mapping and active exact-version registry; programme aggregation requires explicit source and runtime permission. Current reviews carry no attained stage or calibrated confidence.
- `20261014040000_question_contract_retirement_integrity.sql`: explicit retirement remains retired through write triggers and refresh; retired rows cannot append a new approved mapping; direct contract-table access remains denied.

Contract-derived allowed and forbidden inference now reaches all three response-review agents. The programme agent also rejects small cells, reconstructable complements and incomplete partitions before any model call. Model proposals remain non-reportable and the feature remains disabled.

## Staging state

BIS Staging (`lbmhkddrkhtmkcvfmumd`) contains all 1,975 approved-meaning contracts from the ten supplied Lab titles. Seventy runtime question rows currently match those families and have contract-backed mappings. These are semantic approvals, not psychometric validation or achievement assessments.

All seeded source contracts retain `aggregation_policy=EXCLUDE` and private-by-default scope. Sharing a response with a facilitator cannot authorise programme aggregation. The institutional reviewed layer therefore reports only separately aggregate-permitted contracts; current empty coverage is an honest evidence limitation.

Original data counts are unchanged after migrations and rollback testing: 40 learners, 2,725 responses, 2,725 evidence records, one submission and one assessment. No QA-only contract remains. No curriculum activation, learner answer or assessment result was rewritten.

## Verification

- Focused browser suite: 45 passes across 360px, 430px and 1280px. Includes keyboard-accessible chart values, non-repeated reviewed findings and immediate learner-switch isolation with a delayed prior request.
- Focused database/model suite: 23 passes, including actual migration execution, latest-review authority, retired contracts, revocation, consent/enrolment/role denial, aggregation exclusion and small-cell/complement withholding.
- Hosted rollback SQL: the existing P3/consent/comparison suite and the new real-trigger reviewed-evidence suite both pass. Fixtures roll back, including original evidence and synthetic meaning contracts.
- Eight real Auth/API/browser staging checks pass, including source identity, three QA roles, programme/facilitator metadata, role denials, institutional PDF and the real results page at all three widths. See `BIS_REVIEWED_STAGING_RESULTS.json`.
- Security Advisor retains the two existing warning categories (four legacy public definer functions and leaked-password protection). The new public adapters are invoker functions, anonymous execution is denied, and no new error-level finding remains.

`npm run verify` passed lint (one pre-existing unused-variable warning), TypeScript, 757 acceptance checks, canonical source audits, the optimized build, all 15 retained serverless learning-package checks and 352 browser tests with zero failures and two existing viewport-conditional skips. After the retirement regression was added, the final acceptance run passed all 759 tests. No timeout was increased or test removed to obtain these results.

## Release boundary

PR #161 is live on production from 13 October 2026. PR #162 and its Evidence Intelligence migrations remain staging-only; the model is disabled. This document certifies the deterministic reporting and permission paths described above, not model quality or all 34 Labs.

## What still prevents the full goal

1. The supplied newer manuscript covers ten Lab titles, not the full 34-title catalogue. Remaining titles require their canonical source and version/edition bindings.
2. The 2,140 task/ambiguous families need authored assessment meaning, criteria and claim authority. A semantic ceiling does not say which response achieved it.
3. Opportunity-based rate definitions require exact numerical numerator/denominator bindings; day counts cannot substitute for eligible opportunities. Legacy and new editions are not automatically comparable.
4. Acquired capability, repeated independent behaviour and sustained transfer need reviewed achievement/observation rules and follow-up evidence, rather than completion or self-report alone.
5. Model activation requires labelled evaluation, privacy/data-processing certification and confidence/overclaim checks. Draft model proposals cannot establish programme outcomes.
6. Facility-wide reporting needs a governed facility boundary and unique-participant deduplication. Authorised cohort counts must not be added as unique people.

These are explicit evidence and source dependencies. The implementation fails closed at each one rather than generating unsupported developmental claims.
