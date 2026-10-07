# BIS for DGMT: first view and programme experience

Review route: `/experience/dgmt`. Illustrative report: `/experience/dgmt/report`.

## Context and intent

The first view removes account creation as an entry requirement and explains the distinctive offering through a short demonstration. It is prepared for discussion about practical competencies and pathways to productivity; it does not imply an agreed DGMT partnership.

The DGMT experience repurposes the existing Leap9 v2 simulation around pathways to productivity. It opens with a 90-second text-led video and an accessible transcript, then offers the participant → experiment → facilitator → evidence profile → programme outcomes journey. No account or real participant information is needed.

The video is a sequence of five captioned views of the fictional experience. It has no narration and does not present a time-compressed experiment as observed reality. The underlying authored Habit excerpt, ten-touchpoint model, nine Lab stages and canonical Habit metrics are preserved.

## Implementation and boundaries

- Partner configuration sets branding, route, report link and isolated practice-state key. Leap9’s existing routes and report remain available.
- DGMT practice uses `bis.programme-experience.dgmt.v1` in session storage. Original evidence classes remain distinct and no practice answers are sent to an API.
- The public proxy bypass is exact: the DGMT page, fixed report, MP4 and captions. Other experience routes and authenticated APIs retain session handling. This prevents a first view from depending on a backend session, including when playing the video.
- Private reflection remains hidden from the facilitator until explicitly shared. Editing evidence or withdrawing sharing clears the illustrative review. Restoration also rejects an attested blank note and removes notes when sharing is off.
- The facilitator cohort table is semantic and keyboard-scrollable. Fixed cohort counts no longer mix with editable Naledi details; a separate participant-focus view follows practice edits.
- Page and PDF findings use the same fixed sample of twenty fictional participants. DGMT wording references a possible delivery context without implying a partnership or proven impact. Every PDF page retains the illustrative label.
- The overview describes Universal Labs, evidence continuity, human support, aggregate privacy, programme decisions and governed Content Studio publishing. Content Studio, enrolment and safeguarding are described, not simulated as authenticated workflows.
- The desktop map has a heading; the mobile map has an operable disclosure with a named controlled region. Browser Back closes transient map/reset UI.

## Media reproduction

With the fictional browser harness running on port 3100:

```sh
node scripts/create-dgmt-demonstration.mjs
```

The script uses Playwright and ffmpeg to generate the MP4, JPEG poster and VTT captions under `public/experience/`. `lib/experience/dgmt-demonstration.mjs` supplies both the video copy and the exact written transcript. The video is 90 seconds, 1280 × 720, approximately 440 KB. It does not autoplay and uses `preload="none"`.

## Verification

New browser coverage at 360px, 430px and 1280px checks:

- unauthenticated first view, video playback, captions and transcript;
- editable answers, required-field validation, refresh persistence and unavailable storage;
- isolation from Leap9’s session state;
- private reflection before sharing, sharing withdrawal, support request acknowledgement and review invalidation;
- fixed-versus-editable evidence distinction;
- complete journey, focus, browser Back, reset confirmation and cancellation;
- overflow and reachable controls;
- downloadable, DGMT-labelled PDF with no Leap9 or private reflection content;
- no console errors or practice-data writes.

The proxy test executes the real proxy with an observable session boundary, checking public routes and negative cases including similarly named routes and authenticated staff/profile endpoints.

Release verification passed in [GitHub CI](https://github.com/PDthePlug/PDthePlug-bis-behaviour-intelligence/actions/runs/37599115848): 671 acceptance tests and 300 browser tests, including the PR merge with current main. Fifteen focused DGMT/Leap9 browser checks also passed against the optimized app at 360px, 430px and 1280px.

The system Chromium used locally differs from the pinned Playwright browser on three existing Leadership Lab snapshots. The same mismatch reproduces on unchanged main; all three comparisons pass with the pinned browser. No baseline or threshold was changed. Final evidence and limitations are recorded in `docs/hardening/dgmt-experience-verification.json`.
