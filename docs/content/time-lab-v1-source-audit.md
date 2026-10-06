# Time Lab v1.0 — source ingestion audit and resolutions

Branch: `feature/time-lab-v1`  
Base: `472d8c13822be7377548d33bcd29b570640dde7d`  
Module: `TIM`  
Learning version: `1.0`

## Source set

The supplied Time Lab source contains all three delivery editions:

- `TIM-LM-1.0-S` — School Edition
- `TIM-LM-1.0-EA` — Emerging Adult Edition
- `TIM-LM-1.0-W` — Workplace Edition

Canonical Programme Player sequence:

`Welcome → Day 1 → Day 2 → Day 3 → Day 4 → Day 5 → Weekend → Day 6 → Day 7 → Day 8 → Day 9 → Day 10 → Certificate`

Day 3 Part A and Part B are one programme position. The seven-day field experiment begins after Day 3 and closes before Day 8 review.

## Architecture

Time uses the existing generic `MARKDOWN` adapter in `lib/content-source-adapters.ts` and the governed learning compiler in `lib/content-compiler.ts`.

No Time-specific importer is permitted. Authored teaching content remains authoritative. Compilation may manufacture stable learner controls from authored blanks, choice matrices, tables, dates and ratings, but must not summarise or compress the teaching.

## Resolved source findings

### Day 6 example

Canonical interpretation of the seven entries:

- 3 Full Time Pauses
- 1 Partial
- 1 No Pause
- 1 No opportunity
- 1 Missing / Not Recorded

`No opportunity`, `Partial`, `No Pause` and `Missing` remain distinct evidence states.

### Day 7 example

The listed seven-day example contains:

- 4 Full Time Pauses
- 1 No Pause
- 1 No opportunity
- 1 Missing / Not Recorded

Any summary copy stating three clean pauses is corrected to four.

### Day 8 denominator

Adherence is opportunity-based, never calendar-day-based:

`Time Adherence Rate = Full Time Pauses completed ÷ Eligible opportunities observed × 100`

For the canonical Day 7 example, adherence is `4 ÷ 5 = 80%`. Missing and no-opportunity days are not placed in the denominator.

If there are zero eligible opportunities, the result is `N/A`, not `0%`.

### Canonical Time BEI registry

| Code | Canonical measure |
|---|---|
| BEI-01 | Time Awareness Index (Pre) |
| BEI-02 | Time Baseline Profile |
| BEI-03 | Predicted Time Pause Adherence |
| BEI-04 | Time Confidence Index (Pre) |
| BEI-05 | Time Risk Index |
| BEI-06 | Time Adherence Rate |
| BEI-07 | Time Awareness Index (Post) |
| BEI-08 | Time Confidence Index (Post) |
| BEI-09 | Identity Shift Indicator |
| BEI-10 | Time Investigation Profile |

`Prediction Accuracy`, `Reclaim Rate`, `Awareness Shift` and `Confidence Shift` are derived measures rather than additional BEI numbers.

BEI-03 is the learner's pre-experiment prediction. Prediction accuracy is only computed once BEI-06 exists.

### Time Risk Index

BEI-05 is derived from the ten BEI-02 frequency items. Protective statements are reverse-scored; risk statements are scored directly. Each item is mapped from Never–Always to 1–5, averaged, and normalized to 0–100.

Higher values mean greater exposure to unnoticed or poorly protected time. Incomplete baseline profiles produce `N/A` rather than a guessed score.

The executable definition lives in `lib/time-lab-measures.mjs`.

## Compiler findings resolved during ingestion

### Multipart Day 3

The Markdown adapter previously retained the last duplicate canonical page boundary. A source containing `DAY 3 — PART A` and `DAY 3 — PART B` could therefore drop Part A.

The adapter now retains the first canonical boundary and keeps both authored parts inside the one Day 3 Programme Player position.

### BEI-02 response matrix

The five-point baseline table is an authored single-choice matrix, not decorative content.

The Markdown adapter now detects checkbox choice matrices and converts each behaviour row into one governed radio group while preserving the table layout. The compiler permits repeated field IDs only for a valid radio group with:

- one shared source key;
- unique option values;
- radio controls only.

All other duplicate workbook field IDs remain invalid.

### Compiler artifact version

The content compiler is now `bis-content-compiler-9` so artifacts produced after the workbook-control change are distinguishable from older compiled output.

## Workplace privacy contract

The Workplace source promise remains a runtime acceptance requirement:

- individual workbook responses are learner-private;
- facilitator/operator views do not expose private response bodies;
- sponsor/employer reporting uses cohort-level derived measures only;
- no individual Time evidence is used for performance, promotion or discipline;
- small-cohort reporting must not undermine anonymity.

Time must not be published for Workplace until those runtime checks pass.

## UAT gates

Time is publishable only when:

1. all three editions compile through the generic Markdown adapter;
2. each edition resolves to exactly 13 canonical positions;
3. subtitle resolves to `The Time Investigation Handbook`;
4. Day 3 contains both Part A and Part B;
5. Day 3 receives the governed Lab handoff boundary;
6. BEI-02 rows persist as one choice per behaviour;
7. authored tables remain semantic tables;
8. authored Quick Check answers remain teaching content, not learner fields;
9. all response IDs stay inside `TIM.WB.<EDITION>.*`;
10. ratings, dates and percentages receive bounded controls where explicit;
11. tracker states preserve Full / Partial / No Pause / No opportunity / Missing;
12. opportunity-based metric math passes;
13. continuous workbook-canvas rendering passes desktop and mobile QA;
14. Workplace privacy promises pass role-based runtime QA;
15. the learner catalogue remains closed until an active governed publication exists.

## Current checkpoint

Implemented on the clean branch:

- generic multipart-page correction;
- generic authored choice-matrix controls;
- governed radio-group compiler validation;
- complete Time BEI contract;
- Time adherence, prediction accuracy, reclaim and risk calculations;
- Time-specific source/compiler regression tests.

Next: ingest the complete three canonical manuscripts, run the real-source compile/UAT pass, then prepare publication artifacts without activating them.
