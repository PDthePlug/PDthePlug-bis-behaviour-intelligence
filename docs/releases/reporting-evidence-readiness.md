# Explain the actual reporting blockers

The production screenshots showed a real gap between the available reporting UI and the data needed to support it. Populated browser fixtures established chart behaviour, not readiness of the actual Leap9 programme.

## Verified production state, 14 October 2026

Read-only checks found 21 active Leap9 memberships, but only one learner with current product consent and an authentication identity. The other 20 memberships had neither. No consent or membership was changed.

There were no learner evidence submissions and no development reviews. The 30 approved task contracts covered self-reported starting points only: Habit 4.5.3, Decision 4.2.2 and Money 4.2.1. No practical-use or transfer assessment criteria were approved. Leap9 uses Habit 4.5.2; criteria from 4.5.3 cannot silently be applied to that edition.

Consequently, the live records cannot support the desired capability-growth, consistency, transfer or alignment conclusions. The Development Intelligence goal is not yet achieved for this programme. Demonstration data must remain explicitly fictional and separate.

## Changes

- Facilitator group reporting distinguishes the group list from the consent-eligible reporting population.
- Restricted reports explain the consent population visibly, including on Learning and Evidence, rather than hiding the explanation in a collapsed disclosure.
- Facilitator group and learner views explain the next steps: edition-appropriate criteria, learner-selected work, human assessment, optional reporting permission and privacy thresholds.
- The individual view preserves the existing consent-required response and does not fetch developmental outcomes as a fallback.
- Existing authorised contract lookups provide only three readiness flags. Wrong-edition or wrong-Lab criteria are excluded; a failed lookup stays unknown. No new database permissions, writes or schema changes are introduced.
- Direct links open the existing review workflow and an explicitly fictional completed report.

## Still required before real outcomes can be reported

1. The source owner must approve the practical tasks, evidence anchors and assessment criteria for the curriculum edition the programme will actually use. Preserve existing enrolments and original evidence; changing an edition needs a deliberate migration decision.
2. Actual learners choose their consent and selected work; facilitators assess what that work demonstrates using the approved criteria. Staff must not grant consent or manufacture assessments on their behalf.
3. Learners choose whether derived outcomes contribute to group reporting. Collect comparable follow-up and distinct-context evidence before claiming growth, sustained use or transfer.
4. Verify actual permitted data across the learner portfolio, facilitator review, cohort report and exported PDF. Privacy thresholds and scientific validation remain separate requirements.

## Verification

Regression coverage models the observed 21-on-list / 1-eligible case without using real learner answers. It checks the visible explanation on each report tab, review and fictional-example destinations, missing-criteria guidance, and consent-blocked learner behaviour. Existing populated report tests continue to verify the chart and heatmap presentation. These fixtures are not evidence of real learner development.
