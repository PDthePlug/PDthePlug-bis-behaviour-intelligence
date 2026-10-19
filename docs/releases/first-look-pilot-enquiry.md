# First Look pilot enquiries and report coverage

## Enquiry behaviour

The First Look footer opens an email to `pdmpofu@gmail.com` with a lens-specific subject and a short editable body. It includes the selected audience, the programme question, the public First Look URL and blank fields for name, organisation, cohort, purpose and timing. It never copies practice inputs, learner records or private reflection. A visible recipient and Gmail compose alternative cover clients that do not handle mailto links correctly. Neither link sends an email.

## What the reports can answer

| Question | Facilitator view | Programme view | Evidence limit |
| --- | --- | --- | --- |
| What people notice | Shared work, reviewed recognition/explanation and permitted learning checks | Eligible aggregated recognition/explanation, structured response patterns | A baseline self-report records what a participant says; it is not independently demonstrated recognition. |
| What people practise | Experiment position, observation coverage, shared tasks and reviewed application | Starts, coverage, reviewed application and repeat evidence where supplied | Starting an experiment or submitting work does not prove capable application. |
| What people test | Shared reviewed tests and evidence-based revisions | Assessed tests/revisions; legacy prediction/observation comparisons where eligible | Universal response counts do not inherit legacy behavioural calculations. |
| What people struggle with | Explicit uncertainty, support requests, missing review/history and next check-in prompts | Aggregate learning-support signals, evidence gaps and permitted question patterns | These are partial signals. Missing work does not explain a difficulty or establish its cause. Private thoughts are not mined. |
| What people ask for help with | Authorised support queue and learning checks, with recorded follow-up | Privacy-safe request counts, learning-check patterns and follow-up when available | Request wording does not become sponsor-visible; absent requests do not mean absent need. |
| What carries into real life | Reviewed application, context, independent days and source-defined follow-up | Eligible assessed application/transfer, change distributions and follow-up | Requires approved practical/transfer tasks, criteria, participant permission and human review. Self-report and lasting change remain distinct. |

Canonical implementation: `app/facilitator-workspace.tsx`, `app/facilitator-learner-development.tsx`, `app/development-intelligence-panel.tsx`, `app/api/facilitator-development/route.ts`, `app/api/development-intelligence/route.ts`, `app/api/staff/route.ts`, `app/programme-outcomes-view.tsx`, `lib/development-intelligence.mjs`, `lib/programme-intelligence.mjs`, and `lib/development-readiness.mjs`.

## Production configuration check — 19 October 2026

A read-only configuration query against BIS Production counted only contracts for which `private.development_contract_is_current(id)` is true. It did not read learner answers or modify data.

| Lab / version | Current contracts | Evidence basis | Highest permitted stage |
| --- | ---: | --- | --- |
| Decision / 4.2.2 | 10 | SELF_REPORT | NOTICE |
| Habit / 4.5.3 | 10 | SELF_REPORT | NOTICE |
| Money / 4.2.1 | 10 | SELF_REPORT | NOTICE |

No current ASSESSED_TASK application, test/revision or transfer contracts were returned. This does not mean there are no experiment logs or operational support records. It means the new development-intelligence pathway cannot currently establish assessed application or transfer from those contracts. The public fictional demonstration is not proof of live cohort attainment.

The full marketing statement therefore remains conditional. Completing it requires source-approved practical/test/transfer contracts for each intended programme version, matching assessment criteria, participant permissions and human reviews, followed by role-specific end-to-end verification. This release does not invent contracts, alter authored learning, expose private reflection or claim that production learner outcomes have been validated.
