# Applied Commerce curriculum architecture

Status: architecture checkpoint  
Branch: `architecture/applied-commerce-concept-atlas-20261007`  
Date: 7 October 2026

## Why this layer exists

BIS already has a strong evidence engine and deliberately cautious reporting. The missing contract was upstream: a report could describe recorded activity, learning checks and behavioural evidence, but it could not legitimately say which authored competency was being developed, what kind of evidence would count toward that competency, or how evidence from several moments should become a progression narrative.

This architecture adds that contract without weakening existing privacy or interpretation boundaries.

The evidence chain is now designed as:

`Applied Commerce source -> BIS concept -> competency -> teaching moment -> evidence event -> progression stage -> learner portfolio -> cohort report -> pathway / programme decision`

A percentage is not the end product. It is one possible piece of evidence inside a larger, traceable claim.

## Source ingestion

The current Applied Commerce learner books for Grades 8–12 are registered in `content/curriculum/applied-commerce/source-register.json`.

`content/curriculum/applied-commerce/lesson-index.json` indexes all 395 lesson positions:

- Grade 8: 80
- revised Grade 9: 75
- Grade 10: 80
- Grade 11: 80
- Grade 12: 80

Where the Grade 9 manuscript explicitly supplies LO, Business Studies and EMS competency codes, those codes remain authored source metadata. They are **not** promoted to a claim of official DBE/CAPS approval or equivalence. The Applied Commerce assessment checkpoint requires curriculum/timetable mapping and moderation before such a claim could be made.

The architecture distinguishes:
1. what the authored book teaches;
2. what BIS derives internally as a competency/evidence contract;
3. any future external framework crosswalk, which must be separately governed and verified.

## Applied Commerce Concept Atlas

`content/curriculum/applied-commerce/concept-atlas.json` maps all 34 BIS Labs to their Applied Commerce ancestry.

Each Lab has a canonical concept statement, BIS competency domains, explicit Grade/Lesson source anchors, BIS source status and reporting intent.

An ancestry link means “this concept is taught or developed here.” It does not mean the learner has demonstrated it.

Career Lab has a separate BIS source outside the three canonical volume files. Failure Lab remains explicitly `PENDING_BIS_SOURCE`; its Applied Commerce ancestry is mapped, but no missing Failure Lab workbook is invented.

## Report classification

The curriculum intelligence layer introduces evidence/report classifications:

- `STARTING_POINT` — baseline, context or prediction that establishes where the learner began;
- `LEARNING` — evidence of understanding inside an authored learning check;
- `GUIDED_APPLICATION` — use of the concept with support or inside an authored task;
- `REAL_WORLD_APPLICATION` — observation/outcome from a defined ordinary-life opportunity;
- `REVIEW_ADAPTATION` — evidence review plus a justified change;
- `TRANSFER` — application in a genuinely new context;
- `LONGITUDINAL_PORTFOLIO` — source-linked synthesis across time without reproducing private raw answers;
- `PROGRAMME_PATTERN` — privacy-safe aggregate pattern for programme teams.

These classifications answer “what kind of evidence is this?” before a report tries to answer “what changed?”

## Competency progression

`lib/curriculum-intelligence.mjs` defines a conservative progression model:

`NOT_EVIDENCED -> INTRODUCED -> EXPLAINED -> APPLIED_WITH_SUPPORT -> DEMONSTRATED_IN_TASK -> TESTED_IN_CONTEXT -> REVIEWED_AND_ADAPTED -> TRANSFERRED -> SUSTAINED`

The stages are evidence states, not identity labels.

Rules:
- attendance, page completion, confidence and self-report do not become competence;
- a learning check can support `EXPLAINED`, not real-world capability;
- an authored assessed task can support `DEMONSTRATED_IN_TASK`;
- qualifying observations/outcomes can support `TESTED_IN_CONTEXT`;
- `REVIEWED_AND_ADAPTED` requires both interpretation and a source-linked revision;
- `TRANSFERRED` requires a concrete new-context application;
- `SUSTAINED` is reserved for qualifying transfer evidence from at least two distinct longitudinal cycles.

Every qualifying event needs source provenance. Missing provenance cannot advance the competency stage.

## What a learner report can become

A mature portfolio/report should not replay questionnaire answers. For each approved competency it can instead report:
- starting point;
- learning/understanding evidence;
- guided or assessed application;
- real-world evidence;
- review and adaptation;
- transfer;
- current evidence stage;
- the next evidence opportunity/pathway;
- a clear boundary on what the evidence still does not establish.

That is progression feedback, not a dashboard score.

At cohort level, the same model can aggregate privacy-safe progression distributions without exposing private learner wording or manufacturing causality.

## Time Lab: first reference implementation

`content/curriculum/time/time-lab-curriculum.json` rebuilds Time as the first module against this architecture.

It uses ten guided 45-minute sessions plus the separate 90-minute Day 3 Lab Phase A and seven-day field experiment.

The progression is intentionally not ten equal chapters:

1. discover the discrepancy between the time story and a real trace;
2. learn observation versus interpretation;
3. build the investigation and enter the Lab;
4. explain what the Lab revealed using attention, friction, time leaks and protection;
5. learn evidence discipline and perform the first review;
6. diagnose barriers and make one justified adjustment;
7. widen into priority, protection and age-appropriate leverage;
8. close the experiment and make a bounded evidence claim;
9. transfer the method and name the meta-time skill;
10. demonstrate, integrate, build the portfolio narrative and identify the next pathway.

The instructional rule is explicit: **discovery precedes formal explanation when the concept is meant to be revealed through investigation.**

The Day 3 45-minute learning bridge is not the Lab. Phase A remains a separate 90-minute facilitated experience.

## Time competencies

The Time blueprint defines eight source-linked competencies:
1. observe actual time and attention allocation;
2. distinguish observation from interpretation;
3. prioritise what matters;
4. form a testable explanation of a time pattern;
5. design a workable time experiment;
6. apply and record the method in real life;
7. review evidence and adapt;
8. transfer the method.

Each day identifies which competencies it develops and the exact evidence event the session is intended to create. This makes the teaching plan, learner evidence, portfolio and eventual sponsor report interoperable.

## Deliberately not changed in this checkpoint

This branch does not:
- publish or activate a new Time runtime;
- alter existing learner evidence;
- migrate production data;
- infer competencies from old completion percentages;
- expose private responses to facilitators or sponsors;
- claim external curriculum certification;
- manufacture the missing Failure Lab source.

The next implementation step after this architecture passes verification is to compile the Time curriculum blueprint into a governed Time learning-module source/version and connect the new competency evidence contracts to the existing portfolio/report aggregation path.
