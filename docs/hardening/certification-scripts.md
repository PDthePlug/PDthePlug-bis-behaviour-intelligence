# Repeatable certification tooling

All commands run from the repository using the installed dependencies. Configuration inventory SQL reads metadata only. `audit-auth-configuration.py` requires the cloud-bound `SUPABASE_ACCESS_TOKEN`, calls the documented management Auth endpoint and writes only redacted settings/differences. It performs no configuration mutation.

`map-hardening-scope.mjs` inventories page/handler patterns while retaining existing review evidence. `map-hardening-metrics.mjs` compiles checksum-verified canonical sources into the metric register. Neither claims that an unpublished package is live.

Authenticated scripts require `BIS_HARDENING_CREDENTIAL_FILE` pointing to the private staging fixture file. `hardening-staging-session.mjs` validates the exact staging Supabase URL and application backend identity before submitting credentials. Mutations additionally require `BIS_STAGING_ALLOW_MUTATIONS=true`. Set `NODE_USE_ENV_PROXY=1` when the managed runtime requires its outbound proxy. Protected Vercel preview inspection optionally uses `BIS_HARDENING_PREVIEW_ACCESS_FILE`, a private temporary share-link record restricted to the exact recorded preview origin; normal deployment protection remains enabled. Revoke the share link when inspection ends. Credentials, cookies, source payloads and screenshots remain in private temporary storage; none belongs in Git.

The preparation and publication scripts are one-time lifecycle exercises. Inspect their state assertions before running; rerunning preparation intentionally creates additional immutable versions. Never substitute production URLs or accounts. `prepare-hardening-staging.mjs` and `prepare-hardening-learning.mjs` upload immutable sources through owner Storage and normal Content Studio APIs, then verify compiled artifacts. They do not overwrite prior versions.

The browser inspectors use the installed Chromium and a pinned axe-core 4.11 script, at 360, 430 and 1280 pixels. Page matrices and audit output paths can be overridden with `BIS_HARDENING_PAGE_MATRIX_FILE` and `BIS_HARDENING_PAGE_AUDIT_FILE`. A metadata pass does not substitute for manual review. Inspectors report expected role/availability denials separately from defects.

The journey scripts exercise normal learning saves/checks/preferences, Lab responses/measurements, owner photo access/removal and cross-user denial, explicit evidence sharing/revocation, facilitator review and sponsor PDF/CSV output. The calendar script launches its own local server and scopes simulated dates to the dedicated fixture emails on the staging backend; its server is removed afterward. No production build accepts the local calendar fixture.

Authoritative application verification remains `npm run verify`. Do not rerun destructive provider operations, promote synthetic outcomes or mark the full pass complete from a subset of these scripts.
