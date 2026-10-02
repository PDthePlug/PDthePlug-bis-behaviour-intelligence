# Risk Lab — Content Factory Proof

## Purpose

Risk Lab is the blocking acceptance specimen for BIS content manufacturing.

The goal is not to make one more bespoke Lab. The goal is to prove that an authored BIS Lab can move through:

`source → Content Studio → adapter → compiler → real learner preview → approval → runtime → evidence → experiment → derived measures → profile → completion`

without adding a route, page, API or calculation that exists only for Risk Lab.

## Why Risk Lab

Risk Lab exercises the parts of BIS that a generic questionnaire renderer can hide:

- pre-investigation baseline;
- ten Behaviour Evidence Indicators;
- mixed text, boolean, categorical and numeric responses;
- a probability × magnitude calculation;
- repeated risk-scoring rows;
- a falsifiable working equation;
- a seven-day real-world experiment;
- repeated daily evidence rows;
- experiment adherence;
- pre/post shifts;
- a Behaviour Profile summary;
- certificate evidence.

If the factory can preserve this Lab, simpler Labs should not require bespoke engineering merely to survive import.

## Gate 1 — Fail closed instead of flattening

Content Studio now performs a structural capability preflight during document adaptation.

The preflight records whether the source contains:

- a baseline;
- BEI codes;
- derived calculations;
- a timed experiment;
- repeatable evidence tables;
- a Behaviour Profile;
- a certificate;
- a facilitator guide.

Universal Lab V1 supports authored content and typed prompts, but it does not yet execute the complete behaviour-runtime contract above.

Therefore an advanced Lab is blocked at compilation rather than being published as a visually plausible but behaviourally incomplete questionnaire.

This is intentional. A failed preparation with a precise explanation is safer than silent loss of BIS meaning.

## Gate 2 — Universal Lab V2

**Implementation status:** runtime contract implemented on the Risk proof branch; final CI, Content Studio preview and authenticated persistence acceptance remain required.

Risk Lab may pass only when the shared runtime can represent and execute, declaratively:

1. stable semantic evidence fields;
2. baseline collections;
3. repeatable structured rows;
4. deterministic calculations without arbitrary code execution;
5. a real calendar-bound experiment protocol;
6. daily evidence capture;
7. checkpoint rules when authored;
8. derived BEIs with provenance;
9. pre/post shifts;
10. profile projections from prior evidence;
11. certificate predicates;
12. privacy classes and response-pass behaviour.

The V2 package is data. The renderer and evidence engine remain shared.

The current V2 engine adds a deliberately small calculation vocabulary (product, difference, counts, maximum, copy and paired pre/post projection), server-owned calendar gating for scheduled experiment fields, and profile projection from prior evidence. Imported advanced Labs are upgraded through the same compiler path; no Lab-code switch is used.

## Gate 3 — Content Studio proof

Risk Lab must then be prepared from its authored source in Content Studio and previewed in the real learner renderer.

Acceptance requires:

- all nine investigations in authored order;
- all ten BEIs accounted for;
- Risk Mapping remains structurally understandable on phone and desktop;
- probability and magnitude inputs cannot be confused with the derived risk score;
- the seven-day experiment cannot be completed on day one;
- daily evidence survives reload and device/session change;
- post measures cannot appear before the experiment is eligible for review;
- the Behaviour Profile pulls from canonical evidence rather than copied display text;
- learner answers remain private from facilitator view;
- no Risk-only application code is introduced.

## Gate 4 — Reuse proof

**Code-level status:** the second reuse specimen is Identity Lab. Its source characteristics are exercised against the same capability detector, Habit Lab editorial standard and Universal V2 experiment compiler without an Identity-specific runtime branch. The proof also covers two source-quality defects that matter for bulk migration: a repeated learner question between the Hook and legacy Prediction stage, and broad repeated reflection prompts that do not add decision-useful evidence.

**Still required before bulk publication:** prepare the real Identity source through Content Studio, inspect the learner preview, activate the compiled runtime artifact, and verify authenticated persistence end to end. That production acceptance is deliberately separate from the code-level reuse proof.

Only after the live second proof passes should BIS treat the factory as frozen enough for bulk activation of the remaining Volumes 1–3 content.

## Non-negotiable rule

When a legitimate authored structure cannot be represented, improve the shared schema/runtime. Do not patch the individual Lab.
