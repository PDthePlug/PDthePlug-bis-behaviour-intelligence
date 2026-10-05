# Leap9 × BIS Programme Experience v2

Public route: `/experience/leap9/v2`.

This release preserves `/experience/leap9` as the first programme simulation and adds a second, more immersive Leap9-specific experience on top of the same canonical fictional Habit evidence model.

## Product intent

V2 shifts the emphasis from “how BIS works” to “what a Leap9 programme could see and do with BIS operating inside it”.

The journey is intentionally grouped into six experience stages rather than ten demo steps so it cannot be confused with the canonical ten facilitated programme touchpoints:

1. Welcome
2. Participant journey
3. Real-world test
4. Facilitator view
5. Evidence profile
6. Programme intelligence

The ten-touchpoint programme remains visible as a separate, collapsible programme map.

## Experience treatment

The page uses the established BIS publication treatment: continuous white learning canvas, restrained borders, serif hierarchy, green evidence/accent language, embedded cards and framed evidence structures. It avoids a card-per-paragraph dashboard while retaining meaningful cards, tables, callouts and programme-navigation surfaces.

Instructional guidance is collapsible. It opens on first entry, closes automatically once the visitor begins, and can be reopened on any step. The mobile experience map is also collapsible.

## Leap9-specific evolution

V2 strengthens four areas:

- the opening frames the transfer problem between facilitated learning and independent behaviour;
- Naledi’s participant story remains fictional but is explicitly positioned as an intention-to-action journey;
- the facilitator perspective starts with cohort operations and support/evidence coverage before opening Naledi’s record;
- the final programme perspective is organised around three questions: whether learning is turning into action, where support is needed, and what should change next.

The illustrative Programme Decision Register row demonstrates how a cohort signal can become a programme decision and a next-cohort comparison without claiming causation.

## Privacy and evidence boundaries

No production records are read or written. Practice state remains versioned in `sessionStorage` under the v2-specific key `bis.programme-experience.leap9.v2`.

The existing rules remain unchanged:

- fictional identities and fixed illustrative cohort data;
- learner-authored reflection private by default;
- explicit sharing required before facilitator review;
- editing reviewed evidence invalidates the illustrative review;
- support requests are human-support signals, not risk labels;
- “no opportunity” remains valid evidence and is excluded from the adherence denominator;
- prediction, observation and interpretation remain separate evidence classes;
- programme reporting remains aggregate and does not expose private learner answers.

The existing illustrative PDF remains the downloadable programme report.

## Social preview

The v2 route defines Leap9-specific Open Graph and Twitter metadata so a shared link presents as `Leap9 × Behaviour Intelligence` rather than inheriting the generic BIS share card copy.

## Verification

Browser coverage is added for 360px, 430px and 1280px, including:

- initial guide expanded;
- guide collapsed after starting;
- participant edits;
- no-opportunity evidence;
- explicit sharing and support request;
- facilitator acknowledgement and review;
- evidence-profile continuity;
- programme-intelligence view;
- report-link visibility;
- browser Back;
- horizontal-overflow check;
- console and failed experience-request checks.

Full release verification remains `npm run verify`.
