# Staff opportunity-count review

The broader hardening pass remains open. This follow-up addresses an evidence interpretation defect discovered during the actual facilitator visual review after the shared learning improvements.

| Route / role | Problem | Correction | Verification | Release |
| --- | --- | --- | --- | --- |
| `/workspace?view=facilitator&group=…` / assigned facilitator | The synthetic Universal group displayed four zero opportunity bands although no participant had a compatible opportunity count. This concealed missing evidence and the measured population. | One compact unavailable statement replaces the bands when counts are unavailable. Available groups state the contributing learner denominator. The zero band reads “0 recorded”; source and interpretation detail is collapsible. | `tests/browser/opportunity-coverage.spec.ts`; `scripts/inspect-hardening-opportunity-coverage.mjs`; `opportunity-coverage-verification.json`: 20-person actual staging group at 360/430/1280; no available counts, no fabricated zeroes, refresh/axe/errors/overflow pass. | IN BRANCH |
| `/workspace?view=admin&section=overview` / system administrator | The same empty bands appeared in the operator overview; “No opportunity” and the explanation claimed real situations rather than records. | The same shared summary reads only authorised progress rows and keeps missing counts separate from recorded zeroes. | 24 focused browser cases pass for both roles and all three widths. Actual staging operator overview includes 40 authorised learners; unavailable state, refresh, axe, errors and overflow pass. | IN BRANCH |

The source is each supplied learner's `experiment.opportunityCount` from the existing role-scoped `/api/staff` snapshot. Only nonnegative integer counts are available; unavailable counts are excluded. Each band counts learners with 0, 1, 2 or at least 3 recorded opportunities. The denominator counts learners in this role's supplied population, not search-filter matches or answer fields. No Universal count is guessed from an experiment start or another answer.

A zero count is a recorded value. It does not prove that no matching situation happened. The records describe coverage and do not establish evidence quality, improvement or causation. The summary offers staff a basis for a human check-in without displaying private reflections or suggesting a programme redesign.

The implementation changes presentation only. The existing API metrics, authored Lab calculations, semantic fields, evidence histories, role scopes, Menu and production data remain unchanged. The component uses the existing `EvidenceDisclosure` visual/keyboard primitive; new publications require no page-specific repair for this staff summary.

Full `npm run verify` passed on application commit `706985bb5d034d9f7d74980a379e99e96b59975c`: 633 acceptance tests, 210 browser tests, lint, TypeScript, canonical-source audit, optimized build and 15 retained source traces. Six actual staging role/width states and 24 focused coverage cases pass. New inspection/source-inventory scripts also pass ESLint. CI/preview release checks remain separate from the complete hardening certification.
