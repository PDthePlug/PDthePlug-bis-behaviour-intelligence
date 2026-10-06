# Content Studio update and historical Learning rollback

Status: **verified in staging; application correction in branch; whole hardening pass ongoing**.

Copying a published JSON source into a new version previously retained the old package identity. Actual HAB 1.7 therefore failed preparation with `package version 1.6 does not match 1.7`. The compiler correctly protected publication, but an otherwise unchanged copied update could not be prepared.

The copy operation now verifies the published source hash, changes only the package envelope version and saves a new immutable JSON object under the new version. Authored wording, page/field identities, investigations, calculations and evidence relationships stay intact. Ordinary uploaded JSON retains strict title/version validation. The original private source objects, version rows, policies and publishing gates remain intact. There is no database migration or production data operation in this change.

The dedicated staging operator created a separate 1.8 candidate through the normal API using BIS's next-version calculation. The unrelated 1.5 working update and failed 1.7 QA draft were preserved; their presence means this certification does not claim the default Edit control created the candidate. Actual interface checks cover Process content, six-item final check, approval, explicit Publish, refresh and Restore previous version confirmation.

- `npm run verify`: **638 acceptance / 240 browser tests pass**, including source audit, TypeScript, lint, optimized build and static deployment trace. The final stronger canonical Lab copy regression also passes all five cases; changed certification scripts receive a final lint check.
- All **117 exact-version Learning page states** pass at 360, 430 and 1280. Nine response-entry/refresh checks confirm preview-only answers do not become learner responses. Resume evidence is bound to its version; publication checks the reviewed artifact hashes.
- All **nine actual preview workspace states** pass Next/Previous, keyboard Mobile/Desktop switching, overflow, WCAG and browser-error checks.
- Twelve manually inspected viewport captures cover the Day 3 opening and original response context in all three editions at 360/1280. The 45-minute Learning and separate 90-minute Lab contexts remain distinct. These samples do not certify every paragraph on every page.
- Actual publication activates all three 1.8 editions. Historical rollback restores all three 1.6 editions through their supersession edges. Prior source/artifact hashes, workbook responses and progress match before/after; the successor, prior versions and both retained drafts remain traceable.
- A read-only staging/production inventory finds no production unpublished JSON source with recorded copy provenance or an inherited version path. Existing production drafts remain untouched. The failed 1.7 fixture is retained as explicit staging evidence.

The shared renderer also exposes an additional mobile-table review item: the School Day 3 table scrolls by keyboard, but its visible crop lacks a strong cue and the region's fallback name joins adjacent headers. `VISUAL-SOURCE-TABLES` records the exact route/width and required shared treatment. The original Menu is preserved; `VISUAL-MENU`, whole-page manual certification, remaining authoring/role variants and authenticated production journeys remain open.

Evidence: [copy verification](studio-update-source-copy-verification.json), [117 prepared pages](studio-history-preview-verification.json), [preview workspace](studio-history-workspace-verification.json), [publication and rollback](studio-history-transition-verification.json), [existing-version inventory](studio-source-copy-existing-version-inventory.json), [mobile table access](studio-history-table-scroll-verification.json), and [open findings](open-findings.md).

The reference-page presentation batch is separately released as PR134 after exact-head CI, 42 protected-preview states and nine public production checks. [Release evidence](reference-page-release.json) keeps that result separate from the still-open authenticated and exact-page coverage.
