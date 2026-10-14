# BIS Development Intelligence reporting

This release replaces completion-led reporting with source-governed developmental evidence. It extends PR162 rather than changing the authored programme or exposing learner introspection.

| Audience | Product | Implemented decision support |
| --- | --- | --- |
| Learner | My Development Portfolio | First comparable/current capability fingerprint, dated trajectories, separate source-defined learner-report baseline, compatible perception alignment, next approved practice and follow-up |
| Assigned facilitator | Learner Development Intelligence | Strengths, current reviewed capability, evidence coverage, independent application days, recent review pattern, watch indicators and source-approved practices |
| School/programme | Cohort Development Report | Authorised-group heatmap, reviewed stage/change distributions, evidence basis, acquisition/transfer/follow-up, safe monthly assessed-application series and intervention planning |
| Partner/funder | Programme Outcomes & Impact Report | Development-first executive overview, supported assessed growth, continued support needs, transfer, evidence denominators and the same charts in the downloadable PDF |

## Evidence boundaries

The model uses the 15 competencies in the authored Applied Commerce framework. The proposed ten generic domains have not been substituted for authored constructs. The ladder describes ordered reviewed evidence stages, not completion, a personality score or a diagnosis.

Comparisons require the same approved criteria family, evidence basis and distinct original evidence timestamps. A later self-description cannot overwrite an assessed task. Independent repetition requires separate original evidence days. Transfer requires earlier independently applied evidence and a different context; follow-up uses an authored interval. Perception alignment requires a source-approved compatible scale and describes agreement only.

Source-defined baseline evidence remains separate from a first comparable task review; neither is silently described as programme entry. Lines join actual dated reviews without claiming intermediate measurement. Monthly aggregate series are descriptive snapshots of the current eligible population, not paired longitudinal effect estimates. Missing/small cells break the line.

Private reflections are not included. Individual reports remain learner/assigned-facilitator scoped. Derived aggregate use requires separate revocable learner permission. Cohorts below five and cells/complements below three remain suppressed; optional partitions fail closed. Cohorts and capabilities may overlap and are never added into a false unique-learner total.

All 34 catalogue titles appear in source-readiness governance. Exact-version coverage distinguishes registered fields, approved meaning and baseline/application/transfer task contracts. This is an authoring workflow, not a claim that every title has complete achievement criteria. The newer reviewed manuscript supplies 10 title families/29 editions; 2,140 ambiguous task families remain unapproved. Source mapping is not scientific measurement validation.

## Seven reporting questions

1. Entry: source-defined learner-report baseline when present; otherwise explicitly unavailable.
2. Strengths/needs: reviewed capability profile and support priorities.
3. Change: dated, source-comparable task reviews and cohort distributions.
4. Evidence strength: coverage/repetition and transparent denominators, not psychometric confidence.
5. Understanding/application: separate stage, evidence-basis, repetition, transfer and follow-up views.
6. Intervention: approved practices and an authorised programme decision with owner/review date.
7. Effectiveness: descriptive outcomes and evidence limits; causal impact still requires an appropriate evaluation design.

## Verification and release

Focused model/native SQL checks: 31 passed. Populated browser/PDF journeys: 63 focused checks passed at 360px, 430px and 1280px. The local build/acceptance/source gates passed; its browser process stalled after 69 checks and was interrupted. The first complete CI run reached 365/372 checks before the job limit; its logs exposed an obsolete partial portfolio fixture and a missing malformed-response recovery path. The fixture now uses the actual model builder and partial reports fail closed with Retry. The 30 full Lab journey checks also passed with two workers in 1.4 minutes. CI uses two isolated browser workers to run all checks within the existing 20-minute job and 90-second test limits. Complete exact-head `npm run verify` remains mandatory before merge. Populated PDF pages were visually inspected, including the development-first executive page and missing-cell trajectory layout.

Three append-only migrations add longitudinal reporting, evidence-basis comparison and assessed-task precedence. All three were applied to staging. Hosted rollback SQL verified source publication, actual human review, separate permission, revocation, new baseline/source/trajectory partitions, source readiness, retirement, small cells and sponsor denial. The synthetic fixtures were rolled back. Existing authenticated API boundaries are unchanged; this release's new hosted checks use database role/JWT assertions rather than new password-session fixtures.

## Operational inputs still required

The software reports evidence that actually exists. Production had no human development reviews when this work began, so populated outcomes cannot be claimed from completion or imported questions. Source owners must approve remaining practical achievement criteria; facilitators must review learner-shared work; learners must permit aggregate use. Reliability, construct validity, longitudinal sensitivity and causal programme evaluation remain empirical work requiring actual study data. Missing evidence stays visible rather than becoming fabricated growth.
