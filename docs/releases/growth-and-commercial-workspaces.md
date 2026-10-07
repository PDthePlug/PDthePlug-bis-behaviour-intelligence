# Growth and commercial workspaces

My BIS is the learner’s personal development area. Growth leads the page, with direct navigation to Journey, Evidence, Feedback and Work. Journey uses existing Lab enrolments; Feedback contains actual reviews of learner-shared work; Work opens the original saved response with focus and its enclosing history expanded. Evidence selection, withdrawal and retained review history keep their existing permissions. Lab completion and profile navigation now lead directly to My BIS.

The facilitator group view puts competency development and suggested check-ins ahead of operational counts. Its progression cells preserve hidden values. Programme results also lead with the development picture and next practice opportunity, while participation, measurements and their bases remain available below. The existing curriculum framework, evidence requirements, measures and aggregate privacy thresholds are unchanged.

Commercial Intelligence remains additive at `/commercial?section=intelligence`. Overview stays the commercial home, with an explicit entry to Intelligence. The initial founder capabilities are:

- A daily brief and ranked actions, with views for today, approvals, follow-ups, research and all actions.
- Pipeline review for missing next actions, overdue commitments, unverified buyer routes, incoming replies and meetings without recorded follow-up.
- Opportunity memory covering recorded programme fit, access, timing, recent commercial conversations and commitments. Prospect-specific questions use these records.
- A persistent draft and approval centre. Reviewed messages are appended as new artifacts; the original wording and author remain available. Unsaved edits require a discard choice. Opening a draft moves focus to it.
- Bounded follow-up preparation. Follow-ups appear after three quiet days; three unanswered outbound messages block another follow-up draft. Incoming replies are reviewed as replies. HOLD, closed stages and recipient overlap remain guarded.

Human approval and dismissal decisions are remembered for seven days while their evidence remains unchanged. New supporting facts make the action reviewable again. Approval counts reflect pending recommendations. Sending messages, commercial terms and final stages remain human decisions.

Administration now starts with practical programme actions. Content Studio leads with choosing a title and whichever edition is ready. Its upload, preview, approval, publish, offline and restore lifecycle remains intact.

## Daily preparation

The Vercel schedule calls `/api/commercial/intelligence/sweep` at 05:00 UTC (07:00 Johannesburg). Trusted record-change webhooks can POST to the same route. Configure these **server environment settings directly in the deployment**, without committing their values:

| Setting | Purpose |
| --- | --- |
| `CRON_SECRET` | A random scheduling secret of at least 16 characters; the caller supplies `Authorization: Bearer …`. |
| `BIS_COMMERCIAL_AUTOMATION_ENABLED` | Set to `true` only when enabling unattended preparation. |
| `BIS_COMMERCIAL_AUTOMATION_EMAIL` | Dedicated account with active commercial GLOBAL scope and a writer role. |
| `BIS_COMMERCIAL_AUTOMATION_PASSWORD` | That account’s password, held as a server secret. |

The account signs in through the ordinary publishable client. Identity, role checks and RLS apply to every sweep; no service-role key is used. The short-lived session is signed out locally afterwards. The existing transaction lock and same-day fingerprint reuse handle duplicate invocations. No participant evidence is included. Record-change webhooks should watch original commercial records, not generated run/artifact tables, to avoid feedback loops.

Unattended preparation is disabled by default. No automation account was created, no credentials were retrieved or configured, no production database was changed and no commercial message was sent during this work. The interactive morning brief remains available without scheduled credentials. External web research, proposal terms and delivery handoff remain subsequent integrations; this release completes the initial founder workflow using the commercial record.

## Verification

The focused dashboard matrix passed 69 browser journeys at 360px, 430px and 1280px, including My BIS navigation, evidence privacy, saved-draft re-entry/revision, failed saves, revoked access, group development privacy and the Content Studio lifecycle. Local PostgreSQL tests verify draft append behaviour, unchanged originals, audit stamping, transaction rollback and denied roles. Scheduler tests cover invalid callers, disabled setup, missing configuration, successful/reused preparation and role failure. The PR’s `npm run verify` check is the release gate for the final commit.
