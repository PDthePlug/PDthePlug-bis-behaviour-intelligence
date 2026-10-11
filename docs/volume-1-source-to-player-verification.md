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
