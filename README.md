# BIS Behaviour Intelligence

BIS is a private, evidence-first behaviour investigation product. This repository ships Habit Lab 4.5.2, Decision Lab 4.2.1, Money Lab 4.2 and the closed-pilot operations gate.

## Universal Laboratory presentation contract

The learner runtime follows a semantic presentation contract inspired by the Applied Commerce reader architecture:

- source files remain the canonical authored record, but Word/Markdown formatting is never treated as the learner interface;
- narrative, guidance, questions, choices, evidence fields, measures and tables are interpreted as different interaction types before rendering;
- the visible journey is always the nine-stage BIS laboratory sequence: Hook, Pattern, Revelation, Mapping, Equation, Contract, Experiment, Evidence Review and Profile;
- BEI/TEI codes remain measurement metadata rather than answer choices or duplicated learner questions;
- workbook tables that contain learner blanks become native evidence controls, including responsive mobile row cards;
- reading content stays editorial and quiet while evidence-response surfaces carry the strongest visual hierarchy;
- application navigation stays in product chrome and never floats over learner evidence.

## Universal Laboratory — source-backed production runtime

BIS now exposes the supplied source-backed catalogue through one governed Universal Lab runtime rather than separate one-off readers:

- 29 source-backed Labs run as dynamic Universal V2 version 1.0 releases alongside the dedicated Habit, Decision and Money production runtimes;
- the shared learner journey follows the Habit Lab presentation grammar across Hook, Pattern, Revelation, Mapping, Equation, Contract, Experiment, Evidence Review and Profile;
- imported workbook chrome is normalized out of the learner task flow while source provenance remains attached to the versioned package;
- duplicated manuscript questions collapse to one interaction and authored checkbox answers become native BIS choice controls;
- Volume 1 pre-Lab baselines are presented as a separate private starting-point stage rather than leaking into Investigation 1;
- responsive tables remain contained within the content surface and mobile screens reserve space for the canonical navigation control;
- Career Lab remains outside the supplied three-volume source corpus and Failure Lab remains pending its author source.

## Current milestone — Vercel and Supabase production runtime

The application now runs as a standard Next.js 16 deployment on Vercel with Supabase Auth and Postgres:

- Supabase password authentication replaces hosting-specific identity headers;
- legacy application user IDs remain stable and are linked to Supabase Auth UUIDs, preserving evidence ownership;
- browser and server access use only the public Supabase publishable key;
- Row Level Security protects every public table;
- staff progress is exposed through deliberately restricted views that omit learner answers, equations, rewards, event notes, Companion turns, and memory;
- the existing Site deployment remains an independent rollback point until the Vercel cutover is accepted.

## Canonical Labs — Decision 4.2.1 and Money 4.2

The two added production Labs use the same evidence-first product architecture while keeping their records separate from Habit Lab and from each other:

- distinct versioned enrolments, semantic field namespaces, hypotheses, experiments, measurements and Behaviour Profiles;
- Lab-specific consent before the first baseline is collected;
- nine investigations across a facilitated Phase A and a calendar-gated seven-day Phase B;
- future days remain locked, experienced-day corrections retain provenance and “no opportunity” is valid evidence;
- Day 3 calibration versions the target condition and Pause rather than overwriting the original contract;
- BEI-03 prediction accuracy and BEI-06 adherence are calculated from eligible opportunities only;
- Decision Lab records the descriptive Option Expansion Rate;
- Money Lab distinguishes Full and Minimum Spending Pauses;
- post-experiment rating and equation-confidence shifts are calculated without producing a personality score.

## Habit Lab 4.5.2 production master

Habit Lab 4.5.2 preserves the frozen 4.5.1 object and measurement architecture while applying the registered experience patch:

- Investigation 4 now asks learners to map one real habit carefully, without confrontational framing;
- the Behaviour Contract accepts a cue described by time, place, person, feeling, event, or situation;
- the Investigation 6 insight asks what feels different about the learner’s approach to the pattern;
- repetition-specific working-equation examples replace generic identity-oriented examples;
- both Sipho story episodes and the authored reflection sequence are restored to the supplied production master;
- existing 4.5.1 evidence, progress, hypotheses, and experiment records remain intact while new records carry the 4.5.2 experience version.

## Previous milestone — Release 1.1 refinement

Release 1.1 preserves the frozen Habit Lab 4.5.1 architecture while refining the learner experience from pilot feedback:

- private content is covered by default after the learner enters the signed-in product;
- the privacy screen returns after two minutes of inactivity or when the tab is hidden;
- learners can cover the screen immediately or sign out for stronger shared-device protection;
- the Evidence overview shows non-sensitive structure first and keeps original wording behind deliberate disclosure;
- experiment days are derived from calendar time, so Day 1 cannot open before the configured start date;
- a purposeful between-observations state explains what to do after today's entry and when the next day opens;
- earlier gaps remain correctable from clear memory, but future days remain locked and the interface tells learners not to guess.

## Closed-pilot operations foundation

The closed-pilot operations release adds:

- explicit `SYSTEM_ADMIN`, `FACILITATOR`, and `SAFEGUARDING_OFFICER` roles;
- cohort and canonical Habit Lab version assignment;
- sanitised progress views for administrators and assigned facilitators;
- staff-authored support notes that remain separate from learner reflections;
- learner-initiated human-support requests and facilitator referrals;
- a restricted safeguarding queue with human triage and resolution;
- append-only audit and pilot telemetry records.

The staff API never returns learner answers, hypothesis wording, experiment notes, Companion conversations, or memory items. Administrators receive only an aggregate count of open safeguarding cases. Case details require the explicit safeguarding-officer role.

Application role assignment remains separate from authentication. Staff receive only the product role and row access explicitly assigned to their verified email.

## Access bootstrap

When there is no active system administrator, the first authenticated learner account can bootstrap the initial administrator role. If role assignments are migrated, the existing administrator is matched by verified email instead. The final active administrator cannot be revoked.

## Development

Requirements: Node.js 22.13 or newer and a Supabase project.

Environment setup and the production-project safety guard are documented in
[`docs/ENGINEERING_ENVIRONMENTS.md`](docs/ENGINEERING_ENVIRONMENTS.md). The
application has no implicit backend fallback: every environment must provide
its own Supabase URL and publishable key.

Copy `.env.example` to `.env.local` and set the project URL and publishable key. No service-role key or database password belongs in the browser environment.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
```

The production schema, RLS policies, authentication binding trigger, and restricted staff views are versioned in:

```bash
supabase/migrations/20260909000000_bis_production.sql
```

Apply future schema changes as new append-only Supabase migrations. The production build is `npm run build`.
