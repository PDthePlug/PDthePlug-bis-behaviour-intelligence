# BIS Behaviour Intelligence

BIS is a private, evidence-first behaviour investigation product. This repository currently ships Habit Lab 4.5.2 and the closed-pilot operations gate.

## Current milestone — Habit Lab 4.5.2 production master

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

Application role assignment does not grant access to the private Site. The Site owner must separately grant Site access to each staff member.

## Access bootstrap

When there is no active system administrator, the oldest existing learner account is promoted on its next authenticated request. This bootstraps the current private Site owner without a hard-coded email. The final active administrator cannot be revoked.

## Development

Requirements: Node.js 22.13 or newer, Linux, `flock`, `curl`, and GNU `timeout`.

```bash
npm run install:ci
npm run dev
```

Useful checks:

```bash
npm run lint
npx tsc --noEmit
npm test
```

After an append-only schema change, generate a new migration without editing earlier migrations:

```bash
npm run db:generate
```

The app uses verified Sites identity headers and a Cloudflare D1 binding declared in `.openai/hosting.json`. The production build is `npm run build`.
