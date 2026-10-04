# BIS evidence intelligence audit — 4 October 2026

This is an engineering audit of the prepared synthetic staging demo. It is not evidence of student behaviour change or programme effectiveness. Production was not accessed.

## What the system now does with the collected information

| Input and purpose | Processing | Learner output | Facilitator / sponsor output |
| --- | --- | --- | --- |
| Starting-point responses | Immutable responses link to active evidence records; both `.I0` and `.BASELINE` identify the baseline | Starting-point coverage appears in the portfolio | Governed aggregate baseline themes; no private wording |
| Phase A context, prediction and plan | Current Lab version and active evidence links establish preparation coverage | Summary identifies preparation and the next existing Lab task | Structural support guidance; progress is not treated as readiness or improvement |
| Phase B observation, including no opportunity | Calendar rules remain authoritative; missing alternative outcomes stay missing | Governed measures appear when inputs exist; no opportunity is distinct from failure | Observation coverage and aggregate opportunity counts |
| Deterministic measurement | Formula version and actual source-object links accompany each measure | Linked anchor groups explain provenance; unverified values are withheld from the visible portfolio | Version-scoped aggregates retain small-cell protections and causal restraint |
| Evidence Review and Behaviour Profile | Existing observations, interpretation and transfer remain different evidence classes | Guidance connects the existing review and transfer tasks without asserting lasting change | Structural handoff and aggregate comparison context |
| Companion request | The shared learner projection bounds retrieval; only current answered, actively anchored responses can be quoted | Actual immutable response IDs accompany retrieval; structural guidance adds no new questionnaire | Companion conversations remain private |
| Programme decision | Existing authorised programme decision workflow | No automatic learner classification | Sponsors receive an aggregate interpretation boundary and a next programme action; exported PDF uses the same guidance |

The added guidance is deterministic. It does not infer personality, motivation, clinical status, risk, or programme causality. Guidance is represented separately with `bis-evidence-guidance:1`, `UNCLASSIFIED` and null confidence. Original answers are not rewritten into model classifications.

## Defects corrected

- Real Habit starting-point records used `HAB.I0`, which the portfolio did not recognise.
- Companion retrieval cited semantic field names rather than saved response IDs and could use passed or unanchored text.
- Mixed-key bulk insertion omitted the user's empty evidence-reference list, causing Companion persistence to fail. Both turn types now explicitly carry the reference list and guidance version.
- Learner snapshots and structural staff / aggregate reporting could select unrelated Lab versions. Reports now match the governed cohort version; current learner retrieval matches its selected enrolment.
- Missing alternative outcomes could be counted as unsuccessful attempts; missing predictions could produce misleading prediction accuracy.
- The experiment prediction lacked its own evidence anchor for downstream source verification.
- Portfolio loading or failure could look like an empty evidence record.
- An optional unpublished learning-content lookup produced a browser error before the existing bundled handbook fallback. Optional resolution now returns an explicit unpublished result; required resolution retains its failure status.
- The actual facilitator participant view did not consume the shared support guidance. It now does, and stage/count labels no longer claim experiment or review readiness from progress alone.

## Verification record

- `npm run verify` passed: lint, TypeScript, the acceptance suite, canonical-source audit, optimized build and 42 fixture browser checks at 360px, 430px and 1280px.
- Twenty normally authenticated synthetic learners read their own real application portfolio. All twenty had the expected current-version anchors, bounded guidance and no private response wording in the projection. Repeated reads for the first and last learner restored the same projection.
- Companion evidence retrieval and structural summary each saved a user/assistant pair. A fresh application snapshot restored both replies; citations contained actual response IDs and the guidance version was recorded separately from original responses.
- A normal learner session could not read another learner's response rows.
- The actual facilitator API returned twenty assigned learners, version-scoped structural guidance and no synthetic private evidence wording. The administrator's sponsor API returned a twenty-participant aggregate with zero real-world observations.
- The four aggregate RPCs passed positive access, other-version contamination, small-cell suppression, wrong-role and revoked-role checks. All temporary changes rolled back. An absent staging acknowledgement was separately refused.
- Independent staging integrity reads confirmed 300 current demo responses, 299 active evidence records, one withdrawn record, twenty active cohort members, four new Companion turns and zero temporary other-version enrolments or experiments.

- Four signed-in staging journeys passed: learner authentication and role denial, administrator catalogue access, responsive learner surfaces, and portfolio guidance, re-entry and its existing-Lab handoff.
- The prepared facilitator's actual participant screen passed at 360px, 430px and 1280px, including the selected learner's next useful moves, overflow checks and console/network diagnostics.
- The final programme PDF exported through the normally authenticated sponsor API. All nine pages were visually reviewed; the cover opens correctly, the summary explicitly awaits observation, and private learner wording is absent. The report describes twenty synthetic learners and zero started experiments, without an effectiveness claim.

## Release limits

The prepared demo contains starting-point and early Phase A evidence. It has no completed seven-day real-world observation cycle, post-experiment Evidence Review, completed Behaviour Profile, or demonstrated transfer outcome. The exported report must therefore describe preparation and observation coverage, not improvement.

The active Habit, Decision and Money catalogue entries remain `STATIC`. This audit does not certify governed `DYNAMIC` Universal activation, publication parity, or rollback. Existing Universal fixture tests do not substitute for a live governed version.

The handbook learning-check and question-pattern systems have their own release/governance semantics. Empty signals or candidate registry entries are not treated as passed learning, active interpretation or observed outcomes. Their complete live source-to-publication-to-response lifecycle remains a separate certification item.

School, emerging-adult and workplace outcomes must not be equated solely because they share a Lab code. Before making programme decisions, confirm the governed release, delivery context, observation window and comparable measure definition. No independent human coaching effectiveness or sponsor decision outcome is established by this synthetic test.

## Data and rollback

The migration filename matches the applied staging ledger version `20261004020252`. The append-only migration changes four private aggregate function bodies and introduces a versioned structural staff projection. Public RPC wrappers, role gates and small-cell suppression remain in place. The prior staff projection helper remains available for a deliberate rollback.

The staging SQL regression uses prepared synthetic identities and rolls back its temporary other-version records, small-group membership changes and role revocation. It refuses an absent or mismatched staging project acknowledgement. Do not run it against production.

No public sign-up relaxation, service-role browser access, production reset, demo deletion or production deployment was performed.
