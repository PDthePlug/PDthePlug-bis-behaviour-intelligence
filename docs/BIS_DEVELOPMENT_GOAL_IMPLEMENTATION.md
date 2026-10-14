# BIS Development Intelligence System — PR #162

## Product workflow

The reporting engine now follows evidence → reviewed capability → comparable change → independent application → contextual transfer. Completion remains programme implementation context. The Applied Commerce authored competency framework defines the domains and progression stages; no arbitrary psychological dimensions or global learner score were introduced.

| Audience | Product and purpose | Delivered evidence |
|---|---|---|
| Learner | My Development Portfolio: how my evidence is changing | First comparable/current stage bars, longitudinal task/context history, coverage strength, independent application, transfer, source-defined follow-up, optional compatible self-perception comparison and next practice |
| Facilitator | Learner Development Intelligence: how to support this learner | Authorised cohort-scoped reviewed profile, contextual priorities, insight/application gap, task review and structural evidence; no private reflection wording |
| School / programme | Cohort Development Report: where to focus support | Capability heatmap across authorised groups, current stage and change distributions, missing comparable history and intervention priorities |
| Partner / funder | Programme Outcomes & Impact Report: what development is evidenced | Cohort exposure, comparable stage change, application/transfer/follow-up, next intervention, evidence limits and the shared dashboard/PDF report model |

The school and partner views have distinct purposes within the authorised results workspace. They do not add overlapping cohort counts into an invented institution-wide unique population.

## Governing assessment meaning

Administrators approve current source mappings first, then immutable development assessment contracts for one exact Lab/version and competency. Contracts bind selected fields, source reference/fingerprint, comparison family, evidence basis, supported stage ceiling, optional authored follow-up window and optional compatible 0–5 perception field. The existing authored rubric workflow remains authoritative for scored task evidence.

A facilitator first records a current human REVIEWED assessment of explicitly learner-shared work, then verifies the supported development stage against its source criteria. REVIEWED disposition, a rubric link, an AI proposal, field completion and the potential ceiling alone never establish attainment.

Existing source-approved baseline meanings supply recognition criteria only. This import creates no learner review, achieved stage or reporting permission. Other tasks can be configured through source mapping, authored rubric and development contract governance; unknown or ambiguous meanings remain non-reportable until approved.

## Longitudinal rules

- Original evidence timestamps govern chronology; regrading the same evidence set replaces its current interpretation and cannot generate another developmental touchpoint.
- First/current change compares only the same approved comparison family. Different criteria remain in the history with an explicit non-comparable label.
- A lower current reviewed stage calls for reviewing conditions and evidence; it is not automatically labelled lost capability.
- Repeated independent application means reviewed application on at least three distinct original evidence days. This is a transparent coverage convention, not a validated persistence threshold.
- Transfer requires independent use, separate earlier application evidence in a different recorded context, earlier original evidence time and the same comparison family.
- Follow-up is measured from the first reviewed independent application, not the first recognition or explanation. The interval must be defined in the authored contract.
- Coverage strength is limited for one comparable review, moderate for repeated comparable reviews, and strong only for assessed tasks with at least three reviews and three independent application days. Mixed/self-report evidence cannot become strong task evidence. Strength is not a psychometric validity or reliability score.
- Perception comparison is optional, source-defined and restricted to the identical 0–5 stage scale. Existing 1–10 self-ratings are never silently transformed into reviewed behaviour scores.

## Privacy and source validity

Learners separately permit or revoke aggregate use of derived development outcomes. Permission does not expose their words to schools/funders and does not override the existing raw-response aggregation exclusion. Original reflections and P3 evidence remain private.

Only current consent, active membership, eligible exact-version enrolment, a current share, the latest human assessment and current source/mapping authority contribute. Source retirement, supersession, withdrawal and share revocation invalidate reports immediately. Staff without learner profiles use their authenticated actor ID; a null learner identity never grants individual access.

Direct table access and anonymous RPC execution are denied. Individual facilitator reports require the assigned cohort. Funders cannot access individual profiles. Aggregate partitions include learners without reviewed evidence, with minimum cohort five and cell/complement three. Suppression occurs before serialization. Historical rows remain auditable rather than being rewritten.

## Source coverage and limits

The supplied newer manuscript provides 1,975 approved-meaning families across ten Lab titles and 29 editions. Seventy current runtime questions match those approved baseline families. The 34-title catalogue and governance workflow are supported, but all 34 titles do not yet have approved achievement criteria. The 2,140 previously ambiguous task families remain subject to authored source review.

The software can now collect and report legitimate development assessments; release cannot create historical growth or transfer where no reviewed evidence exists. Measurement validation, scientific attribution of BIS impact, calibrated AI interpretation and source equivalence across editions remain separate evidence programmes. AI stays disabled.

## Verification and release

Release checks are recorded in `BIS_REVIEWED_STAGING_RESULTS.json`. The new SQL suite executes source approval, human stage assessment, owner permission, programme distribution, revocation, source retirement and sponsor denial against real staging triggers inside a rollback transaction. Additional regressions cover null staff identity, current criteria, evidence reuse and independent second-context transfer.

The browser workflow tests assessment criteria, supported stages, save/re-entry, optional reporting permission, permission revocation and the learner profile at 360, 430 and 1280 pixels. Real Auth/API checks cover learner/facilitator/funder boundaries, source workspace, programme snapshot, institutional PDF and the real results page at all three widths.

The authoritative release gate is `npm run verify`. The exact merged commit, production migration results and deployment are tracked in [PR #162](https://github.com/PDthePlug/PDthePlug-bis-behaviour-intelligence/pull/162). Production is never used for QA fixtures.

Existing Security Advisor warnings remain unchanged: four legacy exposed definer functions ([remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)) and leaked-password protection ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). New public development RPCs use invoker wrappers; internal current-fact helpers deny direct execution.
