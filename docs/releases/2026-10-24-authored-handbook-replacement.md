# Authored handbook replacement

The implementation prepares complete replacement content for every supplied handbook edition. It is prepared on `feat/authored-handbook-replacements` for repository review. It has not been deployed or published to learners.

## Supplied content

| Source | Titles | Editions |
| --- | ---: | ---: |
| Volume 1 | 12 | 36 |
| Partial Volume 2 | Career, Launch, Failure | 8 |
| Total | 15 | 44 |

Volume 2 supplies Career and Launch in School, Emerging Adult and Workplace editions. Failure has School and Emerging Adult only. Its Workplace edition is not manufactured. The set compiles into 572 programme positions through the existing handbook compiler and ProgrammePlayer. The nine-stage Universal Lab workbook runtime remains a separate authored experience.

The original DOCX bytes are retained with fingerprints in `content/learning-sources/manifest.json`. Separate approved revision files implement the owner's 24 October instructions for Career and Launch. The combined manuscript importer selects the exact title and audience before rendering; it fails rather than substituting the first handbook or an adjacent edition.

## Career and Launch timing

Both field experiments run for 30 calendar days, starting after teaching touchpoint 3 and continuing beyond all ten touchpoints. Touchpoints 8–10 review evidence collected so far. Final review follows experiment Day 30; completing the ten teaching touchpoints does not establish experiment completion or award a certificate.

The four authored opportunity records cover Days 1–7, 8–14, 15–21 and 22–30. This includes the final two days without inventing a fifth opportunity or changing the authored four-record denominator. Stories about a completed month remain examples; learner instructions identify interim reviews and continued recording.

## Replacement workflow

Content Studio adds per-title and all-title replacement preparation. Each operation creates a new, empty version, loads every supplied edition, attaches sources through the existing private upload workflow, and compiles only after the title's editions are attached. It does not merge old authored paragraphs into the new source or publish automatically. The established preview, final check and explicit publication operations remain in use.

The new saved-source endpoint requires SYSTEM_ADMIN and an editable Learning version. It verifies package fingerprints and rebinds the source envelope to the actual working version. Signed-out users, learners and unrelated staff cannot obtain the saved manuscripts through it. Source assets are included in the serverless file trace.

Replacement controls use source-owned answer identities, so an older response cannot appear under a replacement question. Reader resumption is scoped to the current release; old completion records do not resume a new handbook at the end. These changes do not delete learner evidence.

Rebuild the retained packages with `node scripts/prepare-authored-handbooks.mjs`. Check them with `node scripts/prepare-authored-handbooks.mjs --check`; this check is included in the canonical source audit.

## Verification and release status

Focused replacement and access tests pass: 51 tests cover all 44 compiled editions, complete source selection, missing-edition handling, answer-identity isolation, private access, and preparation failure handling. `npm run verify:build` passes: lint, TypeScript, all 863 acceptance tests, canonical source audits, the optimized production build, and serverless file tracing for all 44 replacement sources. One existing unused-variable lint warning remains in `scripts/certify-measurement-staging.mjs`.

Responsive browser verification is not complete. Playwright could not launch because its Chromium executable is absent. Installation returned an invalid 195-byte HTML response instead of the browser archive. New browser journeys cover the real compiled content, saving, reload, navigation, release resumption and 30-day continuation at the repository's 360px, 430px and desktop sizes; those checks must pass before release-ready claims.

The owner explicitly approved uploading the manuscript DOCX files and generated authored content to the public BIS GitHub repository on 24 October 2026. That approval resolves the previous automatic upload-review block.

No production data was changed. Browser verification, deployment and live handbook publication remain outstanding.
