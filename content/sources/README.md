# Canonical BIS manuscripts

These are byte-for-byte copies of the three Word manuscripts supplied by the owner on 3 October 2026. `manifest.json` records their original filenames and SHA-256 fingerprints. Do not edit a manuscript to satisfy a test.

`npm run audit:source` verifies the fingerprints, then runs all 32 Labs through the real source adapter, compiler, presentation normalizer and server submission contract. It checks every experiment day as well as ordinary investigations. GitHub CI and the Vercel build both run this gate.

This certifies newly compiled source packages. It does **not** certify an older active production artifact or constitute a Content Studio UAT approval. Active artifacts must be downloaded through authorized Content Studio access and compared individually; only failed artifacts should be recompiled.

Run `node scripts/audit-active-lab-artifacts.mjs /path/to/export.json` against the authorized export. Each entry must contain `code`, `versionId`, `path` (relative to the export), and the exact database `sha256`. The audit verifies downloaded bytes, runs the interaction contract, and compares source question, control type and experiment schedule for each investigation. Its JSON output is evidence for review, not a manufactured UAT approval. It certifies only the artifacts listed; reconcile the export count with production before declaring the whole active library certified.
