# Account-free BIS exploration and DGMT first view

DGMT first view: `/experience/dgmt`. Role explorer: `/explore`, also linked prominently from `/sign-in`. Fixed fictional PDF: `/experience/dgmt/report`.

## Experience

The DGMT walkthrough adapts Leap9 v2 for practical competencies and pathways to productivity. A 90-second captioned video, matching transcript and immediate journey/role actions remove the account requirement. Fictional participant practice remains distinct from the fixed cohort of twenty. It does not imply an agreed DGMT partnership or proven impact.

The explorer uses the actual ProgrammePlayer, UniversalRuntimeLab, Evidence Portfolio, FacilitatorWorkspace and ProgrammeOutcomesView. Visitors choose learner, facilitator or programme owner and can write handbook responses, complete the nine Lab stages, move between example experiment days, selectively share evidence, record feedback, plan class touchpoints and attendance, record support notes, inspect aggregate findings, download reports and record/review programme decisions. Role switches and refresh retain practice in the current tab; restart clears it.

The customer language pass replaces publishing/version terminology with programme intent and results. Desktop actions appear beside the short video; learning retains a continuous workbook with its programme map above it. Supporting detail remains expandable. Existing authored questions, ten facilitated touchpoints, nine Lab stages and evidence limits are preserved.

## Isolation and data boundaries

A React context supplies a closed example request/navigation adapter only under `/explore`. Signed-in screens keep their normal requests and navigation. The adapter has no network fallback, never assigns account roles, and rejects unsupported/cross-role requests. The proxy bypass is an exact route list; protected APIs and similarly named paths retain authentication.

The example Lab uses the canonical submission validator, presentation normalization and computation functions. Its content is generated from the authored Volume 1 Habit source and retained emerging-adult handbook by `node scripts/prepare-exploration-content.mjs`; no test fixtures are used as programme content.

Practice stores bounded actions with original timestamps under `bis.explore.example.v1`. Restoration validates/replays actions into a fresh fictional session. Learner responses remain private until selected for sharing; highly personal records cannot be shared. Editing shared evidence withdraws its existing submission from the facilitator queue. Programme findings remain fixed and never include practice wording or participant names.

Photo uploads, safeguarding referrals and scored assessments require a signed-in programme and are explained in the expandable experience note. These actions are not simulated as live operations. This change adds no database migration, production QA data or relaxed API access.

## Reproduction and validation

With the browser harness running on port 3100, `node scripts/create-dgmt-demonstration.mjs` regenerates the five-view MP4, poster and English captions. The video does not autoplay or preload; it is text-led without narration.

Browser coverage includes 360px, 430px and 1280px journeys, plus 1440px/1920px desktop review. Checks cover sign-in discovery, keyboard navigation, authored workbook saves, the complete Lab, example days, selective sharing and review, class planning/attendance, programme decisions, Back/refresh/reset, downloads, copy, overflow, console errors and absence of authenticated API requests. Unit tests cover canonical source origin, exact public routes, request rejection, Lab validation, persistence and fixed report separation.

Release scope and optimized-app evidence are recorded in `docs/hardening/dgmt-experience-verification.json`. PR #149 checks and its browser artifact provide the final full verification result. Earlier DGMT-only evidence is retained in `docs/hardening/dgmt-experience-initial-verification.json`.
