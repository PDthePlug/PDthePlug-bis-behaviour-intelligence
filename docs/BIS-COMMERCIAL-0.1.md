# BIS Commercial Workspace 0.1

**Status:** Foundation implementation
**Route:** `/commercial`
**Purpose:** Internal Applied Commerce® partnership, pipeline, proposal and outreach operating system.

## Boundary

BIS Commercial is deliberately separate from participant evidence.

Commercial data answers:

- Who could BIS partner with?
- Which buying opportunity exists inside that organisation?
- Which BIS Experience Edition and pathway fit?
- Who is the buyer?
- What has been proposed or sent?
- What happened in outreach and discovery?
- What must happen next?

It does **not** contain learner or participant behavioural evidence, hypotheses, experiment notes, Behaviour Intelligence Portfolio entries, Companion turns or private reflections.

## Architecture

The 0.1 module is mounted inside the existing Next.js/Supabase BIS application but does not depend on the learner shell or onboarding UI.

- `/commercial` — protected commercial workspace
- `/api/commercial` — commercial snapshot and controlled mutations
- `lib/commercial-access.ts` — commercial authorization boundary
- `crm_*` tables — isolated commercial data model
- Supabase Row Level Security — authenticated users must also have a commercial role or `SYSTEM_ADMIN`

This lets the learner/onboarding experience continue to evolve without rebuilding the CRM.

## Roles

- `COMMERCIAL_ADMIN` — commercial workspace administration
- `COMMERCIAL_LEAD` — opportunities, outreach, tasks and commercial records
- `COMMERCIAL_RESEARCH` — research and qualification records
- `COMMERCIAL_READ_ONLY` — read-only commercial visibility
- `SYSTEM_ADMIN` — implicit full commercial access

In 0.1, only `SYSTEM_ADMIN` can assign commercial roles because the existing `role_assignments` RLS reserves role mutation for the system administrator.

Commercial roles do not become BIS operations roles and therefore do not gain facilitator or safeguarding access.

## Data model

- `crm_organisations` — parent accounts
- `crm_contacts` — candidate and verified buyer contacts
- `crm_opportunities` — distinct buying opportunities under an organisation
- `crm_proposals` — controlled proposal registry
- `crm_activities` — outreach, meetings and internal timeline events
- `crm_tasks` — next actions and execution queue
- `crm_discovery_sessions` — discovery requirements and scoping notes
- `crm_audit_events` — commercial change audit trail

The data model intentionally separates a parent organisation from a buying opportunity. Standard Bank CSI, Standard Bank Graduate Programme and Standard Bank People & Culture are three opportunities under one organisation.

## Commercial lanes

- `SCHOOL` — School Edition, ages 14–18
- `EMERGING_ADULT` — Emerging Adult Edition, ages 18–25
- `WORKPLACE` — Workplace Edition, ages 25+

## Controlled opportunity stages

1. `RESEARCH` — account is being understood; buyer route may be unknown
2. `QUALIFY` — fit or procurement route still needs verification
3. `QUALIFIED` — enough fit exists to proceed
4. `THESIS_READY` — prospect-specific commercial argument exists
5. `PROPOSAL_DRAFT` — customer-facing proposal is being produced
6. `PROPOSAL_FROZEN` — copy master is approved; **not yet sent**
7. `CONTACTED` — real outbound contact has been logged
8. `DISCOVERY` — discovery conversation is active or completed
9. `SCOPED` — deployment requirements are sufficiently defined
10. `PROPOSAL_SENT` — scoped commercial proposal has actually been sent
11. `NEGOTIATION` — terms or deployment are being negotiated
12. `WON` — opportunity accepted; future deployment handoff begins
13. `LOST` — opportunity closed without proceeding
14. `NURTURE` — valid relationship, not currently active
15. `WATCHLIST` — wait for a suitable trigger such as a funding call
16. `HOLD` — deliberately blocked from active outreach

Logging an outbound email, WhatsApp message, call or LinkedIn action automatically advances only a **pre-contact** opportunity to `CONTACTED`. It never moves `DISCOVERY`, `SCOPED`, `PROPOSAL_SENT`, `NEGOTIATION`, `WON`, `LOST`, `NURTURE`, `WATCHLIST` or `HOLD` backwards.

## 0.1 seed

The migration seeds:

- **37 parent organisations**
- **50 distinct buying opportunities**
- School, Emerging Adult and Workplace commercial lanes
- **14 Wave-1 opportunities**
- **8 frozen customer-facing proposal masters**
- Wave-1 buyer-verification/outreach tasks

The first six School opportunities, Standard Bank Graduate Programme and Nedbank People & Culture are registered as frozen proposal masters.

DG Murray Trust is explicitly `HOLD` and must not be contacted through this CRM. Zenex Foundation is `WATCHLIST` for a suitable funding call. Harmony Gold remains in qualification pending current portfolio/procurement verification.

## Migration order

Apply these migrations after the existing BIS production migration:

1. `20260912090000_bis_commercial_workspace.sql`
2. `20260912091000_bis_commercial_seed_school_a.sql`
3. `20260912092000_bis_commercial_seed_school_b.sql`
4. `20260912093000_bis_commercial_seed_emerging_adult.sql`
5. `20260912094000_bis_commercial_seed_workplace.sql`
6. `20260912095000_bis_commercial_seed_controlled_masters.sql`
7. `20260912100000_bis_commercial_performance_indexes.sql`

The selected BIS Production Supabase project now has these migrations applied. The remaining 0.1 release gate is application-level verification of the protected `/commercial` route and its authenticated mutations on the deployment produced from this branch.

## Commercial Intelligence

The founder operating layer is specified in [`BIS-COMMERCIAL-INTELLIGENCE-V1.md`](./BIS-COMMERCIAL-INTELLIGENCE-V1.md). It keeps this CRM as the commercial system of record and adds auditable prioritisation, guarded AI preparation and human approval rather than replacing the existing data model.

## Future milestones

### 0.2 — Discovery + Pathway Builder

Discovery questions, evidence requirements, privacy boundaries, deployment constraints and a governed pathway builder over the canonical 32-Lab library.

### 0.3 — Proposal generation + version control

Generate prospect-specific proposals from controlled commercial data while preserving proposal versions and frozen-copy status.

### 0.4 — Won → BIS Deployment Handoff

A won opportunity creates a governed deployment handoff:

`Opportunity → Deployment → Organisation/Site → Cohort → Participants → Programme Pathway → Behaviour Cycles`

Commercial data remains commercial. Programme delivery and participant evidence continue under their own permissions and privacy rules.
