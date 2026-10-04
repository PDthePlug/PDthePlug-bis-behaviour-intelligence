# BIS staging demo execution — 4 October 2026

This is a synthetic staging demonstration, not a participant outcome study or production release certificate.

- Backend: BIS Staging, `lbmhkddrkhtmkcvfmumd`. Production was not accessed or altered.
- Provisioned 20 learner, one SYSTEM_ADMIN and one FACILITATOR account using the Supabase Auth administration API. The temporary allowlisted provisioning function now returns HTTP 410 and has no administrative capability. Normal signup remains enabled with email confirmation required; mail delivery and self-service confirmation are unverified.
- 20/20 learner checks passed so far: normal password sign-in, consent/onboarding, 11 baseline fields and four additional authored Habit evidence fields, authenticated re-read, and learner Content Studio HTTP 403 denial. Learner 01 entered the baseline through the real browser controls; remaining evidence writes used the normal authenticated application API. These checks do not certify completion of Phase A.
- Four answer formats: frequency choices, integer ratings, text and boolean; one optional question deliberately passed. Independent database verification found 300 current responses across 20 learners, one passed question, and zero missing evidence anchors. Original responses remain auditable.
- Cohort `201375eb-dc2e-4c83-8d41-a1c3380e3269` was created through the authenticated staff API. Twenty tagged synthetic learner memberships were provisioned through a scoped staging SQL insert; invitation acceptance is unverified.
- Habit workbook uploaded to `content:lab:HAB:4.5.3`, compiled and previewed. All nine actual preview stages were rendered at 360, 430 and 1280 pixels (27 states, zero page overflow).
- Approval refused the workbook's Prediction/Pattern migration gap. No Universal activation was performed, the existing 4.5.2 Habit compatibility runtime remains active, and production data was not reset. The UAT checklist was corrected to retain outstanding gates; no independent human UAT is claimed.
- Live baseline saves exposed a timeout under concurrent load. Bounded independent writes and parallel scoped reads now preserve field correction/investigation order and wait for in-flight writes before reporting an error. Failed scenarios were retried separately; earlier timeouts remain part of the evidence.
- `npm run verify`: lint, TypeScript, 479 acceptance tests, 32-Lab canonical-source audit with zero blockers, optimized production build, and 36 fixture browser tests passed.
- Signed-in staging authentication/role/responsive suite: three tests passed after correcting an ambiguous denial locator. Fixture browser tests remain separate from real staging evidence.

Privacy/attachment checks:
- Private evidence upload restored after reload: passed
- Learner cannot read another learner responses: passed
- Owner can download; wrong learner cannot download private upload: passed
- Facilitator signs in and sees 20-member cohort without private reflection text: passed
- Unfinished check: Full handbook timing journey remains unverified; the added DOM regression checks metadata in table cells.

Remaining release gates: calendar-day Phase B evidence, no-opportunity evidence, complete Phase A, Evidence Review/Profile completion and portfolio provenance, email verification delivery, independent acceptance, governed activation and rollback. The workbook's "How certain" scale presentation and ENT awareness/mindset mapping need further source review. Do not infer behaviour change from the generated baseline ratings.

Private credentials, cookies and traces are excluded from this document and git.
