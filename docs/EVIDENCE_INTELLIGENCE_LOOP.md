# BIS Evidence & Intelligence Loop

## Purpose

BIS should turn learning and Lab activity into a traceable evidence chain that is useful to the learner, facilitator and programme team without exposing private learner wording.

The product loop is:

```text
Learning
  -> Day 3 Lab handoff
  -> Phase A
  -> Phase B real-world experiment
  -> Evidence Review
  -> Behaviour Profile
  -> Return to learning
  -> Evidence Portfolio
  -> Cohort intelligence
  -> Programme decision
  -> Next-cohort comparison
```

## Phase B is part of the programme

Phase B is not a separate application. After the Day 3 facilitated handoff, the real-world experiment runs alongside the remaining programme days.

The learning surface should tell the learner which action is due:
- continue learning;
- record today's evidence;
- review Phase B;
- complete the Lab;
- view the resulting evidence portfolio.

The Lab remains the authority for evidence. The learning programme consumes the Lab handoff state and returns the learner to the correct programme position.

## Evidence anchors

A learner portfolio uses stable evidence anchors rather than reproducing every private response:

1. Starting point
2. Phase A
3. Real-world test
4. Evidence review
5. Behaviour Profile

Each anchor answers: **what evidence allows BIS to say this?**

Derived measures retain their source links through `measurement_sources`.

## Minimum Question, Maximum Evidence

Every question must earn its place.

Ask once when possible. Reuse the answer. Derive what can safely be derived. Revisit only when change over time is itself the evidence.

Keep evidence classes distinct:
- baseline;
- context;
- prediction;
- plan;
- observation;
- outcome;
- interpretation;
- transfer;
- learning check;
- support signal.

A prediction is not an observation. A reflection is not an observed outcome. A learning check is not behavioural evidence. A model classification is not the learner's original evidence.

## Deterministic measures before model interpretation

Counts, rates, shifts and other deterministic measures must be calculated in code from governed evidence.

Machine-assisted interpretation may later classify open responses into controlled programme dimensions, but it must:
- preserve the original evidence;
- store or expose the model/version;
- include confidence;
- point back to evidence anchors;
- allow UNCLASSIFIED when confidence is insufficient;
- never become an unsupported personality, clinical or causal judgment.

## Learner meaning

Learners should see plain-language results with evidence provenance.

Avoid exposing implementation codes when a human label exists. For example:
- BEI-03 -> Prediction accuracy
- BEI-06 -> Observed adherence

The portfolio is not a scorecard about the person. It is a record of what was tested, what was observed, what can be calculated, and what the learner chose to carry forward.

## Cohort and programme intelligence

Organisation reporting remains aggregate-only and preserves small-cell suppression.

The intelligence layer may combine:
- programme progression;
- experiment activation;
- evidence sufficiency;
- prediction gaps;
- repeated opportunities;
- learning shifts;
- support demand;
- structured context categories.

Patterns should generate review questions and programme decisions, not causal claims.

The long-term programme-learning loop is:

```text
Evidence
  -> pattern
  -> interpretation boundary
  -> programme decision
  -> deliberate change
  -> next cohort
  -> comparison
```

## Definition of done

The evidence loop is complete only when a real learner can:
1. complete Phase A;
2. execute Phase B on its calendar;
3. return to learning after each evidence entry;
4. reach Evidence Review when the window closes;
5. complete the Profile;
6. return to the correct learning position;
7. see an evidence portfolio generated from the same persisted evidence;
8. have deterministic measures traceable to evidence sources;
9. contribute only privacy-safe aggregate signals to programme reporting.
