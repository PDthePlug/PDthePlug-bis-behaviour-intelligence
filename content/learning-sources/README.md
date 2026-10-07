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

This directory is for the remaining authored Learning modules as they are supplied. It does not activate any module by itself.\n\nCurrent canonical intake:\n- TIM — Time Lab™ v1.0 — School, Emerging Adult and Workplace editions — source-ready, not yet learner-live.

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
