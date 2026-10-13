# BIS Evidence Intelligence Agents

**Status:** Draft implementation, feature-gated off by default. Not deployed or release-certified.

## Purpose

BIS Evidence Intelligence converts eligible evidence into governed **proposals about development evidence**, not automatic judgements about learners.

The system exists because BIS asks many questions in a learner's own words. Those answers cannot legitimately become programme variables through keyword counts, sentiment analysis, task completion or generic AI summaries. BIS therefore separates five things that must never be conflated:

1. what an authored question means;
2. which competency that question is relevant to;
3. which evidence class it can produce;
4. the highest developmental stage that source could possibly support;
5. whether the response may be reviewed by a model or aggregated into programme reporting.

The original evidence remains immutable and authoritative. AI output never replaces it.

## Source question evidence contracts

`question_evidence_contracts` is the semantic control plane for the agent system. Contracts contain no learner data and no manuscript wording. They bind the stable Question Intelligence `question_family` hash to:

- Lab code;
- authored competency ID;
- evidence class;
- deterministic stage ceiling;
- source nature;
- aggregation policy;
- model-review policy;
- claim authority;
- measurement-validation status;
- privacy scope;
- allowed and forbidden inference;
- source reference and source hash.

The two Question Intelligence contract columns added by this phase (`model_review_policy` and `contract_id`) are migration-owned in this draft. The application ORM does not query or write them directly; database defaults/triggers and access-safe RPCs are authoritative. This avoids unrelated churn in the central application schema until a product surface actually needs those fields.

### Meaning approval is not measurement validation

`APPROVED_MEANING` means BIS has an approved interpretation of what evidence that question is intended to solicit. It does **not** mean the question is a validated psychometric scale, that its response measures a latent trait, or that the learner has reached the stage ceiling.

All Volume 1 source contracts remain `NOT_VALIDATED` as measurement constructs unless a separate validation programme changes that status.

### Aggregation and model review are independent

A response can be fully understood by BIS while remaining private and excluded from programme aggregation.

- `aggregation_policy` controls whether a structured response may contribute to aggregate reporting.
- `model_review_policy` controls whether explicitly learner-shared free text may enter facilitator-only model review.

`MODEL_ASSISTED` is no longer treated as an aggregation mode. Current model review requires `FACILITATOR_SHARED_ONLY`.

### Fail-closed default

A question without an approved source contract is automatically:

- `CANDIDATE`;
- `aggregate_policy = EXCLUDE`;
- `model_review_policy = DISABLED`.

Compiler heuristics cannot silently activate an uncontracted question.

## Current source coverage

The supplied Volume 1 forensic source covers:

- **10 distinct Lab titles**: ATT, DEC, HAB, INF, LEA, MON, PUR, RES, RSK and TIM;
- **29 unique Lab/edition pairs**;
- **4,115 unique source question families** inventoried for contract governance.

The conservative source-contract set currently contains **1,975 approved meaning families**:

| Contract class | Families | Current stage ceiling | Model review |
| --- | ---: | --- | --- |
| BASELINE | 136 | NOTICE | Disabled |
| LEARNING_CHECK | 1,131 | EXPLAIN | Facilitator-shared only |
| INTERPRETATION / private reflection | 708 | EXPLAIN | Facilitator-shared only |

The remaining **2,140 task or ambiguous source families** are not silently promoted. They remain fail-closed until their assessment meaning, rubric and claim authority are authored.

This is **not** a claim that all 34 BIS catalogue Labs have been contracted. The supplied source covers ten Lab titles. Other catalogue Labs require their canonical source before they can be activated under the same contract process.

## Five agents

### 1. Response Interpretation Agent

**Question:** What is the learner communicating in relation to this authored question?

Allowed to:
- paraphrase meaning without reproducing learner wording;
- identify explicit behavioural or reasoning signals supported by the response;
- identify contextual qualifiers and uncertainty;
- describe the supplied source nature.

Not allowed to:
- assign a competency stage or score;
- invent a competency;
- convert self-report into observation or assessment;
- diagnose or infer protected/sensitive personal characteristics.

### 2. Evidence Classification Agent

**Question:** What governed evidence claim, if any, can this interpretation support?

Allowed to:
- select only authored competency IDs supplied by BIS;
- retain the authored evidence class;
- propose a stage no higher than the contract ceiling;
- propose evidence strength and confidence;
- return `NOT_SUPPORTED`, `PROPOSED` or `REVIEW_REQUIRED`.

Not allowed to:
- invent a competency or evidence class;
- exceed the source ceiling;
- treat plans, predictions or reflections as proof of behaviour;
- call self-report strong observed evidence.

BIS deterministically caps `SELF_REPORT` evidence strength at `MODERATE` even if a model proposes `STRONG`.

### 3. Longitudinal Synthesis Agent

**Question:** What pattern is supported across human-reviewed evidence for one competency over time?

The production adapter is now connected to `bis_agent_reviewed_evidence_history`.

It receives only evidence that is:
- in the facilitator's assigned active cohort;
- from an active learner with current `LEARNER_PRODUCT` consent;
- from the cohort's exact Lab/version enrolment;
- explicitly shared by the learner in a current evidence submission;
- covered by the latest source-contract-backed approved mapping;
- covered by the latest human assessment whose disposition is `REVIEWED`.

It receives **no raw learner wording**.

Current stage projection is deliberately conservative:
- ordinary reviewed self-report enters longitudinal history at `NOTICE`;
- a `LEARNING_CHECK` may enter at `EXPLAIN` only when it is linked to an authored rubric and the contract permits at least that stage;
- nothing in the current Volume 1 meaning set can become `APPLY`, `TEST_AND_REVISE` or `TRANSFER` merely because it was reviewed.

The agent still cannot infer improvement from chronology alone, exceed the strongest supplied stage, infer transfer without a source transfer record, or claim mastery/durable change/causation.

### 4. Quality & Contradiction Agent

**Question:** Is the proposed classification actually supported, internally consistent and within the authored evidence contract?

Allowed to:
- challenge the first two agents;
- flag overclaiming, contradiction, source-provenance mismatch, hypothetical language and insufficient context;
- lower confidence;
- force human review.

Not allowed to:
- create a stronger claim than the classification it reviews;
- treat contradiction as a character judgement about the learner.

A contradiction, insufficient evidence, low confidence, provenance mismatch or stage overclaim forces `REVIEW_REQUIRED`.

### 5. Programme Insight Agent

**Question:** What can an authorised programme stakeholder legitimately learn from already-governed aggregate evidence?

The production adapter is now connected to `bis_agent_programme_aggregate`.

It receives only:
- current, active, consented participants with the cohort's exact Lab/version enrolment;
- current learner-shared submissions;
- latest human assessments with disposition `REVIEWED`;
- source-contract-backed approved mappings;
- competency-level aggregate counts after privacy suppression.

It receives **no learner IDs, names, emails, evidence IDs, response wording, assessment feedback or P3 content**.

Privacy rules are applied before the model call:
- fewer than five eligible participants suppresses the programme aggregate;
- a competency needs at least three reportable participants;
- if the complementary participant group would contain one or two people, the competency is withheld;
- if any non-zero stage or evidence-strength cell would contain one or two people, the whole competency is withheld.

This is intentionally stricter than hiding a single unsafe cell because adjacent totals can otherwise reconstruct the withheld count.

## Runtime flow

```text
Canonical Lab source
        |
        v
Question-family evidence contract
        |
        +--> uncontracted -> CANDIDATE / EXCLUDE / AI DISABLED
        |
        v
Runtime question + exact Lab/version
        |
        v
Learner-authored response
        |
        v
Consent + enrolment + explicit share + facilitator scope
        |
        v
PII minimisation
        |
        v
Response Interpretation Agent
        |
        v
Evidence Classification Agent
        |
        v
Independent Quality & Contradiction Agent
        |
        v
PROPOSED / REVIEW_REQUIRED / NOT_SUPPORTED
        |
        v
Existing human-reviewed BIS evidence workflow
        |
        +-------------------------------+
        |                               |
        v                               v
Reviewed-evidence history        Suppression-safe cohort aggregate
        |                               |
        v                               v
Longitudinal Agent (3)           Programme Insight Agent (5)
```

## Model-assisted activation contract

A learner response is not eligible merely because it is text. Every one of the following must be true:

1. the caller is an authenticated facilitator;
2. the learner is active;
3. the exact Lab/version enrolment remains eligible;
4. latest `LEARNER_PRODUCT` consent is `GRANTED`;
5. the evidence is active, learner-authored (`LR`), a `RESPONSE`, `TEXT`, and P0-P2;
6. the learner explicitly shared that evidence in a current, revocable submission assigned to the facilitator;
7. the Question Intelligence Registry row is `ACTIVE`;
8. `model_review_policy = FACILITATOR_SHARED_ONLY`;
9. the answer model is `TEXT`;
10. the exact Lab/version/semantic field has the current `APPROVED`, contract-backed curriculum mapping;
11. the competency exists in the authored BIS framework.

Programme/sponsor roles and system administrators do not gain this raw-text review path.

## Stage ceilings

Stage ceilings are properties of the source contract, not model decisions. They answer:

> What is the strongest kind of evidence this question could legitimately support if the response itself is sufficient and human review supports it?

A ceiling is **not** evidence that the learner reached that level.

The current activated Volume 1 contracts intentionally stop at:
- `NOTICE` for baseline self-report;
- `EXPLAIN` for approved learning checks and private interpretation prompts.

Higher stages require separately authored task/assessment contracts. In particular:
- a plan is not APPLY;
- completing an experiment task is not automatically TEST_AND_REVISE;
- a transfer prompt is not evidence of sustained transfer.

## Prompt injection and unsafe inference

Learner material is evidence to analyse, never system instruction. Agent policy requires models to ignore attempts inside learner text to alter rules, reveal prompts, change scores, invent facts or contact another person.

Agents are prohibited from inferring mental-health diagnoses, personality types, protected characteristics, criminality, intelligence, socioeconomic status or family circumstances from learner responses.

## Privacy and data minimisation

Before model processing, BIS removes common direct identifiers such as email addresses, telephone numbers, URLs and explicit identifier tokens. Model calls use Vercel AI Gateway with `store:false`.

The evidence-review API accepts only an `evidenceId`; clients cannot submit arbitrary learner text for scoring. Supabase resolves eligible text under the facilitator's current learner-share boundary.

Raw learner text is not returned in the API response. Agent 3 and Agent 5 never receive raw learner text at all.

## Authority and persistence

**All current agent outputs are non-reportable.** APIs return `reportable: false`.

The implementation intentionally does not add a service-role process that writes AI judgements directly into reportable evidence tables. Human review remains the reportable authority.

Therefore:
- AI interpretation/classification is a proposal;
- original learner evidence remains the source record;
- facilitator assessment remains the human review path;
- Agent 3 consumes only that reviewed derived evidence;
- Agent 5 consumes only privacy-suppressed aggregate reviewed evidence.

## Configuration

Evidence Intelligence is disabled unless runtime credentials exist **and**:

```env
BIS_EVIDENCE_AI_ENABLED=true
```

Optional configuration:

```env
BIS_EVIDENCE_AI_MODEL=openai/gpt-5.6-luna
BIS_EVIDENCE_AI_MIN_CONFIDENCE=0.80
```

Vercel deployments use `VERCEL_OIDC_TOKEN`; local/non-Vercel runtimes can use `AI_GATEWAY_API_KEY`.

## Production-readiness conditions

Do not enable the feature globally until all of the following are complete:

- PR161's reporting-scope defects are corrected and regression-tested;
- source contract migrations pass against a clean current schema and a representative existing database;
- every additional catalogue Lab has its canonical source supplied and contracted before activation;
- the remaining task/ambiguous families receive authored assessment meaning, rubric and stage authority rather than heuristic promotion;
- a representative labelled evaluation set exists for each model-reviewed question family;
- interpretation agreement, false-positive overclaim rates and review rates are measured;
- privacy/data-processing review confirms permitted model processing for learner data;
- staging verifies consent withdrawal, facilitator switching, submission revocation and Lab-version isolation end to end;
- programme suppression is tested against reconstruction attacks;
- deployment and rollback controls are certified.

## Evaluation before production

BIS should evaluate agents against human-labelled examples rather than plausible model prose. Minimum evaluation dimensions include:

- interpretation agreement;
- competency classification agreement;
- stage overclaim rate;
- missed contradiction rate;
- transfer false-positive rate;
- PII leakage rate;
- prohibited sensitive-inference rate;
- prompt-injection resistance;
- confidence calibration;
- human-review burden by question family and Lab version.

The target is not perfect model agreement. The target is for unsupported high-stage claims, privacy failures and false programme claims to be rare, auditable and blocked before reporting.
