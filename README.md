# BIS Behaviour Intelligence

BIS is a private, evidence-first behaviour investigation product. This repository currently ships Habit Lab 4.5.1 and the closed-pilot operations gate.

## Current milestone

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
