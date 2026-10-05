# BIS Programme Intelligence and Reporting — architecture and gap analysis

Date: 5 October 2026
Baseline: PDthePlug/PDthePlug-bis-behaviour-intelligence, main commit 1b6796d7b6f14a96e84ff98b98be4e23036b9eee (PR #118).

## Status and scope

This is the first requested checkpoint: an implementation-grounded architecture, evidence inventory, gap analysis and proposed reporting contract. It is not a completed dashboard or PDF release. Inspection used exact-revision repository files through GitHub; a full local clone was unavailable. No production learner records were read or modified. No database, live UI, build or browser verification was performed. Migration definitions describe code-present capabilities, not independently verified deployed behaviour. Before implementation, resolve the complete current migration chain and obtain an executable checkout.

Preserve the existing Next.js application, Supabase role/privacy boundaries, ten facilitated touchpoints, nine-stage Universal Lab runtime and immutable evidence/assessment history. Implement on a dedicated branch.

## What the current system actually does

| Layer | Current implementation | Reporting consequence |
| --- | --- | --- |
| Collection | Original responses and portfolio evidence; governed question registry; measurement source links; explicit learner-shared submissions | Original wording, a derived calculation and a facilitator assessment remain distinct evidence classes |
| Aggregate reporting | app/api/staff/route.ts combines seven sponsor RPCs and the programme decision register | There is already an aggregate data assembly point; extend it rather than create a parallel reporting backend |
| Universal Labs | sponsor_cohort_evidence_flow supplies version-scoped stage counts, enrolment/start/completion totals and anchored-measure counts | Counts establish participation/evidence coverage, not understanding, capability or behaviour change |
| Interpretation | lib/evidence-reporting.mjs plus separate functions in programme-outcomes-view.tsx and programme-report-pdf.ts | Narrative rules, thresholds and wording are duplicated |
| Facilitator | facilitator-workspace.tsx derives position, attention, strengths and support focus; shared-evidence assessment is separate | Structural progress is useful but cannot alone justify competence or personal development judgments |
| Assessment | bis_assessment_report returns current shared-evidence review coverage and per-rubric averages, separated by rubric version | Useful assessed evidence exists but is outside the PDF report assembly |
| Document | lib/programme-report-pdf.ts manually draws pages and PDF commands | Layout and narratives need separate maintenance from the dashboard |

Files inspected also include the original sponsor outcome, deeper-analysis and learning-summary migrations; organisational-learning, learning-check, typed-question, staff-assessment, integrity-guard and longitudinal-snapshot migrations; authored-assessment-rubrics.json; and reporting test files. Existing release notes were read as context, not treated as fresh verification.

## Evidence available, and what it permits

| Domain | Available evidence | Responsible statement | Additional work |
| --- | --- | --- | --- |
| Participation | Active consented membership, learning activity, Lab enrolment/stage/start/completion | How many eligible participants have recorded each activity | Align distinct-person denominators, date windows and content versions |
| Engagement | Ten-touchpoint reached/completed counts; class operations exist in the release | Where recorded participation changes across touchpoints | Audit attendance RPC and join attendance separately from page activity |
| Understanding | Learner-reported formative checks; approved structured answers; explicitly shared rubric-reviewed work | Participants reported understanding / a facilitator assessed a specific task | Keep self-report separate from demonstrated understanding |
| Starting point and later position | Paired perceived-control and pattern-understanding confidence responses in the existing HAB summary | Mean self-reported shift among participants with comparable pairs | Validate current version scoping, scales and repeat-measure selection before reuse |
| Application | Recorded experiment starts; legacy observation/opportunity metrics; Universal stage evidence | A test began / real-world observations exist where the Lab contract supports them | Build approved Universal measure adapters; a start timestamp is not proof of an actual attempt |
| Behaviour | Legacy repeat-opportunity comparison and observation metrics | Recorded responses differed between comparable situations | Do not generalise legacy HAB/DEC/MON calculations to every Lab |
| Capability | Authored rubric templates and saved reviews of current learner-shared evidence | Evidence demonstrated a named authored criterion in a specific task | Add criterion-level aggregates; current report mainly exposes rubric totals |
| Support | Requests, acknowledgements, resolutions and formative support signals | Help was requested / follow-up was recorded | Keep requests, unique participants and learning-check signals separate |
| Context | Structured experiment categories and approved numeric/categorical question patterns | Participants selected a particular application context | Preserve cell suppression, multi-select overlap and unknown context |
| Programme learning | Transition counts, adaptation checkpoints and recorded decisions | Delivery team can investigate a transition or review a recorded change | Track recommendation ownership and next-cycle review; do not infer causal effectiveness |

A confidence response is not a skill gained. A completed activity is not mastery. A reviewed task can demonstrate an authored criterion without proving durable capability in every setting. A support request is not a failure label.

## Concrete gaps and defects to address

1. **Universal reporting is materially thinner.** The dashboard sets legacy metrics to null for DYNAMIC reporting. The PDF DYNAMIC branch renders coverage, learning journey/checks, question patterns and decisions, then returns before the executive summary, behaviour/context sections, organisational learning and action plan. Preserve its refusal to fabricate legacy results, but provide a meaningful executive picture and next actions from the evidence that is available.
2. **Separate narrative engines can disagree.** Dashboard outcomeInsights/systemOpportunities/learningNarratives/programmeDesignInsights and PDF executiveFindings/recommendationItems/retentionSummary each interpret data. Only the small evidence-guidance function is shared.
3. **The visual starting point is not zero.** ProgrammeOutcomesView already has touchpoint and understanding bars; PDF has horizontal/stacked bars and a journey graphic. The gap is a coherent, accessible set of question-led graphics, comparable scales and plain explanations.
4. **Thresholds are embedded without a visible rule policy.** Examples include activation gap >=25%, limited evidence >=40%, prediction gap >=20 points, repeat coverage <50%, support demand >=20%, and a 60% repeated-evidence test. These are review heuristics, not established measurement facts. Audit their origins and document or replace them with exact descriptive counts. Do not ship a new arbitrary cutoff.
5. **Zero evidence can produce an optimistic statement.** programmeDesignInsights compares repeat and sufficient counts with ceil(started * 0.6). With zero starters, all three counts can be zero and the condition passes. Zero starters must yield “No real-world testing is recorded yet,” never a claim of a useful repeated-observation base.
6. **Technical language survives in primary surfaces.** Replace “structural projection,” “governed evidence handoff,” “anchored measures,” and “published Lab measure definitions” with audience-specific explanations. Keep provenance in optional methodology detail.
7. **Progress labels overstate what counts prove.** “Learning momentum” is inferred from a stage number and “Consistent observation” from three records. Use “Reached the mapping activity” and “Recorded observations on three days” unless dates and cadence support a consistency statement.
8. **PDF typography can discard meaning.** ascii() replaces branding symbols and drops non-ASCII characters; wrap() approximates width using character count. Long names, local-language text, long tokens and variable-width fonts need measured layout and embedded Unicode fonts.
9. **Assessment reporting is disconnected.** AssessmentReports uses a separate evidence-engine endpoint and CSV export; staff programme PDF assembly does not fetch those aggregates.
10. **Reviewed tests do not establish visual correctness.** Reporting tests inspected mainly assert source strings and contracts. Add executed narrative fixtures and rendered-document checks rather than assuming those assertions prove pagination or customer-facing quality.

## Proposed canonical reporting contract

Build one server-side, audience-scoped ReportModel from already-authorised aggregates. The dashboard and PDF consume the same model and chart data. Facilitator models remain cohort-scoped and may identify participants only within the authorised operational workflow; sponsor models contain no individual identities or private wording.

Each insight must contain:
- stable rule ID and rule version;
- observation with numerator, denominator, units, date range and eligible population;
- comparison context, or an explicit “No comparable measurement available” state;
- bounded interpretation;
- evidence basis (self-report, structural activity, observation or facilitator assessment), sample and coverage;
- suggested action phrased as an investigation where the reason remains unknown;
- interpretation boundary;
- internal source references and source/version identity.

Use availability states AVAILABLE, NOT_COLLECTED, NOT_YET_RECORDED, NOT_COMPARABLE and SUPPRESSED. Never turn null into zero or reconstruct hidden values by subtracting from a total. Evidence strength should initially describe basis and coverage, not invent a numerical confidence score.

Recommendations carry a responsible role, linked evidence and an optional review date. Human teams save decisions; an automated suggestion must never masquerade as an agreed programme decision.

## Deterministic interpretation of written responses

Do not introduce an unrestricted sentence-understanding engine. The current question registry excludes TEXT, DATE and high-sensitivity responses from automatic aggregate patterns. Retain that default.

Where source material explicitly permits interpretation, define a versioned rule for the exact question family, answer intent and supported category. Separate proposed classification from original evidence; retain the evidence anchor, rule version, matching basis and review status. Handle negation, hypothetical wording, quoted examples, multiple meanings and unsupported language by leaving the response unclassified or asking an authorised human reviewer to decide. Keyword occurrence alone must not establish comprehension, capability, motive or behaviour.

Start the first release with existing structured answers and authored human assessments. Any future aggregate text themes require a separate privacy/consent review and approved classification contract. Existing permission to share evidence for facilitator review is not blanket permission to mine private answers for sponsor reports.

## Audience-specific experience

Facilitator: “Who needs attention?”, exact observed reason, next useful check-in, current touchpoint, support queue, and evidence the participant has explicitly shared. Use neutral descriptions; no participant ranking.

Programme owner: eligible participation, ten-touchpoint progression, self-reported understanding, movement into practice, paired comparisons where valid, assessed criteria, support follow-up, context coverage and delivery recommendations.

Every chart includes a short answer to the programme question, accessible tabular values, denominator and evidence limitation. Use stage bars rather than a funnel unless populations form a verified nested journey. Use paired pre/post charts only for genuinely paired data. Keep self-report and assessment visually distinct. Suppression applies equally to charts, narrative, tables and export.

## Institutional report structure

1. Cover: approved programme identity, organisation/cohort, period, report date, audience, report version; prominently label illustrative reports.
2. Executive picture: participation, strongest supported finding, main delivery question, recommended next action and key evidence limit.
3. Programme profile: ten-touchpoint plan, Labs/versions, intended authored outcomes, eligible population and delivery context.
4. Participation and engagement: attendance separately from learning activity, progression and missing records.
5. Understanding: self-report and task-assessed understanding presented separately.
6. Practice and behaviour: starts, observations, comparable opportunities, repeat coverage and prediction comparison where supported.
7. Capability evidence: exact assessed criteria, rubric version, sample and scope of demonstration.
8. Support and delivery learning: requests/follow-up, contextual patterns and facilitator observations clearly attributed as human observations.
9. Recommendations and decision review: action, owner, rationale, review date, and next measurement.
10. Methodology: measures/scales, pair selection, exclusions, privacy, missingness, provenance and non-causal boundaries.

Include unavailable sections briefly with a clear reason rather than fabricated outcomes. Personal learner accounts or identifiable quotes do not belong in aggregate reports without a separate authorised purpose.

## PDF architecture and acceptance

First extract the shared report model. Evaluate a Unicode-capable document layout renderer in the actual Vercel runtime using representative long reports, font embedding, charts, tables, pagination, cold-start and bundle constraints. Do not select a replacement dependency from assumption alone. Retain the current renderer until the replacement passes equivalent security and export access checks.

Required document behaviour: repeating table headers, controlled section/page breaks, non-orphaned headings, readable chart labels, page numbers, organisation/cohort headers, branding and local-language text preserved, and no clipping or accidental blank pages. Export from one authorised data snapshot so values and explanations describe the same evidence.

## Delivery checkpoints

| Checkpoint | Deliverable | Acceptance evidence |
| --- | --- | --- |
| 1 — this document | Architecture, gaps, taxonomy and reporting contract | Exact-revision source trace; verification limits stated |
| 2 | Shared ReportModel and documented descriptive rules; zero-starter fix; no UI threshold invention | Executed fixtures for zero/partial/mixed/completed/suppressed evidence; denominators and boundary assertions |
| 3 | Facilitator and programme-owner views with shared graphics and plain language | 360px, 430px and 1280px journeys; keyboard/table access; role separation; no private response exposure |
| 4 | Shared-model institutional PDF | Extracted text/numerical parity, Unicode fixtures, long/empty/suppressed reports, rendered page inspection |
| 5 | Controlled release | Full npm run verify, staging role/RLS/privacy checks where changes touch data, reviewable PR and deployment revision |

Before checkpoint 2, inspect the remaining current RPC definitions, authored measure sources and actual authorised staging payloads. Before release, test consent withdrawal, sharing revocation, wrong cohort/role, repeated submissions, version changes and small-cell/complementary disclosure. No production QA mutations are authorised by this audit.

The outcome is a programme reporting layer that tells each audience what is recorded, what it reasonably means, where uncertainty remains and what action the evidence supports.
