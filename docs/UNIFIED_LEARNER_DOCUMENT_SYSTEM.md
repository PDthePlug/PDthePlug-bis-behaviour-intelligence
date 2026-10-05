# BIS Unified Learner Document System

## Purpose

Learn and Lab are two modes of one learner experience. They must feel like the same publication system even though they perform different jobs: Learn explains and prepares; Lab investigates, records evidence and returns the learner to the programme.

This design layer changes presentation only. It must not rewrite, shorten, reorder, reinterpret or silently “improve” authored workbook meaning.

## Shared document contract

The current `ProgrammePlayer` reader and the active Lab investigation frame use the same structural primitives:

- **document stage** — one centred reading width with intentional breathing room;
- **document surface** — white publication surface with restrained border, radius and shadow;
- **document header** — eyebrow, title, purpose, outputs/outcomes and compact metadata;
- **document progress** — quiet and secondary to the learning content;
- **document body** — continuous reading flow rather than a dashboard/card stack;
- **evidence controls** — visually stronger than passive reading when the learner must act;
- **tables** — preserve row/column relationships; narrow screens scroll rather than destroying meaning;
- **document endpoint** — one obvious primary action with secondary navigation visually reduced.

Learn keeps its programme map and workbook-save state. Lab keeps investigation navigation, calendar/evidence behaviour and its canonical nine-stage progression. The shared system does not flatten those workflows into identical controls.

## CSS contract

Shared primitives live in `app/learner-document-system.css` and use the `learner-document*` class family.

Route-specific files may style behaviour unique to a reader, prompt type or Lab stage, but they should not redefine the core publication surface, title hierarchy, purpose/outcome/meta treatment or endpoint hierarchy without an explicit product decision.

The Lab accent is passed into `--learner-document-accent`. Learn uses the BIS teal default.

## Authored-content boundary

Do not change:

- workbook prose, questions, examples, sequence or authored table meaning;
- semantic field IDs or evidence bindings;
- the ten-touchpoint programme model;
- the nine-stage Lab sequence;
- Phase B timing, no-opportunity evidence or return-to-learning behaviour;
- privacy, pass/skip behaviour or measurement definitions.

If authored content renders badly, repair the renderer or shared document treatment first.

## Acceptance

For 360px, 430px and 1280px:

1. Learn and active Lab investigations use the shared learner-document surface and header grammar.
2. No page-level horizontal overflow is introduced.
3. Primary actions remain reachable and unobstructed by the BIS menu.
4. Tables preserve their relationships; intentional table-local horizontal scrolling is acceptable.
5. Browser Back, save/persistence, Lab progression and learning handback remain unchanged.
6. Existing authored-response fields keep their semantic IDs and restored values.
7. A visual change is not accepted if it requires changing authored workbook wording.
