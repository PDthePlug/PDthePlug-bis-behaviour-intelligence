# Consolidated BIS staff, evidence and operations release

This release continues from main `9af99e6d983339080bf0527978af75e645af8189` and combines the interrupted staff/evidence work with the Leap9 programme experience and every pending feature PR observed on 5 October 2026. Existing branches and recovery references remain available.

## Branch and requirement accounting

| Original work | Delivered behaviour |
| --- | --- |
| Staff evidence architecture `2105e7e` | Centred role-specific staff menu, class sessions and attendance, shared-evidence review, immutable rubric assessments, original evidence and calculation history, aggregate assessment reports. |
| Leap9 experience `5a169e4` | Public fictional participant/facilitator/outcome journey and downloadable illustrative report; clear separation from private programme records. |
| #111 and evidence intelligence follow-up | Evidence intelligence, synthetic demonstration and audit records recovered from `de96bea`; newer main response/publication/privacy boundaries retained. |
| #110 | Vercel Analytics integration, enabled only when hosted on Vercel. |
| #57 | Handbook heading/checklist/equation/table corrections and responsive reader verification recovered beside the latest shared document renderer. |
| #45 | Real Risk DOCX compiler acceptance and authored controls recovered. No unapproved Risk publication. |
| #75 | One-pass programme setup, generic published Lab/version plan, bulk and pending participants, scoped co-facilitators and editable access. Invitation claims are identity/consent-bound. Atomic access edits protect the final administrator. |
| #2 | Protected commercial overview, pipeline, organisations, contacts, tasks, proposal registry and activity timeline. Current environment guard retained; commercial read-only is enforced by RLS. Activity, stage change and audit save in one transaction. Commercial navigation uses the shared centred menu. |
| #105 | No unique file delta; current main already has the newer Universal/Content Studio implementation. Its history is preserved without reverting current files. |
| #104 | Newer main already implements offline activation, atomic unpublish and rendered recovery checks. Preserved without restoring obsolete routes. |
| #103 | Current Content Studio acceptance contract supersedes the older source assertions. Preserved without replacing current tests. |
| #98 | Current fail-closed staging harness includes its signed-in journeys and stronger identity checks. Preserved without restoring older tests. |

The superseded branches are merged with the current tree retained. Other old remote branches include previously merged/squashed work and preservation references; they are not independently deployed or deleted. The 4 October recovery ledger remains a historical snapshot; the table above supersedes its unfinished #75/#2 status.

## Database release order

Staging already contains the five staff/evidence migrations and now also contains the recovered commercial schema, programme onboarding, workspace consolidation integrity and atomic staff access migrations.

Production already contains the commercial schema and original seeds. Do not reapply or overwrite those records. Apply these missing migrations in order:

1. `20261005113046_staff_evidence_assessment_engine.sql`
2. `20261005120424_evidence_staff_identity_fallback.sql`
3. `20261005120231_facilitator_class_operations.sql`
4. `20261005121639_evidence_engine_integrity_guards.sql`
5. `20261005122458_longitudinal_measurement_snapshots.sql`
6. `20261001123500_programme_onboarding.sql`
7. `20261005151940_workspace_consolidation_integrity.sql`
8. `20261005160300_staff_access_transactions.sql`
9. `20261005161500_historical_response_anchors.sql`

The production preflight also found 264 older imported responses without portfolio anchors. The ninth migration preserves each retained original value, timestamp, privacy classification and revision status. It leaves investigation attribution explicitly historical rather than guessing an authored task.

Production customer records are not QA fixtures. Schema prerequisites and structural historical backfills are controlled release operations; functional database mutation tests run only in Staging and roll back. No email, WhatsApp or other outreach is sent by commercial activity logging.

## Verification and limits

`tests/workspace-consolidation.test.mjs` executes real PostgreSQL semantics for programme creation, atomic rollback, pinned versions, retries, co-facilitators, pending claims, consent withdrawal, removed membership, withdrawn enrolments, wrong roles/scopes, commercial read-only, immutable audits, stage discipline and final-administrator protection.

`tests/sql/workspace-consolidation-staging.sql` and `tests/sql/staff-evidence-staging.sql` passed on the actual Staging project after all migrations. Both rolled back every synthetic mutation.

The full `npm run verify` result and deployment revision are recorded with the release/PR after completion. Browser journeys run at 360, 430 and 1280 pixels, including group setup, centred navigation, keyboard focus, commercial error recovery, evidence sharing/revocation, rubric reviews, class attendance, reports and portfolio history.

Authored rubric templates are source-backed. Structural prompt mappings remain UNCLASSIFIED until an administrator approves their evidence purpose/outcome/competency and links exact published prompt anchors; the release does not invent curriculum meaning or automatically grade historical learner work. Longitudinal records begin with evidence actually retained; absent five-year history is not reconstructed. Full 195-page editorial certification and Analytics dashboard collection remain separately scoped from the tests in this release.

Staging security advisors report no new finding for these additions. Existing public runtime/sponsor definer warnings and disabled leaked-password protection remain recorded infrastructure follow-ups.
