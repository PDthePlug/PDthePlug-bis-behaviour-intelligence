# BIS Evidence Intelligence Agents

**Status:** Draft implementation, feature-gated off by default. Not deployed or release-certified.

## Purpose

BIS Evidence Intelligence converts eligible learner-authored free text into a governed **proposal about evidence**, not an automatic judgement about a learner.

The system exists to solve a specific reporting problem: many important BIS questions are answered in a learner's own words, and those answers cannot legitimately become programme variables through keyword counts or generic sentiment analysis. BIS therefore interprets a response in its authored curriculum context, constrains the interpretation to an approved competency and evidence class, checks the proposed claim independently, and only then allows a human-reviewed evidence workflow to determine whether the claim becomes reportable.

The original response remains immutable and authoritative. AI output never replaces it.

## Five agents

### 1. Response Interpretation Agent

**Question:** What is the learner communicating in relation to this authored question?

Allowed to:
- paraphrase the meaning of the response without reproducing learner wording;
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
- select only from authored competency IDs supplied by BIS;
- retain the authored evidence class;
- propose a stage no higher than the deterministic stage ceiling;
- propose evidence strength and confidence;
- return `NOT_SUPPORTED`, `PROPOSED` or `REVIEW_REQUIRED`.

Not allowed to:
- invent a competency or evidence class;
- exceed the authored source ceiling;
- treat plans, predictions or reflections as proof of behaviour;
- call self-report strong observed evidence.

BIS deterministically caps `SELF_REPORT` evidence strength at `MODERATE` even if a model proposes `STRONG`.

### 3. Longitudinal Synthesis Agent

**Question:** What pattern is supported across eligible evidence for one competency over time?

Allowed to:
- synthesise multiple already-derived evidence records;
- distinguish emerging, consistent, inconsistent, regressing and transfer-candidate patterns;
- identify supporting and contradictory evidence IDs;
- propose the highest supported stage already present in the source evidence.

Not allowed to:
- infer improvement from chronology alone;
- exceed the strongest source stage;
- infer transfer without a source record already classified as `TRANSFER`;
- claim durable change, mastery or programme causation.

This agent is implemented as a governed library component. Its production adapter must consume reviewed/eligible evidence history, not arbitrary raw learner text.

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

A contradiction, insufficient evidence, low confidence or scope mismatch forces `REVIEW_REQUIRED`.

### 5. Programme Insight Agent

**Question:** What can a programme manager legitimately learn from already-governed aggregate evidence?

Allowed to:
- translate suppression-safe aggregate competency distributions into concise findings;
- surface support priorities and limitations;
- describe change signals using the wording supported by the aggregate input.

Not allowed to:
- receive learner responses, learner identities or raw evidence;
- reconstruct suppressed cells;
- infer causal programme effects;
- claim mastery, certification or capability acquisition beyond the supplied evidence contract.

The agent refuses cohorts below the reportable threshold and rejects input containing individual-response or learner-identity fields.

## Runtime flow

```text
Learner-authored response
        |
        v
Supabase consent + scope + Lab/version + question-policy gate
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
        +------------------------------+
        |                              |
        v                              v
Longitudinal synthesis          Privacy-safe aggregation
                                       |
                                       v
                              Programme Insight Agent
```

## Model-assisted activation contract

A learner response is not eligible merely because it is text. Every one of the following conditions must be true:

1. the learner is authenticated and active;
2. the exact Lab/version enrolment remains eligible;
3. latest `LEARNER_PRODUCT` consent is `GRANTED`;
4. the evidence record is active, learner-authored (`LR`), a `RESPONSE`, and `TEXT`;
5. sensitivity is `P0`, `P1` or `P2`; `P3` is excluded;
6. the Question Intelligence Registry entry is `ACTIVE`;
7. the question's `aggregate_policy` is explicitly `MODEL_ASSISTED`;
8. its answer model is `TEXT`;
9. an `APPROVED` curriculum evidence mapping exists for that exact Lab/version/semantic field;
10. the mapping points to a competency in the authored BIS competency framework.

A facilitator may access model-assisted interpretation only for evidence the learner explicitly shared in a current, revocable evidence submission assigned to that facilitator. Programme/sponsor roles never receive this raw-text context. System administrators do not receive a new raw-evidence bypass through the agent context RPC.

## Stage ceilings

The model cannot decide how far a source type is capable of evidencing development. BIS applies deterministic ceilings:

| Authored evidence class | Maximum single-response stage |
| --- | --- |
| BASELINE / CONTEXT | NOTICE |
| PREDICTION / PLAN / LEARNING_CHECK | EXPLAIN |
| OBSERVATION / OUTCOME | APPLY |
| INTERPRETATION | TEST_AND_REVISE |
| TRANSFER | TRANSFER |
| SUPPORT_SIGNAL | NOTICE |
| UNCLASSIFIED | NOT_YET_EVIDENCED |

These ceilings are conservative guardrails, not validation that every response reaches the ceiling.

## Prompt injection and unsafe inference

Learner material is treated as evidence to analyse, never as system instructions. The shared agent policy instructs every model to ignore attempts inside learner text to alter rules, reveal prompts, change scores, invent facts or contact another person.

Agents are prohibited from inferring mental-health diagnoses, personality types, protected characteristics, criminality, intelligence, socioeconomic status or family circumstances from learner responses.

## Privacy and data minimisation

Before model processing, BIS removes common direct identifiers such as email addresses, telephone numbers, URLs and explicit identifier tokens from the text supplied to the model. Model calls use Vercel AI Gateway with `store:false`.

The API accepts only an `evidenceId`; clients cannot send arbitrary learner text for scoring. The database resolves the eligible response under the signed-in user's access boundary.

Raw learner text is not returned in the Evidence Intelligence API response.

## Authority and persistence in v1

**AI output is currently non-reportable.** The API returns `reportable: false`.

The first version intentionally does **not** add a privileged service-role process that writes AI judgements directly into reportable evidence tables. A browser-supplied AI result would be forgeable, while a service-role shortcut would undermine BIS's existing least-privilege evidence architecture.

Therefore:
- AI interpretation is a proposal;
- existing learner evidence remains the source record;
- existing facilitator assessment remains the reportable human review path;
- durable AI-proposal persistence requires a separately reviewed trusted-server write contract with idempotency, provenance and append-only history.

This choice keeps AI from silently becoming an assessment authority.

## Configuration

Evidence Intelligence is disabled unless all required runtime credentials exist **and**:

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
- each intended free-text question is explicitly reviewed and promoted to `MODEL_ASSISTED` rather than batch-enabled;
- its competency mapping and evidence class are approved against the canonical Lab source;
- a representative labelled evaluation set has been created for each question family;
- model agreement, false-positive overclaim rates and human-review rates are measured;
- data-processing/privacy review confirms the permitted model-processing scope for learner data;
- staging verifies consent withdrawal, facilitator switching and Lab-version isolation end to end;
- the longitudinal adapter is bound to reviewed evidence history;
- the programme adapter consumes only suppression-safe report aggregates;
- deployment and rollback controls are certified.

## Evaluation before production

BIS should evaluate these agents against human-labelled examples rather than relying on plausible model prose. Minimum evaluation dimensions should include:

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

The target is not for the model to agree with every reviewer. The target is for unsupported high-stage claims and privacy failures to be exceptionally rare, auditable and caught before they reach reporting.
