# BIS Module Activation Template

## Purpose

Every BIS module is one catalogue entry with two independently activated products:

1. **Handbook / learning module**
2. **Executable Lab**

The catalogue may list a module before either product is live. A card must never be marked **Open** until its runtime and persistence contracts exist.

## Current product scope

- Volume 1 — Core Identity & Behaviour: 12 modules
- Volume 2 — Advanced & Applied: 12 modules
- Volume 3 — Applied Thinking: 10 modules
- Current catalogue total: 34 modules

Volume 3 includes Transferable Skills™ Lab as Lab 9 and Meta-Learning™ Lab as Lab 10. Together with Volumes 1 and 2, the current BIS product scope is 34 modules.

## Handbook activation contract

A handbook may move to `live` only when all of the following are true:

- Three learner Editions exist: `school`, `emerging_adult`, `workplace`.
- Each Edition preserves authored content losslessly.
- Each Edition has the standard 13 programme positions:
  Welcome, Day 1, Day 2, Day 3, Day 4, Day 5, Weekend, Day 6, Day 7, Day 8, Day 9, Day 10, Certificate.
- Stable programme step namespace: `<CODE>.PROGRAMME.*`.
- Stable workbook response namespace: `<CODE>.WB.*`.
- A content release exists for the learner's persisted Edition.
- Progress is isolated by module code + content release.
- Workbook responses are isolated by module code + content release.
- Day 3 handoff points to that module's executable Lab when one is available.
- Returning from the Lab resumes the same handbook.
- Reader accessibility, mobile behavior and autosave acceptance tests pass.
- The catalogue entry has a real `learningHref`.

## Executable Lab activation contract

A Lab may move to `live` only when all of the following are true:

- The Lab code is accepted by the runtime/domain model.
- Evidence uses the module namespace and cannot mix with another Lab.
- Phase A flow is implemented.
- Phase B / experiment timing is implemented where required.
- Privacy and safeguarding boundaries are defined.
- Role permissions are defined.
- Staff structural progress is redacted from private learner content.
- The route passes mobile/desktop acceptance.
- The catalogue entry has a real `labHref`.

## Status meanings

- `live` — runtime is usable and linked.
- `source_ready` — authored/digital source exists but production reader migration is incomplete.
- `catalogued` — part of the 34-module product scope; production learning cartridge is not yet activated.
- `planned` — executable Lab runtime is not yet activated.

## Adding a future module

1. Add one entry to `lib/bis-catalogue.json`.
2. Assign a unique code, slug, volume and position.
3. Leave both surfaces non-live initially.
4. Migrate and validate all three handbook Editions.
5. Register content releases.
6. Activate the learning href.
7. Implement the executable Lab using the shared Lab shell/domain contract.
8. Activate the Lab href.
9. Run the catalogue, privacy, evidence and route acceptance suites.

No new module should require a new global navigation system.
