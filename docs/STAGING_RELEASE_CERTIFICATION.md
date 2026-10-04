# BIS staging release certification

This suite is separate from the intercepted browser harness. It runs the real application, signs into Supabase, and reads or mutates only the explicitly recognised BIS Staging project (`lbmhkddrkhtmkcvfmumd`). Its global setup refuses the BIS Production reference (`swmhsqivqaqwovojbceo`) and every other backend. Before entering credentials, each journey also checks the running server's backend identity at `/api/staging-certification/environment`; a staging environment variable cannot disguise a production deployment URL.

## Credentials and invocation

Supply secrets in the process environment; never add them to an env file intended for source control:

```sh
export NEXT_PUBLIC_SUPABASE_URL=https://lbmhkddrkhtmkcvfmumd.supabase.co
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
export BIS_STAGING_LEARNER_EMAIL=...
export BIS_STAGING_LEARNER_PASSWORD=...
export BIS_STAGING_ADMIN_EMAIL=...
export BIS_STAGING_ADMIN_PASSWORD=...
npm run test:staging
```

`BIS_STAGING_BASE_URL` may point at an already deployed staging application. When it is absent, Playwright starts the current checkout on port 3200. The ordinary `npm run verify` remains deterministic and does not consume staging data.

The facilitator intelligence journey additionally requires `BIS_STAGING_FACILITATOR_EMAIL` and `BIS_STAGING_FACILITATOR_PASSWORD` for a prepared facilitator assigned to the synthetic demo cohort. Missing credentials fail before that role signs in. Supply them through the process environment as above.

## Controlled mutation contract

Read-only authentication, role boundary, real catalogue/runtime, Content Studio access, responsive layout, console, HTTP and rating-control checks run by default. Evidence mutation is deliberately fail-closed. Use a dedicated resettable learner, then set:

```sh
export BIS_STAGING_LAB_CODE=HAB
export BIS_STAGING_ALLOW_MUTATIONS=true
export BIS_STAGING_EVIDENCE_FIXTURE='{"labCode":"HAB","investigation":1,"items":[{"semanticFieldId":"<semantic-id>","value":"<controlled evidence>","responseStatus":"ANSWERED"}]}'
```

The fixture must match the currently active source-backed runtime and the learner's current investigation. The test records through the authenticated application API and re-reads after browser refresh. It never uses a service-role key or bypasses RLS.

Full certification of calendar-day evidence, no-opportunity handling, uploads and the publishing lifecycle requires a prepared staging learner, an existing non-production shelf and source approved for staging. Record the IDs and versions in the release report. Do not make a generic test guess at authored semantic fields or publish arbitrary content. Publishing should be performed with the Content Studio UI, with the previous activation recorded first and restored after proof where safe.

## Release evidence checklist

Attach the Playwright HTML report and record: commit SHA; staging project reference; accounts' roles (not credentials); active catalogue row and runtime version; enrolment ID; semantic fields changed; evidence attachment ID/path; denied wrong-user request; Content Studio shelf/version/source checksum; previous and temporary activations; rollback result; viewport results; console/network failures; and every skipped or failed check. A skipped controlled-mutation test is a certification blocker, not a pass.
