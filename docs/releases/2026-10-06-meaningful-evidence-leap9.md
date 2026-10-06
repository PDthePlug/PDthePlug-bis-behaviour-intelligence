# Meaningful evidence and Leap9 experience refinement

The learner portfolio previously led with numeric measures and response history. The Leap9 experience repeated its simulation explanation, used numbered feature panels, and asked the sponsor to solve delivery problems. This change leads with practice, interpretation and a next action while keeping measures available through disclosure.

| Requirement | Authority | Implementation | Verification |
| --- | --- | --- | --- |
| One collapsed simulation notice | Product owner, 6 October feedback | ProgrammeExperienceV2 header | Responsive journey test |
| Page as canvas; retain useful cards and warm palette | Product owner; AGENTS.md §5 | Narrative/profile/experiment sections in document flow; learning excerpt, controls and download remain framed | 360px, 430px, 1280px screenshots and overflow checks |
| Explain the meaning of observations and self-report | Existing Habit definitions; product feedback | Shared experience explanation; portfolio guidance for verified legacy Habit measures | Observation, no-opportunity, negative/no shift and provenance tests |
| Competencies come from authored context | Existing evidence-engine metadata | Portfolio uses recorded competency/outcome labels and actual facilitator feedback | Portfolio browser test; no competence scores inferred from counts |
| Sponsor next steps address practical opportunities | Product owner | Shared sponsor findings used by the page and PDF | PDF text and glyph-boundary checks |
| BIS retains delivery responsibility | Product owner | Sponsor findings and PDF explicitly assign programme improvement to BIS | Sponsor fixture/PDF tests |
| Use varied, reproducible example evidence | Product owner | Twenty named fictional records; mixed later responses, limited observations and support requests | Independently checked cohort totals and visitor isolation |
| Preserve learning and measurement semantics | Attached Volume 1 workbook; canonical Habit metrics; AGENTS.md §§4,16 | No authored question, scale, formula or Lab sequence changes | Source audit and existing Lab regression suite |

## Scope and limits

The public `/experience/leap9/v2` demonstration remains a self-contained simulation. Its fixed cohort supplies its own page and illustrative report; visitor edits change Naledi's practice view only. This dataset is not inserted into live accounts or the staging cohort. The existing canonical PR #111 staging demo is not silently completed or replaced. Live reporting privacy thresholds remain unchanged.

Portfolio guidance interprets verified, defined legacy Habit measures only. Universal BEI codes are source-specific and must not inherit Habit meanings. Current Universal portfolios show their authored practice context, stage guidance and real facilitator feedback; reviewed competency assessment requires a separate governed measurement/content milestone. A response is not a competence verdict and perceived control is not a skill gain.

The broader question redesign and longitudinal competency assessment are deferred as requested. Programme design, original learner responses, evidence sharing/revocation and production data remain intact.

## Validation

- 619 acceptance tests; source audit; lint; TypeScript; optimized build.
- Responsive changed journeys: participant → experiment → sharing → facilitator review → evidence → sponsor findings; profile/settings persistence and portfolio disclosure.
- PDF findings match the fictional cohort; Unicode, pagination, privacy and glyph bounds checked.
- The complete `npm run verify` contract passed: 619 acceptance tests and 132 browser tests across all three viewport projects, including existing Lab, Content Studio and staff journeys.
- Local verification uses an explicit non-production backend configuration and the test-only browser harness. Production sign-in/database UAT is outside this pass.
