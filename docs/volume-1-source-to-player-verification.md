# Volume 1 source-to-player verification

**Status: BLOCKED — source identity and catalogue coverage do not match.**  
**Reviewed branch:** `feature/universal-lab-content-studio-20261003`  
**Review date:** 2026-10-11

## Gate objective

Compare the supplied Volume 1 manuscript edition by edition and section by section with the current player payload. Confirm content completeness and sequence before judging whether presentation changes improve readability without changing meaning. This report records the initial source-identity and coverage checks; it does **not** certify full text equivalence or production rendering.

## Sources and identity evidence

Three distinct source identities are currently visible:

| Source reference | Identity evidence | Finding |
|---|---|---|
| Supplied `Volume 1 Bis handbooks.docx` | SHA-256 `1bfd88d11bf90ebbe3b7f40321740904e8a8065d3e5294978ffd8a2cbb2b356e` | Raw manuscript inspected locally; 134,047 Word paragraphs and 208 tables in the document body. |
| `content/sources/manifest.json` | Volume 1 records SHA-256 `4b730fc18fb607e5504a22e6712c2f32a747648ef14d37b5798fa3af85f08e30`, uploaded name `01-BIS-Volume-1-Learner-s-Workbook-v3.0.docx` | Does not match the supplied DOCX checksum. |
| `public/handbooks/v1/manifest.json` | Source `BIS_Volume1_learning_Handbooks_1-5_v13(1).html`, SHA-256 `a3a1f0b832ec066a8d80b103e17e502dd0d524437dd37e5114c54404186e2977` | Player packages declare a different HTML source, not the supplied DOCX. |

These hashes are not interchangeable. Do not treat the current player payload as a verified rendering of the supplied DOCX until the authoritative source and intended scope are explicitly aligned.

## Manuscript coverage inventory

The supplied DOCX contains 30 edition starts across these 10 named handbook families:

- Habit — School, Emerging Adult, Workplace
- Decision — School, Emerging Adult, Workplace
- Money — School, Emerging Adult, Workplace
- Attention — School, Emerging Adult, Workplace
- Time — School, Emerging Adult, Workplace
- Risk — School, Emerging Adult, Workplace
- Resilience — School, Emerging Adult, Workplace
- Purpose — School, Emerging Adult, Workplace
- Influence — School, Emerging Adult, Workplace
- Leadership — School, Emerging Adult, Workplace

The manuscript sequence/labels need editorial review before import: its handbook numbering skips at least 4 and 8; several families appear out of numerical order; and the purported Time Workplace opening is preceded by the text `"What would this actually cost me if it went wrong?"` on the same paragraph as `TIME LAB™`. Preserve this as source evidence and flag it for author resolution; do not silently repair or reorder it during migration.

## Current player catalogue coverage

The current `public/handbooks/v1/manifest.json` declares 15 packages, each with 13 pages:

| Topic | School | Emerging Adult | Workplace |
|---|---:|---:|---:|
| Habit | Present | Present | Present |
| Decision | Present | Present | Present |
| Money | Present | Present | Present |
| Identity | Present | Present | Present |
| Attention | Present | Present | Present |
| Time | Missing | Missing | Missing |
| Risk | Missing | Missing | Missing |
| Resilience | Missing | Missing | Missing |
| Purpose | Missing | Missing | Missing |
| Influence | Missing | Missing | Missing |
| Leadership | Missing | Missing | Missing |

This is a **catalogue coverage mismatch**, not evidence that any missing material should be invented. The supplied manuscript contains no separately titled Identity Lab family in the edition-start inventory; Identity-related measures within other handbooks do not establish equivalence to a distinct Identity handbook.

## Section-order contract to test

The current importer defines the 13-position order as:

1. Welcome
2. Day 1
3. Day 2
4. Day 3
5. Day 4
6. Day 5
7. Weekend
8. Day 6
9. Day 7
10. Day 8
11. Day 9
12. Day 10
13. Certificate

This order is the player's importer contract. It must be checked against each authoritative edition, including tables, instructions, prompts, assessment instruments, examples, privacy/confidentiality material, and certificate/end matter. A page count of 13 is not proof that all source content is present.

## Gate result

**FAIL / BLOCKED.** The current evidence is sufficient to establish a source-identity mismatch and substantial catalogue coverage mismatch. It is not sufficient to certify section-by-section text completeness, exact order, semantic preservation, or all-page visual quality.

## Required next actions

1. Confirm which Volume 1 source is authoritative for the player: the supplied DOCX, the DOCX recorded in `content/sources/manifest.json`, or the HTML named in the player manifest. If the supplied DOCX is authoritative, update the source inventory only after byte-level identity has been verified.
2. Resolve the manuscript's numbering/order anomalies and the malformed Time Workplace heading with the content owner; retain an audit trail and do not silently change the source.
3. Build a 30-edition mapping (or an explicitly approved narrower scope) from source edition to player package. Resolve the 10-versus-5 family mismatch and the Identity-versus-Time/Risk/etc. mismatch before publication.
4. For every in-scope edition, compare extracted source blocks with the compiled player payload in order. Report missing, duplicated, reordered, and materially changed text separately from intentional presentation transformations.
5. Inspect representative and edge-case rendered sections at mobile and desktop widths, including long text, tables, prompts, scoring instruments, accessibility/keyboard flow, and the original-file link.
6. Pass only when content checks are complete and every presentation difference is documented as meaning-preserving. Keep the original source binary unchanged.


## Edition-to-player mapping pass — 2026-10-11

This pass mapped the editions that can be matched by both topic and audience label. This is a **candidate mapping**, not proof of text equivalence.

| Source handbook family | School source → player package | Emerging Adult source → player package | Workplace source → player package | Mapping status |
|---|---|---|---|---|
| Habit (HAB-LM-1.0-S / EA / WK) | `HAB / school`, v1.4 | `HAB / emerging_adult`, v1.4 | `HAB / workplace`, v1.4 | Candidate match; text-level diff pending |
| Decision (DEC-LM-1.0-S / EA / WK) | `DEC / school`, v1.7 | `DEC / emerging_adult`, v1.7 | `DEC / workplace`, v1.7 | Candidate match; text-level diff pending |
| Money (MON-LM-1.0-S / EA / WK) | `MON / school`, v1.2 | `MON / emerging_adult`, v1.2 | `MON / workplace`, v1.2 | Candidate match; text-level diff pending |
| Attention (ATT-LM-1.0-S / EA / WK) | `ATT / school`, v1.0 | `ATT / emerging_adult`, v1.0 | `ATT / workplace`, v1.0 | Candidate match; text-level diff pending |
| Identity | No matching Identity family found in the supplied manuscript edition-start inventory | No matching source edition | No matching source edition | Unmatched player content; source provenance required |
| Time, Risk, Resilience, Purpose, Influence, Leadership | No current package for these families | No current package | No current package | Source editions have no current rendered counterpart |

**Mapped candidates: 12 of the 30 source editions.** The remaining 18 source editions across six families do not have corresponding packages in the current 15-package player manifest. The three Identity packages have no matching source edition in this supplied manuscript. Do not infer that Identity is equivalent to another family.

### Section-structure comparison

The supplied source editions visibly contain distinct authored sections such as Welcome, How to Use This Book, Your 10-Day Map, Before You Begin, Day 1 through Day 10, split Day 3 parts, Weekend, certificate, and reminder/confidentiality material. Some editions include audience-specific confidentiality text and variations in the daily section labels. The player importer tests require 13 pages with a stable shell sequence from Welcome to Certificate. Therefore, comparing only page count or top-level page labels is insufficient: split day parts, map content, reminders, and within-page authored order must be compared inside the page HTML.

**Not yet verified:** missing/duplicated/reordered/materially changed passage counts for the 12 candidate mappings. The player payloads are stored as base64-encoded gzip JSON. The repository exposes the payloads and an importer test that validates package integrity, page count, unique field IDs, and selected Habit handoff markers, but those checks are not a source-to-DOCX textual equivalence test. The supplied raw DOCX is not yet present in the repository at `content/sources/handbooks/volume-1.docx`, and the player manifest identifies a separate HTML source hash. As a result, this pass cannot honestly report a complete line/block diff.

## Desktop and mobile presentation review

### Static implementation review

The player styles define responsive breakpoints at 900px and 700px (plus a 620px handoff adjustment). The shared handbook presentation stylesheet includes:
- readable document typography (16px body text, 1.75 line height);
- responsive heading sizes and scroll offsets for the fixed header;
- mobile document padding and table-cell padding changes at 700px;
- scroll wrappers / minimum-width handling for wide response tables;
- visible focus outlines for inputs, textareas, selects, summaries, and table scrollers;
- larger minimum input heights and responsive stacking for selected content structures.

These are positive implementation signals, but CSS inspection alone cannot establish that actual content renders without clipping, horizontal overflow, awkward page breaks, missing sections, or broken interaction at real viewport sizes.

### Browser visual checks

**Not run / not passed.** The available browser screenshot/DOM audit path was unavailable in this session, and the authenticated handbook route cannot be certified from static repository files alone. No claim is made that live desktop or mobile screenshots have been inspected. The preview-only QA route in `app/qa-handbooks/page.tsx` is explicitly gated to Vercel preview and does not run in production.

## Current gate decision

**FAIL / BLOCKED — no source-to-player equivalence sign-off.**

Completed in this pass:
- enumerated 30 source edition starts across 10 handbook families;
- mapped 12 topic/audience candidates to current package IDs and versions;
- identified 18 source editions without player packages and 3 Identity packages without a matching source edition in this manuscript;
- reviewed responsive stylesheet rules and the existing importer integrity test contract.

Still required:
1. place the exact source binary in the repository and reconcile it with the source hash currently referenced by the player manifest;
2. run a deterministic text/block diff for each of the 12 candidate mappings, with source block IDs/locations and player page/field IDs;
3. report exact missing, duplicate, reordered, and materially changed passages separately, including audience-specific variants;
4. resolve the 18 unrendered source editions and the unmatched Identity package provenance;
5. capture and inspect real player pages at desktop and mobile widths, including long passages, wide tables, Day 3 A/B, confidentiality reminders, response fields, navigation, focus states, and original-source access;
6. rerun the package integrity tests and verify the final rendered payload after any changes.


## Architecture clarification — canonical replacement editions

**Updated decision from content owner, 2026-10-11:** The supplied Volume 1–3 handbook editions are the intended new working/final content sources for a new Universal Handbook Player. They are **not expected to match** the current Habit, Decision, Money, Identity, Attention, or other legacy player editions. The legacy players are to be retired after the universal player has been validated.

Consequently, earlier checks that treat absent legacy topic packages or differences from legacy player text as failures of the new edition are superseded. Do not use the old player catalogue as the canonical source or require new editions to reproduce its text. Legacy implementations may be consulted only to identify reusable interaction patterns, accessibility behavior, or presentation components.

### Correct quality gate

1. Preserve each supplied original manuscript byte for byte as the canonical source artifact, with verified checksum and edition provenance.
2. Build a source-derived content inventory for every edition in the three volumes. Record source order, heading/section boundaries, tables, prompts, instructions, activities, measures, examples, response spaces, confidentiality text, and end matter. Do not silently correct editorial anomalies; flag them for review.
3. Compare the extracted structured content against the universal player's rendered output for **the same source edition**, not against legacy player packages. Report omissions, duplications, reordering, and materially changed wording/meaning with source locations and player locations.
4. Apply the established BIS presentation system consistently: improve hierarchy, typography, spacing, table responsiveness, navigation, and accessibility without changing content meaning.
5. Run real desktop and mobile browser checks on the universal player: navigation, long passages, tables, inputs, keyboard focus, overflow, responsive stacking, and access to the original source file.
6. Retire legacy players only after all intended editions are present, source-to-render comparisons pass, and responsive/accessibility checks pass.

The existing candidate mappings to legacy package IDs and the earlier 10-family-versus-5-family comparison are retained as historical audit notes only; they are **not** acceptance criteria for the universal handbook player.

**Current status:** Architecture direction clarified; implementation and same-source rendered-output verification remain to be completed. The supplied Volume 1 DOCX has been checksum-verified in the working session but has not yet been confirmed committed to `content/sources/handbooks/volume-1.docx`.
