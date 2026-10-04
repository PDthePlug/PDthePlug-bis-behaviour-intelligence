# Codex commissioning brief: BIS authenticated staging acceptance and fixes

This is a task prompt to commission in the existing BIS Codex environment. It has not been launched from this chat. Confirm the saved environment's actual access before execution; its name, credentials and network settings are not visible in this workspace. A task instruction does not override workspace approval policies.

## Task prompt

Continue the existing BIS digital-platform work and complete its authenticated staging acceptance, repairing failures you discover. Work in the canonical repository `PDthePlug/PDthePlug-bis-behaviour-intelligence` on `implementation/bis-full-scope-20261004` (PR #106). Start from the branch's current remote head, preserving its implemented fixes; do not start from the older main branch or create a separate product.

Read `AGENTS.md`, `docs/BIS_FULL_SCOPE_TAKEOVER_20261004.md`, `docs/STAGING_RELEASE_CERTIFICATION.md`, `docs/EVIDENCE_INTELLIGENCE_LOOP.md`, the Risk/Identity factory proof documents, and the original authored material available in the repository. Account for all R01–R13 requirements. Existing local proof is 532 acceptance tests, 32 actual source-pipeline checks and 45 intercepted browser checks; it does not replace real authenticated acceptance.

### Specific authorized staging scope

Create or reuse **24 dedicated synthetic test accounts** in **BIS Staging**, project **`lbmhkddrkhtmkcvfmumd`**, URL **`https://lbmhkddrkhtmkcvfmumd.supabase.co`**: twenty learners plus one SYSTEM_ADMIN, one FACILITATOR, one PROGRAMME_OWNER and one SAFEGUARDING_OFFICER. Generate strong unique test passwords in this environment and submit them only to that verified project's normal Supabase Auth Admin API using authorized staging credentials. Auto-confirming these synthetic accounts is permitted for test setup; it does not prove email delivery or self-service verification.

Use learner addresses `fullscope-YYYYMMDD-NN@bis-staging.example.invalid` to match the existing controlled staging calendar contract. Bootstrap canonical role assignments with appropriate scopes, a dedicated test cohort and synthetic membership as needed. You may write synthetic staging responses, upload test images to private storage, prepare immutable source-backed staging versions, publish/unpublish/republish/rollback those controlled versions, and fix application/test/migration defects exposed by the tests. Record and restore previous activations safely.

Verify the backend identity before every destructive/setup phase and before submitting credentials to any running application. Production project `swmhsqivqaqwovojbceo` and production learner data are outside this task. Keep all privileged credentials in the environment's authorized secret mechanism; generated test credentials stay in protected, ignored storage. Never print or commit credentials, tokens, authenticated traces or cookies.

The earlier temporary provisioner is disabled and previous ChatGPT execution was rejected by automatic approval review. Do not silently revive it, bypass a rejection, manually insert Auth password hashes or use privileged credentials to simulate learner acceptance. If this environment lacks authorized administration access or rejects the specifically scoped action, report the precise blocker and continue independent work.

### Execute and repair

1. **Environment preflight and accounts:** verify the selected repository/branch, staging reference, authorized Auth administration access, task-phase connectivity and browser dependencies. Provision the accounts, then prove normal password sign-in and application onboarding/consent. Privileged setup is allowed only for test preparation; learner/staff journey checks must use normal sessions, APIs and RLS.
2. **Governed factory and Content Studio:** prepare, compile, preview, final-check, approve and publish authored Habit, Risk and Identity specimens. Exercise edit/replacement, take offline, republish and rollback through the real operator UI. Verify immutable history, exact artifacts, edition independence, pinning of enrolled versions and safe restoration. Do not blanket-approve REVIEW sources without checking the specific authored repetition and recording the decision.
3. **Twenty complete learner journeys:** all twenty complete the shared Habit baseline and nine-stage journey, including Phase A, calendar-controlled evidence, valid no-opportunity days, Review, Profile, return to learning and evidence portfolio. In addition, exercise Risk and Identity reuse with enough learners to test permissible aggregate reports. Test Decision/Money parity and legacy return paths. Include future-day rejection, missing days, declined questions, correction/retry, refresh and re-entry.
4. **Calendar evidence:** use the provided local-development staging clock only for matching dedicated synthetic learners and the exact staging backend. Record each simulated instant. Do not alter database dates to bypass gates or claim that simulated days are an elapsed seven-day outcome study. The preview/production build always uses real time.
5. **Persistence and provenance:** verify through authenticated APIs plus read-only database checks that each response has its correct current/history evidence records, calculated values use exact valid leaf sources, missing evidence stays missing, consent withdrawal works, and portfolios show meaningful labels without private wording. Test concurrent/repeated saves and recovery from a failed derived-measure update.
6. **Roles, privacy, uploads and reporting:** test each operational role and unauthorized counterpart at 360, 430 and 1280 pixels. Prove actual private image upload, refresh, removal and wrong-user denial. Verify facilitator/owner reports, export, historic version reporting, revoked consent, cohort-size and small-cell suppression. Test navigation/back/menu, error/recovery states, all material role routes and handbook pages. No simulated session or SQL impersonation counts as authentication proof.
7. **Invitations and email:** exercise invitation issue/acceptance and recovery/verification using a configured test inbox if available. Never send messages to real third parties. Synthetic `.invalid` accounts cannot prove mail delivery; if a controlled inbox is unavailable, retain that acceptance blocker. Independent human acceptance and unresolved authored meaning (including ENT Awareness/Mindset comparison) must remain explicitly unaccepted until genuine evidence/owner decisions exist.

Extend the current staging harness: it covers only limited learner/admin checks. Implement the missing journeys and assertions rather than merely rerunning it or reporting skipped mutation tests as passed. Fix reproducible implementation defects in the same candidate; preserve original authored files and measurement intent. Retain legacy compatibility until migration parity and rollback safety are proven.

### Return for continuation

Push changes to the PR #106 branch and leave the PR open for reconciliation and release. Return:

- Exact final commit SHA and green `npm run verify`/GitHub CI results.
- A requirement-by-requirement R01–R13 status with actual passes, failures, skips and remaining blockers.
- A reproducible staging runner/provisioning method, secret-variable names only, and a private credential-storage reference rather than values.
- Sanitized browser screenshots/reports and real authenticated API/database evidence identifying the staging cohort, versions, enrolments and source links.
- Content activation restoration/rollback result and any retained synthetic data.

Remove or disable temporary privileged provisioning capability after setup. Do not merge main, deploy production, retire legacy runtimes or declare the complete product delivered as part of this handoff. We will reconcile the returned evidence, resolve owner decisions and release the accepted exact candidate afterward.

## Environment access checklist

Check the existing environment before asking the owner to change anything. It needs:

- Node >=22.13, locked dependencies, Playwright Chromium and its OS dependencies.
- Direct public config: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` pointing to BIS Staging.
- Authorized **staging-only** Auth Admin credential/service connection. A public publishable key cannot create users. Prefer the environment's network-secret mechanism for the credential sent to the verified Supabase HTTPS host; keep it outside browser configuration.
- Task-phase access to the exact staging host, GitHub and required npm/browser download hosts. Allow the HTTP methods needed for account creation, saves, uploads and cleanup; read-only networking is insufficient.
- For remote preview tests, authorized Vercel deployment-protection access where required; local app + real staging backend is also valid.
- Optional controlled test inbox access for genuine invitation/verification/recovery delivery. Do not infer it from auto-confirmed accounts.

Current Codex Cloud supports direct environment variables and destination-bound network secrets; the latter expose placeholders to programs and substitute the credential for allowed HTTPS destinations. Existing legacy environment settings may behave differently. Verify access in a fresh task after any saved-environment update. Official reference: https://learn.chatgpt.com/docs/environments/cloud-environments


## Follow-up after the blocked Codex run (4 October 2026)

The owner returned a Codex report for local commit `6c1e950c7b5d2e7b5836dd983639c50e9cb84152`. It reports a passing local `npm run verify`, a one-worker browser configuration change, and a live-suite preflight failure caused by missing protected credentials. It reports no account creation, no staging/production data mutations, and no production release. These are returned-task claims, not independent verification of that unpublished commit. GitHub was checked: it does not currently have that commit, and PR #106 still had head `32508731dc14b70257cef4e6a85178335d5f4005` at the check. Recover and inspect the actual diff before accepting its changes or test claims.

### Recover the existing work

1. Preserve the original task's local commit and execution report. Do not reset its branch or discard the work to start again.
2. Restore an authenticated GitHub connection with write access to this repository. Fetch the PR #106 branch and rebase the unpublished commit onto its current head, resolving only actual conflicts and preserving both reports and commissioning instructions. Do not force-push over remote work.
3. Review the browser-worker change against `AGENTS.md`: resource scheduling may be adjusted, but keep the 90-second test timeout, all viewport projects, all assertions and the full verification contract. Re-run verification after integrating the diff.
4. If repository write access cannot be restored, export the original commit through Codex's downloadable diff/patch artifact and return that artifact. A commit SHA or `make_pr` title/body alone is not a recoverable code handoff. Check the artifact contains no secrets before returning it.

### Repair the saved environment before another acceptance run

Configure the existing environment through its protected settings, not through chat or source files. Required external access is:

- An authorized staging-only Auth Admin credential/service connection for `lbmhkddrkhtmkcvfmumd.supabase.co`. For a new provisioning runner, use `BIS_STAGING_AUTH_ADMIN_KEY` as its private input contract; this name is proposed for implementation and is not consumed by the current staging suite. A destination-bound network secret may supply this credential in outbound HTTPS requests. Verify the actual client uses the environment's proxy; do not require a raw credential in a local file when proxy substitution is configured.
- Authenticated GitHub repository write access, plus task-phase access to the exact staging host and dependency/browser hosts.
- The existing staging public configuration and installed browser dependencies.

Test these connections without creating users or printing returned user data. Save and republish the changed environment and verify it in a fresh task, while retaining/exporting the original task's unpublished work first. Existing tasks retain their own state; changing the saved environment is not proof that the old task acquired its new access.

### Provision first, then run authenticated acceptance

Pre-existing learner/staff passwords are **not** an additional owner-supplied prerequisite when authorized provisioning access is available. Generating those credentials is part of this assignment.

Implement or recover an executable, idempotent provisioning step before Playwright's authenticated global setup. Keep its target strictly restricted to the authorized staging project and dedicated synthetic identities; preserve unrelated users, avoid duplicates on retry, and report partial setup safely. Do not reuse the disabled temporary Edge Function or bypass an approval rejection. Use the normal authorized Auth Admin API and canonical application role/cohort setup, then prove login with normal sessions.

Create protected, ignored credential storage inside the task (directory mode 0700, credential file mode 0600), rather than requiring the owner to supply an already populated synthetic-account store. If credentials need to survive outside this task, use an explicitly configured private secret store and return only its reference. Keep screenshots, traces and logs free of passwords, cookies and tokens.

The existing suite requires these generated values:

- `BIS_STAGING_LEARNER_EMAIL`
- `BIS_STAGING_LEARNER_PASSWORD`
- `BIS_STAGING_ADMIN_EMAIL`
- `BIS_STAGING_ADMIN_PASSWORD`

Have the provisioning runner supply them to the test process without printing or committing them, and extend role fixtures to cover all 24 accounts. Do not run the authenticated suite first and treat its missing generated credentials as proof that the owner must create accounts manually.

A controlled inbox is required for **email-delivery acceptance**, not for provisioning auto-confirmed synthetic accounts or running other authenticated journeys. Continue all account, role, lifecycle, privacy, upload, reporting and calendar tests without it; mark invitation/verification/recovery delivery blocked separately until controlled inbox access is configured. Never send test messages to real third parties or claim delivery from auto-confirmation.

Return the pushed/recoverable diff, exact tested commit, account/cohort/version references without credentials, R01–R13 evidence, remaining email/human/source-owner decisions, and restoration results. Full product acceptance and production release remain pending until the original commissioning gates are satisfied.

References: https://learn.chatgpt.com/docs/environments/cloud-environments and https://supabase.com/docs/reference/javascript/auth-admin-createuser
