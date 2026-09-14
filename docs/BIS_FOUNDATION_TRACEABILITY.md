# BIS Learning Consolidation — Foundation Traceability

Authority: `BIS_LEARNING_CONSOLIDATION_BLUEPRINT.md`, approved 14 September 2026.

| Requirement | Category | Source decision | Implementation | Acceptance evidence | Status |
|---|---|---|---|---|---|
| BIS-FND-001 | Frozen | Canonical editions are School, Emerging Adult, Workplace | `lib/learning-foundation.ts`; `learners.delivery_edition` | `learning-foundation.test.mjs` | Implemented |
| BIS-FND-002 | Derived | Delivery programme context must not redefine edition | `learners.delivery_context` | Edition/context constraint test | Implemented |
| BIS-FND-003 | Frozen | Frozen manuscripts compile into versioned content cartridges | `content_releases` and controlled Habit 1.4 release records | Release identity test | Implemented |
| BIS-FND-004 | Frozen | Evidence must retain Lab and content provenance | `responses`, `evidence_records`, `hypotheses`, `experiments` release linkage | Lab isolation test | Implemented |
| BIS-FND-005 | Frozen | Multiple Labs must not share a global active experiment lock | Lab-scoped experiment queries and partial unique index | Lab isolation test | Implemented |
| BIS-FND-006 | Frozen | Experiment protocols are Lab-specific | `experiment_protocol`, `protocol_version` | Protocol assertions | Implemented |
| BIS-FND-007 | Frozen | Progress uses stable semantic IDs and server persistence | `handbook_progress`; `/api/learning` | Progress and RLS test | Implemented |
| BIS-FND-008 | Frozen | Certificates derive from evidence and a completed enrolment | `certificate_awards.evidence_snapshot` | Certificate provenance test | Foundation schema complete; issuance follows player milestone |
| BIS-FND-009 | Implementation | Existing records remain usable after migration | Deterministic age-band and Lab-prefix backfill | Production preflight counts plus post-migration verification | Pending production migration |
| BIS-FND-010 | Implementation | Existing learner routes remain unchanged during Foundation | Additive API/schema changes; no canonical-route redirects | Existing acceptance suite | Implemented |

## Deliberately deferred

- The Investigation Player and typed block renderer.
- Decision and Money edition-specific content cartridges.
- Identity Lab availability and evidence protocol.
- Migration of browser-local Habit reader progress into `handbook_progress`.
- Certificate issuance UI and rendering.

These belong to later milestones and are not inferred from incomplete source material.

