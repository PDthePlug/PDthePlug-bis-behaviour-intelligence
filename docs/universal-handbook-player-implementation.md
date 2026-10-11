# Universal Handbook Player — implementation record

## Implemented on the feature branch

- Added `app/universal-handbooks` as the shared source-driven reader surface.
- Added a single edition selector and section navigation derived from source block labels/styles.
- Reuses the established BIS shell and handbook presentation styles; responsive table containers preserve access to wide tables on small screens.
- Keeps manuscript text separate from layout; paragraphs and tables are emitted in source order. Original source headings that need review are displayed unchanged and flagged.
- Added `scripts/import-canonical-handbooks.py` to serialize the supplied DOCX body in order, retain paragraph/table boundaries, record SHA-256 provenance, and copy the source binary byte-for-byte into the generated public source package directory for the reader's original-file link.
- Added source package integrity tests. The importer is not a content editor and must not normalize, summarize, reorder, or repair manuscript wording.

## Canonical source audit

The supplied source hash is `1bfd88d11bf90ebbe3b7f40321740904e8a8065d3e5294978ffd8a2cbb2b356e`. A direct XML body scan detects 30 LAB™ heading boundaries. They do not resolve to ten clean families × three editions: Time has four boundaries (one Workplace heading has a prefixed question in the same paragraph), while Risk has only two clearly titled editions. This discrepancy is preserved in the inventory rather than repaired by inference.

## Remaining release gates

1. The source DOCX must be available to the repository build workspace at the approved canonical path. It is not currently committed as `content/sources/handbooks/volume-1.docx`; therefore packages are not yet generated in CI and the reader route deliberately shows a source gate when the manifest is absent.
2. Review the missing Risk Workplace / duplicate malformed Time Workplace boundary with the content owner.
3. Generate the packages from the unchanged source and run the package tests.
4. Compare rendered content with the corresponding source blocks for every edition; record missing, duplicated, reordered, or semantically altered content.
5. Run actual desktop/mobile browser checks, keyboard/accessibility checks, and original-DOCX download verification.
6. Do not retire legacy player routes until the new source-driven reader passes the above gates.

No production release, deployment, PR merge, or visual browser certification is claimed by this implementation record.
