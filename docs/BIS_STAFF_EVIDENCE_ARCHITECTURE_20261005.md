# BIS staff workspace and evidence architecture

Date: 5 October 2026
Implementation branch: `implementation/staff-evidence-architecture`

## Product structure

The staff experience uses one centred workspace menu and role-specific destinations. Each destination supports a single operational purpose.

| Role | Destinations | Operational purpose |
| --- | --- | --- |
| Facilitator | Group, Learners, Support, Review | Run a class, understand individual progress, record support, and assess evidence a learner has explicitly shared |
| Programme outcomes | Overview, Learning, Evidence, Decisions, Reports | Read programme signals without combining learning, evidence, decisions, and reporting into one screen |
| Administrator | Overview, Groups, Access, Assessment, Content Studio | Operate delivery, access, assessment governance, and authored content from a simple workspace |
| Learner | Evidence Portfolio | Revisit original records, revisions, calculations, submissions, and facilitator review history over time |

The Review destination is an assessment queue. Programme readiness and general cohort monitoring remain in Group and Learners so that assessment does not become another general dashboard.

## Evidence system layers

| Layer | Stored record and responsibility |
| --- | --- |
| Response capture | `universal_responses`, workbook responses, revision state, enrolment context, and captured time |
| Evidence mapping | `curriculum_evidence_mappings` assigns a response to a Lab, version, semantic field, outcome, competency, task, evidence class, portfolio purpose, and sensitivity |
| Assessment | `evidence_submissions`, `assessment_rubric_versions`, and append-only `evidence_assessments` preserve exactly what was shared, the rubric version, criterion ratings, rationale, feedback, and revisions |
| Longitudinal portfolio | `evidence_records` preserves original learner evidence; `measurement_history` preserves calculated snapshots with their formula and exact source state |
| Reporting | learner, cohort, and institutional reports aggregate reviewed, current, consented records and apply cohort and rubric-cell disclosure thresholds |

## Authoritative curriculum mapping

Captured questions are registered structurally first. A structural mapping uses `UNCLASSIFIED` until an administrator approves the authored outcome, competency, task, evidence class, portfolio purpose, and sensitivity against the source material. This prevents the system from inventing curriculum meaning.

Volume 3 contains ten authored transfer rubrics. Their exact criterion labels, 1–5 scale, authored `/25` total, source reference, and source SHA-256 are preserved in `lib/authored-assessment-rubrics.json` for:

`SYS`, `LTT`, `ECO`, `CUS`, `INN`, `AST`, `FIN`, `PEF`, `TRS`, and `MTL`.

Rubric versions are immutable after use. They can be enabled only when every referenced semantic field has an approved, active mapping for the same Lab version. Volumes 1 and 2 do not supply equivalent scored transfer rubrics, so the review flow permits evidence-grounded feedback without manufacturing scores.

## Privacy and integrity rules

- A learner owns the original response and evidence record.
- Private `P3` evidence cannot be submitted to a facilitator.
- `P0`–`P2` evidence appears in the facilitator queue only after the learner selects exact evidence records, accepts the sharing statement, and submits them to an active group.
- Revocation, withdrawn consent, ended membership, superseded evidence, or loss of the facilitator assignment removes the submission from the current facilitator workspace.
- Saved assessments are append-only. A correction creates a new assessment that points to the earlier review.
- Criterion scores must use the rubric's authored bounds and include evidence-specific rationale.
- Totals are calculated only when the source rubric explicitly defines a total.
- Reports use one latest assessment per learner and rubric version. Cohort reporting requires at least five learners; a rubric cell requires at least three.
- Reports describe accumulated evidence. They do not claim that the programme caused an observed change.

## Class operations

Facilitators can plan programme days 1–10, record a held session, and append attendance. Attendance can be recorded only for a held session, an active group member, and a group assigned to that facilitator. Corrections append a new attendance record and preserve the prior entry.

## Staging implementation

The following migrations are provided in the repository:

1. `20261005113046_staff_evidence_assessment_engine.sql`
2. `20261005120231_facilitator_class_operations.sql`
3. `20261005120424_evidence_staff_identity_fallback.sql`
4. `20261005121639_evidence_engine_integrity_guards.sql`
5. `20261005122458_longitudinal_measurement_snapshots.sql`

Supabase recorded their staging application as `staff_evidence_assessment_engine`, `evidence_staff_identity_fallback`, `facilitator_class_operations`, `evidence_engine_integrity_guards`, and `longitudinal_measurement_snapshots`.

The existing authenticated response-save functions remain the capture entry points. Workbook saves now create or revise evidence records in the same transaction. Deferred measurement triggers preserve the final calculated value and source state once per transaction, which makes retries idempotent and prevents a partial snapshot.

The staging integrity test uses real staging grants and rolled-back fixtures. It verifies learner ownership, explicit submission, assigned-facilitator access, session and attendance constraints, calculation snapshots, score bounds, retry safety, revocation, and retained review history. No fixture remains after the test.

At implementation time, staging had 325 structural mappings derived from registered questions and captured evidence. It had no active question-registry rows suitable for safely enabling a source rubric automatically. Rubrics therefore remain subject to administrator mapping review and explicit enablement.

## Deployment boundary

The database migrations in this record are applied to BIS Staging. Production has not been changed. The application implementation is committed locally for review and still requires the normal GitHub and deployment workflow before it can serve the new workspaces.
