# Canonical BIS Learning manuscripts

This directory is the source-of-truth intake for authored BIS **Learning** material.

It is deliberately separate from `content/sources/`, which contains the three canonical Lab workbook volumes. A Lab manuscript must never be used as a substitute for a Learning manuscript.

## Governing rule

Owner-supplied Learning manuscripts are authoritative. Ingestion may identify structure, normalize supported presentation primitives, generate stable runtime field identities, and compile authored controls. It must not silently rewrite, shorten, reconcile, expand, or invent authored Learning content.

Every accepted source must be recorded in `manifest.json` with:
- BIS module code
- source path
- delivery edition/audience as stated by the source
- original uploaded filename
- SHA-256 fingerprint
- source format

A module remains catalogued until its supplied Learning source has been fingerprinted, compiled through the shared Learning pipeline, previewed, and explicitly approved for publication.

## Current live Learning baseline

The existing built-in Learning packages are:
- HAB — Habit
- DEC — Decision
- MON — Money
- IDN — Identity
- ATT — Attention

This directory holds authored Learning manuscripts and their replacement editions. Saving a source does not activate it by itself.

Current canonical intake:
- The retained Time Markdown source.
- The owner-supplied 24 October 2026 Volume 1 DOCX: all 12 titles, all three editions.
- The partial Volume 2 DOCX: Career and Launch in all three editions; Failure in School and Emerging Adult. Failure Workplace is absent.
- Separate owner-approved timing revisions for Career and Launch: 30 calendar days starting after touchpoint 3, continuing past all ten teaching touchpoints, with final review after Day 30.

The new manuscripts replace the prior handbook wording for every supplied title and edition. Original source bytes remain fingerprinted for provenance. They are separate from the executable nine-stage Lab workbook corpus.

`node scripts/prepare-authored-handbooks.mjs` splits the combined DOCX files by authored title and edition and prepares all 44 source packages through the shared adapter and compiler. `--check` verifies that the retained packages still match both manuscripts and approved revisions. It is included in `npm run audit:source`.

Content Studio offers **Prepare all replacement handbooks** and a per-title **Prepare replacement handbook** action. These load complete replacement sources into new versions through the existing private upload, attach, compile, preview, final check and explicit publication lifecycle. No prior authored paragraphs are merged into a replacement. The shared ProgrammePlayer renders every edition.

Career and Launch retain four source-authored opportunity records. Their observation windows cover Days 1–7, 8–14, 15–21 and 22–30, so the final two days remain inside the 30-day experiment without manufacturing a fifth opportunity. Days 8–10 of teaching are interim reviews. The certificate template is for the final review, not ten-touchpoint completion.

## Processing contract

For each supplied Learning source:

1. Preserve the original bytes and fingerprint them.
2. Determine module code, title, edition/audience, and authored sequence from the source itself.
3. Compile through the shared BIS Learning pipeline; do not create module-specific page/runtime forks.
4. Preserve authored wording, order, prompts, response semantics, and stable answer identities.
5. Link the Learning module to its existing BIS catalogue/Lab code only where the source supports that identity.
6. Preserve learner-private workbook response boundaries.
7. Run source audit, compiler/contract tests, responsive browser coverage, and Content Studio preview/UAT.
8. Publish only after governed approval; only then may catalogue Learning status change to live.

If a required Learning manuscript has not been supplied, the module stays catalogued. Lab source availability is not sufficient evidence to manufacture Learning content.
