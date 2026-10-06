# Reader flow and quieter evidence screens

## Problem and resulting behaviour

Repeated handbook enhancement could add a second set of understanding checks. A check could appear before its associated answer; the reading preference also lost to route-specific CSS. The Leap9 welcome panel lost its inner padding. Missing-evidence reports and facilitator check-ins repeated the same explanation in large cards.

Checks now appear once, after the associated written response has content. Restoring a response reveals its saved check without changing field IDs or saved values. The question is “After answering, how clear does this feel?” with understanding, uncertainty and another-example options. Repeated prompts and the misplaced Money safety-list answer box are removed from presentation. The safety instruction and full list remain visible.

Text size reaches actual handbook and Lab reading, labels and response fields. Large is 115% and extra large is 130%. Navigation and display titles retain their hierarchy. The public experience welcome panel regains padding and a mobile heading size that fits the card.

Pending programme evidence, absent learning comparisons, unavailable assessment reports and privacy explanations use closed native disclosures. Repeated facilitator notices share one explanation and preserve individual learner links. Populated findings and practical next steps remain visible. The redundant numbered Observe/Try/Check programme cards are removed.

## Authority and scope

The product owner's 6 October screenshots and requested UX hardening govern these presentation changes. Existing active handbook assets remain the content authority. The supplied Volume 1–3 documents were reviewed; they are not replacements for the five active handbook programmes and their three editions.

There are no migrations, scoring/formula changes, privacy-threshold changes, synthetic live records or deletions of existing answers. Understanding signals remain learner self-reports, excluded from BEI; this pass does not introduce competency assessment or redesign programme questions. The erroneous Money control is hidden in the reader only; historical stored data remains untouched.

## Verification

The test harness reads the real compressed production handbook assets. It repeats enhancement four times and checks unique controls, check placement, answer/check restoration on refresh, all fifteen active editions, and Money safety instructions across the three editions. Settings tests measure actual rendered reading and answer sizes after navigation and refresh, including a Universal Lab.

Report tests cover keyboard disclosure activation, privacy-limited results, grouped missing observations, learner navigation and browser Back. Experience tests measure welcome padding and complete the demonstration journey at 360px, 430px and 1280px.

Two existing text-contract assertions are deliberately updated: they required the removed repeated check disclaimer and numbered programme cards. The scoring/privacy assertions remain intact; browser tests now verify the requested replacement behaviour.

The full release gate is `npm run verify`: lint, TypeScript, acceptance tests, canonical source audit, optimized build and all three browser viewport projects. Local browser tests use the non-production service harness. Authenticated production account/database UAT is outside this pass.

Rollback: revert this PR; no database rollback is needed.
