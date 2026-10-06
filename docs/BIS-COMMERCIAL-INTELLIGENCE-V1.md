# BIS Commercial Intelligence v1 — Founder Operating Agent

**Status:** Implementation candidate  
**Workspace:** `/commercial`  
**Default view:** Commercial Intelligence  
**Purpose:** Reduce founder operating load by continuously turning the BIS commercial record into a small number of evidence-backed decisions and prepared next actions.

## Product decision

Commercial Intelligence does not replace BIS Commercial 0.1. It operates over the existing commercial system:

`organisation → opportunity → buyer/contact → proposal → activity → task → discovery → next action`

The CRM remains the commercial system of record. The intelligence layer observes that record, identifies exceptions, prepares work and records human decisions.

It never reads participant behavioural evidence.

## Founder operating loop

`Observe → Prioritise → Prepare → Approve → Execute → Learn`

V1 implements five production capabilities:

1. **Founder Brief** — a current summary of what matters now.
2. **Pipeline Guardian** — detects overdue work, missing next actions, buyer-verification blocks, stale conversations, recipient collisions and explicit holds.
3. **Opportunity Intelligence** — ranks next-best actions with a visible reason, evidence and confidence.
4. **Approval + Draft Centre** — prepares outreach/follow-up drafts and records approve/dismiss decisions without sending externally.
5. **Follow-up Engine** — detects active conversations that have gone quiet and proposes the next human-reviewed move.

## Automation boundary

The agent may autonomously:

- read the commercial CRM;
- calculate pipeline signals;
- rank opportunities;
- create an auditable founder brief;
- create recommendations;
- identify research gaps;
- prepare outreach/follow-up drafts;
- answer questions from the CRM context;
- expire superseded open recommendations.

The agent may **not** autonomously:

- send email, WhatsApp, LinkedIn or other external communication;
- mark a draft as sent;
- change pricing or commercial terms;
- move an opportunity to WON or LOST;
- override HOLD, recipient-collision or sequence instructions;
- invent a buyer, meeting, reply, procurement status or prospect fact;
- read learner answers, private reflections, participant evidence or safeguarding data.

Those boundaries are enforced in the API surface as well as in the model instructions.

## Intelligence persistence

Commercial Intelligence adds:

- `crm_agent_runs` — every generated brief, question and drafting run;
- `crm_recommendations` — evidence-backed next-best actions and decision state;
- `crm_approvals` — immutable human approve/dismiss events;
- `crm_research_sources` — source provenance for later research automation;
- `crm_generated_artifacts` — founder briefs and commercial drafts;
- `crm_signal_events` — detected pipeline exceptions.

All six tables use RLS. Commercial read access follows the existing commercial boundary; writes require SYSTEM_ADMIN, COMMERCIAL_ADMIN, COMMERCIAL_LEAD or COMMERCIAL_RESEARCH. COMMERCIAL_READ_ONLY cannot create agent runs, recommendations, drafts or approvals. Delete is revoked for the audit trail.

## Intelligence engine

The deterministic engine remains authoritative for pipeline facts and guardrails. It currently detects:

- explicit recipient/programme sequence holds;
- outreach-QC records waiting for send approval;
- frozen proposals without a verified buyer route;
- qualified/thesis-ready opportunities without a verified buyer;
- qualified opportunities ready for outreach preparation;
- contacted/discovery/scoped/proposal-sent/negotiation opportunities with no recent activity;
- overdue next actions;
- active opportunities with no next action.

Wave and priority influence ordering, but the engine never turns a score into a commercial fact. Each recommendation retains the evidence that triggered it.

### DRAFT_READY reconciliation

Production already contains `DRAFT_READY` opportunities. Commercial 0.1 did not include that stage in its controlled stage list or board ordering. V1 restores `DRAFT_READY` as a recognized commercial stage so prepared Wave-2 opportunities do not disappear from the human pipeline.

## AI architecture

The model is used for synthesis and language, not for authoritative pipeline state.

- Gateway: Vercel AI Gateway
- Default model: `openai/gpt-5.6-luna`
- Production authentication: Vercel OIDC via `VERCEL_OIDC_TOKEN`
- Local/non-Vercel fallback: `AI_GATEWAY_API_KEY`
- Request state retention: disabled where supported by the Responses request (`store: false`)
- Data sent to the model: compact commercial context only
- Failure mode: deterministic founder brief, answers and safe draft templates remain available

No provider key is required in the Vercel production deployment.

## Daily behavior

When an authorized writer enters Commercial Intelligence, the workspace checks the latest persisted sweep.

A new sweep is created when:

- no sweep exists;
- the commercial input fingerprint changed; or
- the latest sweep was produced on a different **Africa/Johannesburg** calendar day.

The browser triggers the authenticated refresh once. This keeps v1 least-privilege: no service-role credential or unauthenticated cron endpoint is introduced.

A future background scheduler can call a dedicated service-safe execution path once an explicit non-user execution identity and notification contract are approved.

## Experience

The default Commercial workspace opens on **Commercial Intelligence**.

The founder sees:

- Founder operating brief;
- Do now;
- Needs approval;
- Research blockers;
- Follow-ups;
- ranked next-best actions;
- evidence behind each recommendation;
- Open opportunity;
- Prepare draft;
- Approve / Accept;
- Dismiss;
- Ask Commercial Intelligence;
- explicit “Draft only · nothing has been sent” state.

The existing Overview, Pipeline, Organisations, Tasks and Proposals remain available and continue to use the same CRM.

## Release strategy

The two additive schema migrations were first installed and inspected on **BIS Staging**. Production was not modified during implementation.

Release gate:

1. branch CI passes `npm run verify`;
2. responsive browser journeys pass at 360, 430 and 1280;
3. staging RLS/schema checks remain clean for the new tables;
4. exact migrations are reviewed;
5. migrations are applied to BIS Production before production code begins querying the new tables;
6. production deployment is verified read-only before any founder-generated commercial records are created.

## Later milestones

The schema deliberately reserves room for:

- source-backed prospect research;
- meeting preparation;
- post-meeting extraction;
- proposal generation/versioning;
- scheduled background sweeps and notifications;
- email/calendar integration under explicit approval;
- WON → governed programme deployment handoff.

Those capabilities should extend the same operating loop rather than create parallel commercial systems.
