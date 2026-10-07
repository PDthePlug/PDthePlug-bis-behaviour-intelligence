# BIS curriculum architecture

This directory is the bridge between **Applied Commerce® source material**, the **34 BIS Labs**, the **ten-touchpoint learning programme**, evidence capture and reporting.

It exists to prevent a reporting system from becoming a dashboard of disconnected percentages.

## Evidence chain

```
Applied Commerce source
  -> concept
  -> competency
  -> BIS Lab ancestry
  -> touchpoint learning objective
  -> authored learner task/question
  -> evidence class + anchor
  -> governed assessment / deterministic measure
  -> learner progression narrative
  -> privacy-safe cohort pattern
  -> programme decision
```

The chain does **not** permit the reverse shortcut “response -> personality/competency label”.

## Source status

The structural index covers all five current learner books: Grade 8 (80 lessons), revised Grade 9 (75), Grade 10 (80), Grade 11 (80) and Grade 12 (80): **395 lessons** in total.

The source books remain the canonical authored record. This repository stores curriculum locators, derived concepts and governed mappings rather than retyping the books and risking silent source drift.

The Applied Commerce Assessment Checkpoint Guide is a working local assessment companion. It explicitly does not certify CAPS alignment, official DBE approval, annual teaching-plan completion, or current financial/legal accuracy. The curriculum architecture preserves that boundary.

## Reporting principle

BIS must first know **what kind of report it is producing**. A learner progress report, competency evidence report, learner portfolio, facilitator support report and sponsor outcome report have different audiences, evidence permissions and claim boundaries.

Competency progression is tracked **per competency**, not as a single maturity score:

1. Not yet evidenced
2. Notices
3. Explains
4. Applies
5. Tests and revises
6. Transfers

The highest state is constrained by evidence type and provenance. A simulation may support application in a stated scenario; it does not prove the real-world action occurred. A reflection is not an observation. Attendance is not competency.

## Time reference implementation

`time/time-instructional-blueprint-v2.json` is the first end-to-end reference. It keeps Day 3 as a 45-minute learning-to-Lab bridge and preserves the separate facilitated Lab Phase A experience. Formal explanation follows discovery; the seven-day investigation supplies evidence that later teaching reviews and deepens.

PR137 established and merged the immutable TIM-LM-1.0 authored Time baseline. TIM-LM-2.0 is a separate verified instructional rebuild that preserves v1 and remains governed/source-ready rather than learner-live.
