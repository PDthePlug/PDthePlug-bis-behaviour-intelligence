# Leap9 × BIS Programme Experience

Public route: `/experience/leap9`. PDF: `/experience/leap9/report`.

This is a shortened, fictional programme experience inside the canonical BIS app. It follows Naledi Mokoena through learning, Habit mapping, a small Behaviour Contract example, daily observations, evidence review, consent-controlled facilitator review, a participant evidence profile and aggregate programme outcomes. It preserves the ten facilitated learning touchpoints and distinguishes the separate 90-minute Lab from the 45-minute guided learning sessions and seven-day independent experiment.

## Source and architecture

The story and habit-loop excerpt in `lib/experience/leap9-learning.json` are exact paragraph extracts from the current Volume 1 workbook. Its SHA-256 matches the existing canonical `content/sources/volume-1.docx`; no source was replaced. The other supplied volumes are the broader catalogue context, not a claim that every Lab is demonstrated here.

The experience uses the existing session-design contracts, canonical Habit metrics, and programme PDF engine. The simulation model is separate from production enrolments, answers and evidence. It makes no Supabase calls and writes no production records. Only the exact public experience and report routes bypass session refresh; all other routes keep their current authentication/role enforcement.

Practice state is versioned and bounded in sessionStorage, scoped to the browser tab. Refresh and browser Back preserve the journey. Storage denial permits continued use with clear feedback. Reset requires an explicit in-page choice. Fictional evidence sharing is off by default, and changing the evidence invalidates its illustrative review. Neither a real attestation nor a credential is issued.

The aggregate report is a fixed 20-person illustrative cohort, independent of visitor responses. It contains no participant names or private reflections. A simulation disclaimer is printed on every PDF page through an opt-in flag; ordinary programme reports retain their existing behaviour. Figures include incomplete participation and mixed behavioural directions. They must not be presented as real Leap9 results or proof of causation.

## Verification

Unit coverage: deterministic adherence; no-opportunity denominator; negative movement; malformed/version-mismatched storage; bounded restore; privacy defaults; aggregate reconciliation.

Browser coverage at 360px, 430px and 1280px: participant-to-outcomes journey, refresh, browser Back, consent off/on, support acknowledgement, illustrative review, profile linkage, report download, report page labels, restart, denied storage and invalidated review. Screenshots capture welcome, evidence review and outcomes. Full repository release verification is required before merge.

## Release checkpoint — 5 October 2026

Canonical repository: `PDthePlug/PDthePlug-bis-behaviour-intelligence`. Branch: `implementation/leap9-programme-experience`. Rebased onto main `fc2db7b`, including the latest shared Learn/Lab document presentation and learner-access changes. Code revision verified: `47fc998`.

`npm run verify` completed successfully: runtime check, lint, TypeScript, 570 acceptance tests, canonical-source audit, production build, and 81 browser checks across 360px, 430px and 1280px. The browser harness now matches the public production route by omitting the learner shell for this experience. No snapshots, assertions, retries or timeouts were weakened.

The resumed workspace lacked the normal Playwright browser. Verification used an isolated serverless Chromium executable through the existing `PLAYWRIGHT_CHROMIUM_EXECUTABLE` configuration; no application dependency or committed launch configuration changed. All seven report pages were visually inspected with system Poppler. The bundled PDF renderer showed a font-substitution discrepancy; the system renderer displayed the standard PDF fonts correctly.

The attached Volume 1 workbook and canonical source have identical SHA-256 hashes, and every story/model body paragraph was independently checked against the authored document.

Publication status: **locally verified; not published**. Automatic approval review rejected the branch push as a repository-source upload without explicit destination approval. No bypass or alternate upload was attempted. Remote CI, merge, production deployment and public-route verification remain outstanding. After publication, verify both `/experience/leap9` and `/experience/leap9/report` on `www.bisportal.online`, including direct entry and the connected mobile/desktop journey. Rollback is a normal revert of the feature merge; this release has no database migrations or production data writes.

No production database migration or seeded-data deletion is part of this release. The existing production cohort is not modified. This experience is ready for discussion once the intended revision is deployed and its public routes are verified. Email delivery is a separate action requiring user instruction.
