# Development report certification

Status: **Draft follow-up; not release certified.** Review: https://github.com/PDthePlug/PDthePlug-bis-behaviour-intelligence/pull/161. Base: `f1f6b3a76771b45d600b066ce2ac92cf0e6932a4` (merged PR #159).

## Result

The facilitator map now includes context records explicitly, hides the previous learner's evidence immediately on a learner/cohort change, and ignores aborted responses. Missing opportunity counts remain unavailable. Evidence tables keep their local horizontal scrolling and screen-reader labels inside the table boundary at narrow widths. Participant headers stack on small screens.

Programme overview findings appear once; detailed operational context and evidence flow belong in the evidence section. The institutional PDF shares the same section grouping, prints each finding once with its graphics and interpretation limits, and keeps saved programme decisions separate. Report and development model versions advance to 2. Repeat-response partitions are withheld in full when a cell is small, missing or inconsistent with the denominator.

No learner response values, private text, highly personal evidence or production records are read for this follow-up. No curriculum publication, database migration or production write is included.

## Verification

- Restored implementation: 712 acceptance tests passed, 0 failed.
- Lint, TypeScript, canonical source audits, optimized production build and all 15 retained learning-package runtime checks passed using non-production harness configuration.
- Final focused reporting/evidence/calculation/PDF contracts: 26 passed, including PDF glyph geometry, Unicode, suppression and one-print-per-finding checks.
- A seven-page fictional specimen was rendered and visually inspected. Section headings stay with their first findings and review/methodology share a page. This specimen is QA evidence, not measured programme results.
- The full `npm run verify` completed its browser run: 325 passed, 12 failed, two existing viewport-conditional skips. All 57 focused reporting cases passed across 360px, 430px and 1280px. Nine failures reproduce on unchanged main; three staff-menu assertions expected the old overview evidence-flow heading. The final focused rerun passed all 60 cases, including the corrected staff-menu contract, at all three screen sizes.
- Browser fixtures mock authenticated API responses. These checks do not certify the live database/RLS path.
- Isolated harness cache directories prevent an unrelated development-server lock from invalidating a browser run. No test is skipped and no timeout is increased.

## Remaining gates

`npm run verify` has run; its repository-wide browser gate remains red. A green combined-head run is required before release. A controlled baseline run on unchanged main (`f1f6b3a`) reproduced nine failures: library publication placeholders, profile focus/opaque chrome and reader-menu opaque chrome, each at three screen sizes. The staff-menu baseline passed at all three sizes. The staff-menu expectation now checks the findings overview while confirming the detailed evidence-flow heading is hidden there; its navigation, history, dialog and keyboard assertions are preserved. No baseline assertion was bypassed. This follow-up is not a production-readiness certification.

Authenticated API-to-database checks remain blocked. BIS Staging is inactive and the connected Free organisation has two active projects (BIS Production and ThePlugOS). Restoring staging was rejected because the two-active-project quota is full. No active application was paused and no billing change was made. Staging capacity requires an explicit operator decision; production must not be substituted as the test backend.

The manuscript inventory covers ten supplied Lab titles, 30 sections and 29 unique Lab/edition pairs. Its 300 baseline occurrences have reviewed curriculum associations. Activity headings and candidate question lines remain provisional; edition-specific live field binding, authored assessment criteria and sustained-transfer capture are still required. These reporting fixes do not validate all 34 Labs or authorise automatic capability claims.

Main advanced to `cce44f24ce24301f4774689f14bbe3a28ab3e2e2` during verification, adding six partner prospect entry points and PDF routes. GitHub reports this follow-up mergeable; the base comparison changes no reporting files. Combined-head release verification remains a separate gate.

## Implementation continuation

See `BIS_MEASUREMENT_IMPLEMENTATION.md` for comparison coverage, Content Studio readiness review, API payload withholding and the append-only consent/scope migration. The nine presentation failures were traced to tests predating Pride's explicit PR #152 reversion; the actual floating Menu and numbered cards remain unchanged. The corrected checks and new measurement UI passed 15 focused browser cases. Local SQL tests cover all four reporting families and current consent eligibility. The complete regression run is in progress. No migration has been applied to a live database.
