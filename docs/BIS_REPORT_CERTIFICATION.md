# Development report certification

Status: **Draft follow-up; not release certified.** Base: `f1f6b3a76771b45d600b066ce2ac92cf0e6932a4` (merged PR #159).

## Result

The facilitator map now includes context records explicitly, hides the previous learner's evidence immediately on a learner/cohort change, and ignores aborted responses. Missing opportunity counts remain unavailable. Evidence tables keep their local horizontal scrolling and screen-reader labels inside the table boundary at narrow widths. Participant headers stack on small screens.

Programme overview findings appear once; detailed operational context and evidence flow belong in the evidence section. The institutional PDF shares the same section grouping, prints each finding once with its graphics and interpretation limits, and keeps saved programme decisions separate. Report and development model versions advance to 2. Repeat-response partitions are withheld in full when a cell is small, missing or inconsistent with the denominator.

No learner response values, private text, highly personal evidence or production records are read for this follow-up. No curriculum publication, database migration or production write is included.

## Verification

- Restored implementation: 712 acceptance tests passed, 0 failed.
- Lint, TypeScript, canonical source audits, optimized production build and all 15 retained learning-package runtime checks passed using non-production harness configuration.
- Focused evidence/calculation/PDF tests: 15 passed, including PDF glyph geometry, Unicode, suppression and one-print-per-finding checks.
- Responsive reporting suite exercises 57 cases across 360px, 430px and 1280px. The initial restored run returned success; the complete repository verification is being rerun before a release claim.
- Browser fixtures mock authenticated API responses. These checks do not certify the live database/RLS path.
- Isolated harness cache directories prevent an unrelated development-server lock from invalidating a browser run. No test is skipped and no timeout is increased.

## Remaining gates

`npm run verify` must complete against this follow-up. Earlier wider-suite runs exposed library placeholder, profile chrome/focus, reader menu and staff-menu failures; those must be assessed against unchanged main rather than bypassed. This follow-up is not a production-readiness certification.

Authenticated API-to-database checks remain blocked. BIS Staging is inactive and the connected Free organisation has two active projects (BIS Production and ThePlugOS). Restoring staging was rejected because the two-active-project quota is full. No active application was paused and no billing change was made. Staging capacity requires an explicit operator decision; production must not be substituted as the test backend.

The manuscript inventory covers ten supplied Lab titles, 30 sections and 29 unique Lab/edition pairs. Its 300 baseline occurrences have reviewed curriculum associations. Activity headings and candidate question lines remain provisional; edition-specific live field binding, authored assessment criteria and sustained-transfer capture are still required. These reporting fixes do not validate all 34 Labs or authorise automatic capability claims.
