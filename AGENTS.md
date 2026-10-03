# AGENTS.md — BIS Engineering Contract

This repository is the canonical application for the Behaviour Intelligence Series™ (BIS), an Applied Commerce® product.

These instructions apply to all coding agents, automated reviewers, and human contributors working in this repository. Treat them as product and engineering constraints, not suggestions.

## 1. Product identity

BIS is a private, evidence-first behaviour investigation and learning system. It is not a generic LMS, quiz app, survey tool, personality test, or AI coaching product.

The product combines:
- guided learning;
- practical Behaviour Labs;
- real-world evidence collection;
- facilitator-supported reflection;
- programme operations;
- organisation-level outcome reporting;
- governed content publishing.

Preserve the existing product identity and authored programme intent.

Do not rename product names, programme names, Labs, trademarks, roles, measures, or established user-facing terminology unless the canonical source or product owner explicitly requires it.

Current brand references include:
- Behaviour Intelligence Series™
- BIS
- Applied Commerce®

Do not introduce alternative product names or generic substitutes.

## 2. Canonical source hierarchy

When sources disagree, use this hierarchy unless the product owner explicitly directs otherwise:

1. Current authored BIS source material and approved product specifications.
2. Current canonical runtime contracts and production migrations.
3. Shared design/system components used by active routes.
4. Tests that encode accepted product behaviour.
5. Legacy implementations only as migration references.

Source files are the canonical authored record, but their document formatting is not automatically the learner interface.

Never silently rewrite, simplify, invent, or replace authored learning content to make implementation easier.

If source content cannot be represented faithfully, surface the limitation and fix the renderer/compiler rather than changing the meaning of the content.

## 3. Ten-touchpoint programme model

The BIS programme is structured around ten purposeful facilitated learning touchpoints. Preserve this model.

1. Create relevance and introduce the problem.
2. Build the first mental model.
3. Prepare for the Lab handover.
4. Interpret what the Lab revealed.
5. Build the learner's personal model.
6. Apply the model in real life.
7. Diagnose what happened.
8. Introduce the final major conceptual layer.
9. Integrate the whole model.
10. Demonstrate change and transfer forward.

The guided learning session target is 45 minutes.

Day 3 is a learning-to-Lab bridge. Live Lab Phase A is a separate facilitated experience and must not be collapsed into the 45-minute learning session.

Day 10 is not another theory chapter. Protect time for demonstration, post-measure, reflection, evidence, commitment, transfer, and the next real-world action.

Do not flatten these ten touchpoints into a generic sequence of lessons.

## 4. Lab architecture

The visible learner Lab journey follows the canonical nine-stage BIS laboratory sequence:

1. Hook
2. Pattern
3. Revelation
4. Mapping
5. Equation
6. Contract
7. Experiment
8. Evidence Review
9. Profile

The dedicated Habit, Decision, and Money runtimes and the source-backed Universal Lab architecture may differ internally, but learner-facing behaviour must remain semantically coherent.

Preserve:
- stable semantic field IDs;
- versioned enrolments;
- evidence provenance;
- authored response intent;
- calendar-controlled experiment behaviour;
- valid "no opportunity" evidence where defined;
- post-experiment comparison without turning results into personality scoring.

BEI/TEI identifiers are measurement metadata. Do not render them as learner answer choices or unexplained technical labels.

Do not invent new Labs, measures, indices, behavioural claims, or interpretations without approved source material.

## 5. Learning presentation standard

BIS learning should feel like a carefully edited digital handbook and facilitated experience, not an AI-generated dashboard or a stack of generic cards.

Required presentation principles:
- one clear visual hierarchy across all learning modules;
- document-flow reading for narrative content;
- evidence and learner actions receive stronger hierarchy than passive reading;
- tables preserve meaning and relationships;
- desktop and mobile layouts express the same information architecture;
- controls appear where the authored task expects the learner to respond;
- long source questions must not become oversized display headings;
- technical metadata stays out of the learner experience;
- navigation belongs to product chrome and must never obstruct learner controls.

Avoid:
- card-per-paragraph layouts;
- arbitrary decorative panels;
- repeated headings that add no meaning;
- unexplained badges or technical status labels;
- duplicate prompts;
- horizontal overflow;
- floating controls covering primary actions;
- generic AI copy such as "unlock insights", "supercharge", or filler explanations.

Responsive tables should become meaningful stacked structures on narrow screens when necessary rather than becoming unreadable screenshots or horizontally overflowing grids.

## 6. Customer-facing language

Customer-facing copy must explain intent, not implementation.

Learners, facilitators, programme owners, and sponsors should not need to understand:
- compiler terminology;
- runtime versions;
- database concepts;
- source artifacts;
- internal profile identifiers;
- implementation-specific BEI/TEI plumbing;
- infrastructure terminology.

Technical diagnostics may exist in administrator or advanced-detail surfaces when genuinely useful, but the primary interface should speak in human programme language.

Do not expose raw Supabase/Postgres/provider errors to customers.

## 7. Roles and privacy boundaries

BIS uses role-specific access and least-privilege data exposure.

Core operational roles include:
- learner;
- facilitator;
- programme/organisation owner or authorised reporting viewer;
- SYSTEM_ADMIN;
- SAFEGUARDING_OFFICER.

Role assignment is separate from authentication.

Facilitators receive structural progress and support signals required to facilitate the programme. Do not casually expose learner-authored answers, hypotheses, experiment wording, private reflection, Companion conversations, memory items, or unrelated personal evidence.

Organisation/sponsor reporting is aggregate-oriented. Preserve small-cell/privacy protections and causal restraint.

Safeguarding information must remain restricted to explicitly authorised workflows.

Do not introduce automated personality judgments, clinical interpretations, risk labels, or unsupported conclusions about learners.

## 8. Content Studio contract

Content Studio is a governed publishing system, not a free-form CMS.

Preserve the lifecycle:

source -> version -> compile -> preview -> UAT -> approve -> explicitly publish/activate

Rules:
- authored source remains traceable;
- published runtime identity is versioned;
- activation is explicit;
- previous versions are not silently destroyed;
- canonical source files must not be overwritten in place when a new immutable source/version is appropriate;
- compiler/runtime diagnostics should be translated into editorial outcomes in the primary UI;
- raw technical detail belongs behind advanced/admin disclosure where needed.

When changing Content Studio, test the entire lifecycle, not only the upload control or page rendering.

## 9. Evidence and uploads

Evidence capture is a product capability, not merely a storage component.

An evidence attachment must be associated with stable product context such as:
- authenticated user;
- enrolment;
- Lab code/version;
- investigation or programme step;
- semantic evidence field/event where applicable.

Uploads must:
- use private storage;
- respect consent and RLS;
- survive navigation and refresh where intended;
- expose clear pending/success/failure states;
- never silently overwrite canonical evidence;
- handle retry and removal safely;
- prevent cross-user/cross-enrolment access.

Do not broaden storage policies by weakening ownership checks.

## 10. Supabase and environment safety

Production data is sacred.

Never use BIS Production as an implicit development, test, preview, or Codex backend.

Every environment must explicitly provide:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

The production Supabase project must remain fail-closed unless the explicitly production-only acknowledgement is configured.

Never place any of the following in browser/public configuration:
- service-role keys;
- database passwords;
- private API keys;
- secret tokens.

Do not bypass RLS to make a feature work.

All schema changes must be append-only migrations unless there is a deliberate, reviewed migration strategy.

For database/RLS changes:
- test positive and negative access;
- test the correct role;
- test the wrong role;
- test the wrong user/enrolment/cohort;
- test revoked/withdrawn states where applicable.

Never modify BIS Production data during automated development or QA unless the task explicitly authorises a controlled production operation.

## 11. Git and release discipline

Do not work directly on `main` for substantial changes.

Use a dedicated branch and a pull request.

Do not merge or deploy merely because code compiles.

Never weaken, skip, delete, or inflate timeouts in tests simply to obtain a green build.

Do not rewrite tests to match a regression. Fix the regression unless the accepted product contract has deliberately changed.

The authoritative verification contract is:

`npm run verify`

It must include:
- runtime check;
- lint;
- TypeScript;
- acceptance tests;
- canonical-source audit;
- optimized production build;
- Playwright/browser tests.

## 12. Browser and UX verification

Code inspection alone is not UX verification.

For learner-facing changes, verify at minimum:
- 360px mobile;
- 430px mobile;
- 1280px desktop.

Test actual journeys, not isolated screenshots.

Check:
- navigation;
- Back behaviour;
- save/persistence;
- refresh/re-entry;
- loading;
- validation;
- empty states;
- error recovery;
- session/auth state;
- keyboard/focus behaviour;
- overflow;
- sticky/floating controls;
- tables;
- long content;
- primary action reachability;
- console errors;
- failed network requests.

A button that exists but cannot be pressed is a failed implementation.

A save call that returns but does not advance or persist correctly is a failed implementation.

## 13. Shared-system first

Prefer fixing shared primitives and canonical runtimes over page-specific patches.

Before creating a new component or runtime, check whether an authoritative implementation already exists.

Avoid parallel systems for the same responsibility.

Legacy shells may be mined for still-needed behaviour, but do not restore obsolete architecture just because it contains a missing feature.

Migrate valuable behaviour into the canonical system, verify parity, then retire dead implementations.

## 14. Accessibility

Accessibility is part of correctness.

Preserve or improve:
- semantic headings;
- form labels;
- keyboard navigation;
- focus management;
- dialog semantics;
- skip links;
- sufficient hit targets;
- understandable validation;
- screen-reader names;
- reduced obstruction on small screens.

Do not trade accessibility away for visual polish.

## 15. What "finished" means

A task is not finished because code was written.

For meaningful product changes, "finished" means:

requirement
-> implementation
-> automated tests
-> browser verification
-> data/RLS verification where relevant
-> regression coverage
-> no unresolved console/network errors
-> responsive verification
-> reviewable diff
-> documented remaining risks

When a task touches persisted learner/staff data, include a data-integrity check.

When a task changes a workflow, test the workflow end to end.

When a task changes a shared component, inspect every major surface that consumes it.

If any required verification cannot be performed, state that limitation explicitly. Do not describe an unverified behaviour as complete.

## 16. Change-control rules

Do not casually change:
- the ten-touchpoint programme architecture;
- the nine-stage Lab sequence;
- authored BIS learning meaning;
- evidence semantics;
- established role/privacy boundaries;
- RLS protections;
- measurement definitions;
- immutable content/version relationships;
- production environment safety;
- canonical navigation model;
- brand/product terminology.

A change to any of these requires an explicit product decision and accompanying regression coverage.

## 17. Working style for agents

Before changing code:
1. identify the canonical implementation;
2. identify the accepted contract and relevant tests;
3. reproduce the defect where practical;
4. state the smallest coherent remediation.

While changing code:
- keep the change scoped;
- preserve authored meaning;
- prefer shared fixes;
- add tests for the actual defect;
- avoid unrelated cleanup.

After changing code:
1. run the relevant focused tests;
2. run `npm run verify` before release-ready claims;
3. inspect affected browser journeys;
4. report files changed, tests run, unresolved issues, and user-visible impact.

When uncertain whether a change affects product meaning, privacy, evidence semantics, or programme architecture, stop and ask for a product decision rather than inventing one.
