# Universal BIS Lab Experience v1

## Product rule

A BIS Lab supplies authored behaviour content and evidence rules. It does not own its own learner navigation, header, progress treatment, responsive layout, or menu.

Habit Lab, Decision Lab and Money Lab must therefore feel like three investigations inside one BIS product rather than three separate applications.

## Presentation ownership

The shared learner presentation is owned by:

- `CanonicalAdaptiveShell` — BIS brand header and learner menu.
- `LabInvestigationFrame` — Lab progress, the nine-investigation navigator and mission presentation.
- `lab-investigation-frame.css` — responsive Lab spacing, navigation, story/prompt surface grammar and mobile behaviour.
- `labExperienceManifest` — stable Lab identity metadata such as title, route and accent.

A Lab route must not introduce another learner header, hamburger menu, progress bar or investigation rail.

## Authored Lab data

A Lab definition may vary:

- title, version and accent;
- investigation title, phase, mission, duration and difficulty;
- story content and prediction choices;
- prompts, field types and pass behaviour;
- equations and examples;
- experiment rules and evidence fields;
- BEIs, calculations, review content and certificate copy.

Those differences are data/content differences. They must not create a new application shell.

## Current engines

Habit preserves its established Habit evidence runtime and authored content. Decision and Money share the generic Core Lab evidence runtime. Both runtimes render active investigations through `LabInvestigationFrame`.

This deliberately separates **evidence ownership** from **presentation ownership**. The universal frame does not merge evidence namespaces or rewrite Lab-specific calculations.

## Adding a future Lab

1. Register stable identity metadata in `lib/lab-experience-manifest.ts`.
2. Add the authored Lab definition/evidence contract to the appropriate data engine.
3. Render the Lab through `CanonicalAdaptiveShell` and `LabInvestigationFrame`.
4. Do not create route-specific learner chrome.
5. Extend parity tests so the new Lab is covered by the same shell contract.

If a new Lab requires a genuinely new content block, add that block to the shared renderer so other Labs can use it. Do not solve it with one-off page layout.
