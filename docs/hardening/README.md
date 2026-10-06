# BIS production readiness register

Status: **ongoing**. This register is a release record for verified corrections and an explicit list of remaining certification work. A successful build or deployment does not close the whole hardening pass.

Baseline: `d8ca307ae455024b5816240d4db08f0dddd6bf73` (#126). Isolated branch: `hardening/production-readiness-20261006`. Application corrections: `b0aee73`, `75bf471`, `9aa717e`, `6835a04`, `e6c3c2e`, `958e2cd`, `f9ff382`, `87e1a65`. No production learner records, source files, content activations or database definitions were replaced with staging data.

## System map

The application is Next.js App Router on Vercel, with Supabase Auth, Postgres RPCs/RLS and private Storage. `db/index.ts` and the request-scoped query adapter use the authenticated Supabase client; staff roles are assigned separately from authentication. The browser never receives a service-role key.

`route-register.json` inventories every page and handler pattern, its source, role, correction, evidence and release status. Dynamic expansions, publication state and workflow limitations are recorded alongside the pattern. It must retain prior review evidence when regenerated with `node scripts/map-hardening-scope.mjs`.

| Experience | Routes and shared presentation | Principal journey |
| --- | --- | --- |
| Account | `/sign-in`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/auth/signout`, `/profile`, `/settings`, `/experience` | Authentication, consent/setup, edition and reading preferences, support and return paths |
| Learn | `/learn`, `/habit`, `/handbooks/[code]`; `/learning` and `/learning/habit` compatibility redirects | Ten facilitated learning touchpoints, authored workbook responses, understanding checks, Day 3 Lab handover and return |
| Lab | `/labs`, `/labs/[code]`; `/habit-lab`, `/habit-lab/experiment`, `/decision`, `/money` compatibility entries | Consent, baseline, nine investigations, calendar-controlled observations, evidence review and completion |
| Evidence | `/portfolio`, evidence-engine and evidence-portfolio APIs | Original evidence, calculation history, explicit sharing/revocation, human review and downloads |
| Staff | `/workspace` and staff/class/evidence APIs | Facilitator class operations, compact roster and learner detail; sponsor aggregate results; operator access, enrolment and assessment governance; restricted safeguarding |
| Publishing | `/content-studio`, preview workspace/runtime and content APIs | Immutable source/version, current compiler, preview, fingerprint-bound final check, approval, explicit publication and retained prior activation |
| Commercial | `/commercial` and commercial API | Role-restricted BIS commercial operations, separate from learner evidence |
| Public demonstration | `/experience/leap9`, `/experience/leap9/v2`, illustrative report | Fixed fictional records, conspicuous simulation labels, no production learner input |
| Verification | `/qa-handbooks`, staging environment identity API | Synthetic preview-only handbook fixture; server backend identity checked before certification credentials are submitted |

Learn's ProgrammePlayer and the canonical Lab frame share `learner-document*` primitives in `app/learner-document-system.css`. The continuous publication canvas, purpose, outcomes, metadata and endpoint hierarchy remain shared. Existing meaningful programme-map cards, authored tables, callouts and response groupings remain intact. Catalogue cards group titles; narrative paragraphs are not turned into cards.

## Roles and privacy

Learners access their own responses, observations, photos and histories. Facilitators receive assigned-group structural progress and explicitly shared evidence; programme progress is not competence or readiness. Sponsors receive authorised aggregates with cohort minimum 5 and cell minimum 3. Programme owners can record their own decisions. Operators manage governed content and access. Safeguarding cases remain restricted and receive human decisions, without automated diagnosis or inferred risk.

The roster changes preserve those boundaries. Facilitators get one compact summary per learner, name/email and progress filters retained in the URL, a single evidence-reading disclosure, and a separate learner detail. Operators get compact native disclosures, keyboard expansion, search/status filters and refresh recovery. The browser regression uses 100 participants; real staging uses 20 synthetic participants.

## Environment and database differences

See `configuration-report.md`, the full platform snapshots and `platform-differences.json`. The read-only inventory covers every non-system schema, table/view, function definition hash and permissions, trigger, constraint, index, RLS policy, extension, schema/role settings and bucket settings. It never reads learner response values, Auth identities, object contents or secret values.

All common definitions matched in the baseline inventory. Production has preserved Agency/Companion additions and two provider-managed Realtime functions. The private-schema anonymous USAGE grant differs; BIS function EXECUTE permissions and RLS remain unchanged. No migration is justified merely to equalise inventories. Actual publishing review exposed an explicit-unpublish fallback defect; the append-only migrations and positive/negative access regressions are described in `migration-review.md`. Both reviewed migrations are now applied to staging and production; the effective definitions/permissions, preserved configuration and production record counts are recorded in `production-migration-verification.json`. Staging data must never be promoted into production.

Preview bindings previously existed only for specific old branches. This pass added global preview URL/public-key bindings to BIS Staging and an explicit production acknowledgement of `false`. Production bindings were preserved. `vercel-bindings.json` records names/scopes/types without key values. Production backend identity was read live and returned `swmhsqivqaqwovojbceo` with staging certification disabled.

Staging was running static core Lab activations, whereas production used governed Universal packages. Dedicated fresh staging versions from checksum-verified canonical Volume 1 were prepared without replacing any existing version. HAB 4.5.4, MON 4.2.2 and RSK 1.0 passed preparation review and were published in staging. DEC 4.2.3 and IDN 1.0 retain their repetition-review warnings and remain unpublished candidates. Production content was not recompiled or republished.

All four deployed temporary Edge endpoints were inspected. Their current implementations return 410 and have JWT verification enabled. The short-lived staging account provisioner was closed immediately after the 24 dedicated test accounts were created; no provisioning capability remains.

## Evidence and reporting chain

`reporting-measures.md` maps programme measures to source, calculation and practical meaning. `metric-register.json` is generated from checksum-verified canonical sources through the real shared compiler: 32 source Labs, 283 calculated fields and 320 indicator bindings, with no unbound indicators. CAR and FAI are catalogued shelves without canonical Lab packages. This source register does not claim that every shelf is published or live-certified.

The register gives named input fields, calculation operations, interpretation boundaries and practical use. The actual calculation code is `lib/universal-lab-v2.mjs`; versioned sources and histories are persisted transactionally through `bis_save_universal_responses` and `bis_save_universal_measurements`. `lib/learner-evidence.ts` and `lib/evidence-portfolio.mjs` retain enrolment/version provenance and source verification. Original responses and retained calculations remain separate.

Legacy Habit adherence is alternative uses divided by eligible opportunities, only with valid observations. Prediction accuracy is `max(0, 100 - abs(prediction - adherence))`; zero opportunities or invalid evidence leaves it unavailable. These formulas are not inherited by Universal Labs. Universal calculations use only named source fields. A passed question, a no-opportunity observation and a missing day remain distinct; coverage is not improvement.

Programme reporting uses authorised SQL aggregates, `buildProgrammeReport`, accessible chart data and the PDF renderer. Participation counts are milestone counts rather than a verified nested funnel. Understanding checks and paired ratings are self-report. Saved rubric reviews are human assessments of chosen shared tasks. Structured question patterns exclude private narrative. Missing and suppressed values remain unavailable. Discussion prompts do not establish cause, certify lasting capability or prescribe programme redesign. Programme decisions remain the team's explicitly saved records.

## Verification and release boundary

The current product iteration is documented in `product-experience-20261006.md`. `learning-page-register.json` expands the dynamic Learn routes into all 195 accepted page/edition variants, with separate manual-review and release status. `handbook-response-integrity.json` compares all 5,957 rendered controls against the original accepted renderer and verifies unchanged source packages. `calculation-context-register.json` retains the source-derived explanations used by the shared Lab presentation for all 283 canonical calculations. The corresponding audit scripts make both checks repeatable; `scripts/map-hardening-learning-pages.mjs` preserves page reviews when the source inventory is regenerated. Shared presentation corrections do not close pending editorial reading or role/state reviews.

The accepted release contract is `npm run verify`: runtime, lint, TypeScript, acceptance tests, canonical-source audit, optimised build and browser journeys at 360, 430 and 1280 pixels. Browser fixtures exercise the real shared components and interaction contracts; they are distinct from authenticated staging evidence.

Authenticated staging certification uses dedicated synthetic accounts and normal application APIs/RLS. The controlled calendar runs only for those fixture emails, on the exact staging backend and a local development server. It cannot affect production builds or ordinary users. Credentials are held in a private temporary file and are excluded from the repository and reports.

The evidence register records geometry, input names, automated WCAG checks and browser failures separately. A screenshot or an automated accessibility pass does not establish that every state has been manually reviewed. Expected role denial and preview-only 404 responses must be distinguished from unexpected failure.

Remaining release/certification work is tracked in `open-findings.md` and each route's outstanding fields. The whole pass must remain open until those entries are resolved with evidence. The PR, CI result, preview inspection, production deployment and live verification will be recorded in `release-record.md`.

The current product follow-up is recorded in `opportunity-coverage-20261006.md`: staff counts distinguish unavailable data from recorded zeroes. The exact Identity Day 10 full-page inspection is in `document-review-idn-day10-20261006.json`; `profile-structure-register.json` identifies six affected Identity/Attention source variants. Their binding/list/reference-status findings remain open. PR #130 product corrections are released; full certification remains ongoing.
