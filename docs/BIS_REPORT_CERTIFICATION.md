# BIS measurement implementation and certification

Status: **Implemented in draft PR #161; not deployed or live release certified.** Review: https://github.com/PDthePlug/PDthePlug-bis-behaviour-intelligence/pull/161. Verification includes main `cce44f24ce24301f4774689f14bbe3a28ab3e2e2` and the reporting continuation from merged PR #159.

## Result

Programme results and PDF now show matched pairs, participants without a comparable pair, the programme population and the reporting state beside comparable self-report findings. Small paired or complementary cells withhold the whole comparison, including means and changes, before API serialization. Missing values, zero pairs and privacy withholding remain distinct. The overview contains each finding once; learning detail links to that comparison instead of repeating a growth panel. Report model version is `bis-programme-report:3`.

Content Studio now reviews source calculation graphs and distinguishes numerical calculations, reused fields and unresolved rate bindings. A read-only audit of 32 candidates from the three canonical source volumes found valid graphs but 32 rate labels requiring authored numerator, denominator and formula bindings. This is not an audit of activated live versions or proof of equivalence with the newer supplied manuscript. No measure or denominator was invented and no curriculum was automatically published.

The append-only migration aligns four protected reporting families with active membership, active learners, current granted consent, matching Lab versions and non-withdrawn enrolment. Local SQL tests exercise consent changes, inactive and withdrawn states, wrong viewers/roles/scopes, anonymous access, private helper permissions and small complementary cells. The API also withholds aggregate payloads when outcome and evidence-flow populations disagree. The migration has not been applied to a hosted database.

The facilitator map preserves approved structural evidence and context, immediately hides the previous learner's evidence on a switch and ignores aborted responses. It does not infer capability from submitted work or expose private response values. The PDF shares the report model, keeps findings with their graphics and separates saved programme decisions.

## Verification

- 726 acceptance tests passed, 0 failed. This includes six local SQL access/calculation cases covering all four reporting families and the new measurement/comparison contracts.
- Lint, TypeScript, canonical source audits, optimized production build and all 15 retained learning-package runtime checks passed with non-production harness configuration.
- Five PDF contracts passed, covering suppression, Unicode, glyph geometry, all canonical insights, repeated illustrative labels and one print per finding. An eight-page fictional specimen was rendered and visually inspected, including the coverage table and methodology. It contains no real learner results.
- New Content Studio and comparison interfaces, and corrected accepted Menu/library contracts, passed 15 focused browser cases across 360px, 430px and 1280px. The earlier reporting-focused continuation passed 60 cases.
- Two broad browser runs each ended with 342 passes, one failure and two existing viewport-conditional skips. The first failed at an unchanged example Lab's baseline-to-Investigation-1 transition; that entire journey passed twice on isolated repetition and passed in the second broad run. The second found 20px of real overflow in the Commercial Intelligence header at 360px. Wrapping the action buttons corrected it; all 24 Commercial Intelligence cases then passed.
- The final combined-head `npm run verify` completed successfully: 726 acceptance tests, 343 browser passes, zero failures and two existing viewport-conditional skips across 360px, 430px and 1280px. The browser run took 15.4 minutes.
- No assertions were skipped, weakened or given inflated timeouts to obtain a pass. PR #152 records the owner's explicit request for the floating Menu and numbered cards; obsolete assertions were updated to that accepted contract while preserving availability, focus, keyboard, contrast and reachability checks.
- Browser fixtures mock authenticated API responses. Local SQL tests do not certify hosted Supabase authentication, RLS or the live API-to-database path.

## Release and publication gates

Authenticated staging verification remains blocked. On 13 October, BIS Staging was still INACTIVE; BIS Production and ThePlugOS were ACTIVE_HEALTHY. The prior restore attempt was rejected because the Free organisation's two active-project slots were occupied. No active application was paused, no billing was changed, and production was not used as a QA backend. Capacity requires an explicit operator decision before an isolated hosted migration and authenticated flow check can run.

The newer manuscript inventory covers ten supplied Lab titles, 30 sections and 29 unique Lab/edition pairs. All 300 baseline occurrences have reviewed curriculum relevance associations, which are not validated scales. Activity-level mapping, edition-specific runtime binding, authored assessment criteria, equivalent comparison scales and sustained-transfer capture remain source governance work. The 34-title catalogue, 32 canonical source candidates and supplied manuscript sample are different scopes.

Facility-wide pooling additionally requires an explicit facility/organisation boundary and participant deduplication. Cohort aggregates must not be added as if they were unique facility participants. No claim of causal impact, acquired capability or lasting transfer is authorised by these reporting changes.

See `BIS_MEASUREMENT_IMPLEMENTATION.md`, `BIS_SOURCE_MEASUREMENT_READINESS.md` and the historical source findings in `BIS_DEVELOPMENT_REPORTING_AUDIT.md`.
