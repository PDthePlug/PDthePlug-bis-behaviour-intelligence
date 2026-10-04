# BIS full-scope takeover — 4 October 2026

## Candidate and acceptance basis

Base: `18e7096ffbfe1c50d519e322437be1049429ead3` (`main`). Candidate branch: `implementation/bis-full-scope-20261004`. This work follows the conversation-to-delivery audit's R01–R13 requirements, the original QA/workbook reviews, and the engineering contract. Retrieved conversation summaries supply context; they are not complete verbatim transcripts. A narrow PR pass does not close the wider product milestone.

The original DOCX corpus is unchanged. The catalogue retains 34 shelves and the supplied corpus contains 32 authored Labs. Missing source is not replaced with invented content. The ten learning touchpoints and nine Lab stages remain the programme structure.

## Implementation and remaining evidence

| Requirement | Candidate changes or existing capability | Acceptance still required |
| --- | --- | --- |
| R01 All views, roles and backend integrity | Transactional publication; transactional answer/evidence history and measurement/source snapshots; consent-scoped writes; focused responsive regressions | Real authenticated role/task-state matrix and production readiness certificate |
| R02 Faithful digital handbooks and controls | Existing lossless handbook compilation retained; bounded certainty controls and distinct cue/reward groups repaired; mobile/desktop regressions | Complete page-by-page handbook/Lab acceptance with real sessions |
| R03 Full Phase A → experiment → Review → Profile → learning loop | Legitimate no-opportunity evidence and missing-count semantics repaired; existing calendar and handoff gates retained | Twenty complete authenticated staging learner journeys; simulated dates must be labelled simulation |
| R04 Persisted evidence-derived measures and portfolio | Atomic measurement/source replacement rejects stale or foreign responses; actual presentation version recorded; portfolio labels load verified published enrolment artifacts | Real API persistence, refresh and portfolio/provenance verification through the full lifecycle |
| R05 Useful programme intelligence | Typed numeric response aggregation; historic published question registry retained; withdrawn/inactive learners excluded; cohort and cell suppression preserved | Programme-owner evaluation of actual cohort reports; model-assisted interpretation remains a future contract |
| R06 Collect once, reuse and preserve evidence classes | Group-aware repetition checks preserve intentional authored reuse; explicit review acknowledgement and notes required for REVIEW sources | Human decision on fourteen REVIEW sources; no blanket waiver |
| R07 Universal migration with continuity and rollback | Own published Universal enrolment remains pinned after replacement; offline titles stop runtime access; rollback follows real activation history | Legacy STATIC answer migration/parity and rollback proof before retiring compatibility paths |
| R08 Source/input/calculation/Profile mapping | Legacy Prediction retains authored questions and gains explicit Pattern evidence; authored How certain scales repaired; source pipeline validated | ENT Awareness/Mindset ambiguity needs an author decision; do not invent a scale conversion |
| R09 Risk factory and Identity reuse proof | Compiler/presentation/save-validator exercised on source-backed specimens; governed lifecycle repairs available | Real Studio prepare/preview/publish and authenticated persistence for Risk and Identity |
| R10 Complete Content Studio lifecycle | One transaction for publish/unpublish/republish/rollback, exact artifact/UAT identity, independent edition preservation, restore controls | Actual authenticated Studio lifecycle with recorded original activation and restoration |
| R11 Twenty varied complete demo learners | Twenty source-backed local specimens cover HAB/DEC/MON/RSK/IDN and five portfolio anchor stages | These are local specimens, not twenty completed staging learners; real accounts and journeys remain pending |
| R12 Uploads, re-entry, consent and privacy | Existing private upload implementation retained; owner/consent checks included in transactional evidence persistence | Current-candidate real photo capture, wrong-user denial, refresh and withdrawal matrix |
| R13 Every operational role, invitations and email | Existing role-specific surfaces retained; aggregate reporting checks strengthened | Invitation acceptance, real inbox verification, exports, recovery and all role journeys |

## Verification

`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/bis-browser-bin/chromium npm run verify` passes:

- Lint, TypeScript and optimized production build.
- 532 acceptance tests, no failures or skips.
- All 32 supplied Labs through the actual source adapter, compiler, presentation and save validator; zero structural blockers.
- 45 browser tests at 360, 430 and 1280 pixels, including interactive Studio recovery/rollback and persisted no-opportunity selection.

Database tests run actual PostgreSQL through PGlite with canonical table constraints and controlled role/authentication context. Seven publication/continuity, six cohort-query and seven evidence-write tests cover transaction failure injection, repeated restoration, independent editions, version continuity, typed aggregation, privacy suppression, answer history, idempotent retries and stale-source rejection. They do not establish real Supabase authentication. Browser tests use an isolated intercepted harness and do not certify live publication. Twenty local evidence specimens do not establish a real-world outcome study.

The evidence RPCs are security invoker, use existing ownership RLS, and validate active product consent, enrolment ownership and availability. Authored prompt, requiredness and calendar validation remain in the authenticated application before calling the RPCs. No privileged learner bypass or client clock override is introduced. Response saving, computed snapshot synchronization and progression are distinct transactions: saved evidence remains recoverable if later computation fails; no claim is made that the entire multi-step request is one transaction.

## Environment and release state

Only BIS Staging (`lbmhkddrkhtmkcvfmumd`) received schema changes:

1. `atomic_content_publication`
2. `universal_enrolment_continuity`
3. `question_pattern_typed_observations`
4. `atomic_universal_evidence_writes`

The offline activation-state schema already existed in staging and its migration is restored to the candidate. Anonymous execution is denied on the new write RPCs; authenticated execution is allowed and security-invoker status was checked. No production schema/data changes or candidate publication were performed.

The production Vercel deployment inspected during takeover is READY but serves commit `1c39d8b53cff665f5f372d71707ac774cdb91da9`, not this candidate. Do not mark the portal current or this milestone delivered. Apply required production migrations before deploying dependent code, after staging acceptance.

Automatic approval review rejected sending 24 generated synthetic account credentials to an account-provisioning Edge Function because authorization of the specific destination project had not been established. No confirmed synthetic accounts were created. The temporary provisioner was disabled: JWT verification enabled, body returns HTTP 410, no administrative capability. Do not route around the rejection using SQL, password resets or another provisioner.

Next blocked operation: explicit authorization to create twenty dedicated synthetic learner accounts and four operational test accounts (administrator, facilitator, programme owner, safeguarding) in the verified BIS Staging project. Credentials stay outside source control. After authorization, complete real factory, learner, privacy and role proofs; resolve authored ambiguities; then update this ledger and certify the exact candidate before merging/deploying.
