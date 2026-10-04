# BIS staging acceptance execution — 4 October 2026

## Outcome

**Acceptance is blocked, not passed.** This execution started from remote commit
`32508731dc14b70257cef4e6a85178335d5f4005` on
`implementation/bis-full-scope-20261004` and verified that the configured public
backend is BIS Staging (`lbmhkddrkhtmkcvfmumd`). Network access to Supabase and
GitHub and the installed Playwright Chromium browser were available.

The task environment supplied only `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It supplied no staging Auth Admin
credential, database administration connection, protected synthetic-account
credential store, or existing learner/staff login credentials. The real staging
suite therefore failed closed before authentication with
`BIS_STAGING_LEARNER_EMAIL is required and must be supplied outside source
control.` A publishable client key cannot provision accounts.

No account was created, no password was generated or submitted, no privileged
provisioner was enabled, and no staging data or content activation was changed.
Production was not accessed. There is consequently no new authenticated API,
database, screenshot, version, enrolment, upload, denial, or rollback evidence
from this run.

## Independent verification and repaired failure

The first deterministic `npm run verify` attempt passed runtime, lint,
TypeScript, 532 acceptance tests, the 32-source audit, and the production build,
but its browser phase failed the complete nine-investigation Leadership journey
at all three viewports. Each individual journey passed below the unchanged
90-second test timeout, while two concurrent copies exhausted the local runner
and stalled late saves. The Playwright fixture runner now uses one worker so the
complete control-heavy journey is exercised without resource starvation or a
weakened/increased timeout.

Focused proof after the repair passed the complete Leadership journey at 360,
430 and 1280 pixels (3/3). The complete `npm run verify` command then passed: runtime check, lint,
TypeScript, 532 acceptance tests, the 32-source audit, optimized production
build, and all 45 browser tests at 360, 430 and 1280 pixels.

## R01–R13 ledger

| Requirement | This execution | Evidence / remaining blocker |
| --- | --- | --- |
| R01 views, roles and backend integrity | **Blocked** | Public staging identity confirmed; no credentials for normal authenticated role sessions or privileged setup. |
| R02 faithful handbooks and controls | **Partial local pass** | Canonical audit and fixture browser coverage passed; no complete authenticated page-by-page staging review. |
| R03 Phase A through Profile and learning loop | **Blocked** | No dedicated authenticated learners; no twenty complete journeys or calendar simulation executed. |
| R04 persisted measures, portfolio and provenance | **Blocked** | Deterministic tests passed; no live authenticated lifecycle or read-only database proof. |
| R05 programme intelligence | **Blocked** | Local acceptance passed; no authenticated owner report/export evaluation against the controlled cohort. |
| R06 ask once and evidence classes | **Blocked** | Source audit passed; fourteen REVIEW sources and authored repetition still require specific human decisions. |
| R07 Universal continuity and rollback | **Blocked** | Local continuity tests passed; no live pinning, legacy parity, activation restoration or rollback proof. |
| R08 source/input/calculation/Profile mapping | **Blocked** | Source pipeline passed; ENT Awareness/Mindset remains an owner decision and was not inferred. |
| R09 Risk and Identity factory reuse | **Blocked** | Local source/compiler proof passed; no authenticated Studio publication or learner persistence. |
| R10 complete Content Studio lifecycle | **Blocked** | Local lifecycle tests passed; no live operator prepare/preview/check/approve/publish/offline/restore sequence. |
| R11 twenty varied complete learners | **Blocked** | No accounts could be created or reused in this environment. |
| R12 uploads, re-entry, consent and privacy | **Blocked** | Local tests passed; no current-candidate live upload/removal/wrong-user/withdrawal matrix. |
| R13 roles, invitations and email | **Blocked** | Missing four staff sessions and test inbox; invitation, verification and recovery delivery remain unaccepted. |

## Reproduction contract

The protected execution environment must provide these names (values must never
be committed or printed):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- a destination-bound staging-only Auth Admin secret or service connection
- `BIS_STAGING_LEARNER_EMAIL`
- `BIS_STAGING_LEARNER_PASSWORD`
- `BIS_STAGING_ADMIN_EMAIL`
- `BIS_STAGING_ADMIN_PASSWORD`
- role-specific credentials for FACILITATOR, PROGRAMME_OWNER and
  SAFEGUARDING_OFFICER when the expanded runner is implemented
- optional controlled inbox credentials for invitation/verification/recovery
- `BIS_STAGING_ALLOW_MUTATIONS=true` and an authored
  `BIS_STAGING_EVIDENCE_FIXTURE` only for the dedicated resettable learner

Generated account credentials belong in the environment's protected ignored
secret store; no such store was mounted in this execution. Run `npm run
test:staging` only after confirming `/api/staging-certification/environment`
reports `lbmhkddrkhtmkcvfmumd`, then run the controlled calendar journey with an
explicitly recorded `BIS_STAGING_CERTIFICATION_CLOCK_ISO` per simulated day.
The current staging harness remains incomplete for the commissioned 20-learner,
four-staff, factory, reporting, upload, invitation and database-read matrix; a
green limited harness must not be presented as full acceptance.

## Activation and retained data

No activation was read or changed, so there was nothing to restore. No new
synthetic data was retained by this execution. Previously documented staging
synthetic data is historical evidence only and was not authenticated or mutated
in this run.

## Release decision

Keep PR #106 open. Do not merge, deploy production, retire legacy runtimes, or
claim the full product accepted. Resume the live acceptance only in an
environment containing the authorized staging-only administration secret,
protected test-account credentials (or permission to create them), and a
controlled inbox if email delivery is to be accepted.
