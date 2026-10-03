# Learner compatibility and release evidence

## Changes

- Completion uses persisted investigation progression to seal previously completed stages. Recovered required fields remain required in unfinished stages. Revisited stages accept valid edits without inventing answers. Calendar-derived review availability is not completion evidence. Baseline acceptance is read from the saved baseline audit event or subsequent persisted progression.
- Save audits record presentation version and required prompt IDs. These are evidence snapshots; the compatibility rule is sealed-stage progression, not an immutable per-enrolment schema system.
- Reopening a Lab no longer resets its completed status.
- The shared learning renderer labels authored questions alongside their inputs, separates independent questions, preserves the original ID and answer, and assigns stable `.PART.N` IDs to additional questions. Narrative and reference-only Lab material stay outside this conversion.
- The one-column shared baseline introduction is static. Desktop browser acceptance discovered that its previous sticky positioning obscured the rating controls.
- Canonical Word manuscripts and SHA-256 provenance are committed. All 32 Labs pass the actual adapter, compiler, presentation and submission-contract audit, including every experiment day. CI and deployment builds run it.
- Playwright uses a separate test-only app with the real shared Lab renderer, learning player, DOM enhancements, navigation shell and CSS. It covers mobile 360/430px and desktop: numeric baseline save, I1–I6, three separate leadership scaffold fields, I7 current-day capture and future-day exclusion, exact handback, I8/I9, completed-stage revisits, Today reminders, browser Back, and learning-question hierarchy. API/storage responses are isolated specimens; this is not signed-in production UAT. PNG comparison baselines and failure traces are retained.

## Production database verification

Applied migrations match production migration history:

- `20261003072718_private_analytics_and_content_indexes.sql`: six public analytics RPCs retain their names and authorization checks through invoker wrappers; privileged bodies moved to private. Three missing FK indexes added. One combined content catalogue SELECT policy preserves the old learner/admin access; separate admin write policies preserve mutations.
- `20261003072848_consolidate_leap9_preserving_facilitators.sql`: one active Leap9 with 21 memberships. The secondary row is retired, not deleted. Membership IDs and learner evidence are preserved; both facilitator accounts retain access through explicit scoped co-facilitator authorization. New dependencies/duplicate memberships cause the migration to abort.

Live SQL verification checked administrator reporting, the secondary facilitator's canonical access, denial for an unassigned authenticated identity, and denial of retired-cohort facilitator access. Supabase advisors now show no public-definer, missing-FK-index or overlapping-policy warnings. Informational unused indexes were retained.

## Remaining release work

- Exact-artifact certification and UAT remain open: 29 active dynamic Lab artifacts are private Storage objects; the connected database tools do not download their bytes. No UAT rows were fabricated, and no content was bulk republished. `scripts/audit-active-lab-artifacts.mjs` compares authorized fingerprinted exports with the canonical corpus and reports individual failures. Reconcile export counts against production before declaring full-library certification.
- Apex `https://bisportal.online` still returned GoDaddy DPS during this pass; `https://www.bisportal.online` returned Vercel/BIS. Both domains are registered on the Vercel project. The registrar DNS change requires DNS-management access not exposed by the connected tools. The existing application redirect cannot repair requests that reach GoDaddy first.
- Leaked-password protection remains disabled. This requires Supabase Auth management access not exposed by the database tools.
- The shared learning fix does not certify every active learning artifact against its manuscript. That needs the same authorized exact-artifact review as Labs.

## Validation

435 Node acceptance tests, lint, TypeScript and production build passed locally. Canonical source audit: 32 Labs, zero blockers. Browser reports and PNG references live with the browser suite; GitHub CI runs Chromium acceptance and uploads reports/traces. Production deployment SHA/readiness must be checked separately from a successful push.
