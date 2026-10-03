# Browser acceptance

`npm run test:browser` launches a separate test-only Next app using the **actual shared Lab renderer, learning player, DOM enhancements, navigation shell and CSS**. No test route or authentication bypass is added to the production app. API responses are intercepted with source-derived fixtures and the real Lab submission validator. Tests run at 360px, 430px and desktop widths; reports include screenshots and failure traces. Committed PNG comparisons cover compact entry consent, baseline rating and learning-question hierarchy. Review and deliberately update snapshots with `npm run test:browser -- --update-snapshots` after an accepted visual change.

Install Chromium with `npx playwright install --with-deps chromium`. A locally installed browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

The test-only app serves pinned Nimbus Sans and DejaVu Serif fallback fonts, with their redistribution licenses in `fonts/`. This keeps screenshot text metrics independent of the runner's installed fonts. Production typography and shared layout CSS are unchanged.

These tests prove rendered interaction behavior and contract integration. They do not claim to exercise production authentication, storage, DNS or real-time calendar advancement. Signed-in production UAT remains a separate release requirement.
