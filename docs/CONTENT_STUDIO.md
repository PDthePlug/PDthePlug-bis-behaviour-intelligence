# BIS Super User Content Studio v1

## Purpose

Content Studio is the administrator-only ingestion and governance layer for future BIS learning modules and Labs.

It solves a different problem from the learner runtime:

- **Content Studio** owns content identity, versions, source files, validation and approval.
- **Programme Player** owns the learner-facing learning-module experience.
- **Universal Lab Experience** owns the learner-facing Lab presentation.
- **Evidence runtimes** own Lab-specific evidence, calculations and experiment behaviour.

Uploading a file must never be equivalent to making code executable.

## Access

Content Studio requires the existing `SYSTEM_ADMIN` role. The database catalogue and source bucket are protected by RLS using `private.has_staff_role('SYSTEM_ADMIN')`.

The source bucket is private: `bis-content-studio`.

## Core objects

### Content item

One stable identity for either:

- `LEARNING_MODULE`
- `LAB`

A learning module may link to one Lab. The link is metadata; it does not merge their evidence stores.

### Content version

A version belongs to one content item and preserves:

- source format and file identity;
- private storage path;
- source hash;
- schema version;
- validation result;
- runtime readiness;
- approval status;
- release notes;
- audit timestamps.

Existing production BIS modules and Labs are registered as `PUBLISHED + LIVE` system versions so the catalogue begins with the real platform rather than an empty CMS.

## Workflow

```text
Create content identity
        ↓
Create draft version
        ↓
Upload required source(s)
        ↓
Compile
        ↓
Validate
        ↓
Approve
        ↓
Activate
```

The separation between **Approve** and **Activate** remains intentional. Activation now exists, but it is a separate explicit action after successful compilation and approval.

For learning modules, one version always contains exactly three source slots — **School, Emerging Adult and Workplace** — and all three must compile before the version can activate. A malformed, incomplete or unexpected upload can therefore never replace a live learner experience simply because a Super User uploaded it.

## Source formats

Content Studio accepts:

- BIS package JSON
- DOCX
- PDF
- HTML
- Markdown
- ZIP

For **learning modules**, the Content Compiler has deterministic adapters for DOCX, text-based PDF, safe HTML, Markdown and ZIP, as well as native BIS JSON. The adapter must recover all 13 canonical programme positions; otherwise compilation fails rather than inventing missing structure.

For **Labs**, runtime evidence semantics remain explicit: activation accepts Universal Lab JSON, or ZIP containing that JSON. DOCX/PDF Lab prose can be retained as source material but is not converted into evidence fields by guesswork.

Compilation never publishes automatically. A compiled version must still be approved and explicitly activated.

## Learning-module package

A learning-module version carries exactly three edition packages:

- School;
- Emerging Adult;
- Workplace.

Each edition package carries the same content code and version plus its own authored treatment, ordered pages and response fields. The three editions are compiled, activated and rolled back together.

The current reader continues to enforce learner-response behaviour such as question answer spaces and collapsed answer keys. Authors should not need to redesign those interactions in every module.

Reference: `content/templates/learning-module.package.example.json`.

## Lab package

A Lab package carries:

- identity and visual accent;
- runtime profile;
- investigation sequence;
- missions, timing, difficulty and outputs;
- later runtime-specific evidence definitions.

The Lab supplies data and authored behaviour content. It does not own its own header, menu, progress bar or responsive layout.

Reference: `content/templates/lab.package.example.json`.

## Runtime profiles

v1 recognises these package labels:

- `HABIT_V1`
- `CORE_V1`
- `UNIVERSAL_V1`

Recognition means the package contract is known to Content Studio. It does **not** bypass the runtime activation gate.

## Validation

Learning-module validation currently checks:

- identity is present;
- code matches the library item;
- version matches the draft;
- a learning sequence exists;
- embedded authored HTML does not contain scripts, iframes, object/embed tags, inline event handlers or `javascript:` URLs.

Lab validation currently checks:

- identity is present;
- code and version match the draft;
- investigations are ordered and have title + mission;
- runtime profile is recognised or explicitly flagged as needing an adapter.

All uploaded sources are SHA-256 fingerprinted during validation.

## Audit

The API writes staff audit events for:

- content identity creation;
- draft creation;
- source attachment;
- validation;
- approval;
- reopening;
- archival.

## Compiler and activation

The Content Compiler + Runtime Activation milestone extends Content Studio with deterministic runtime artifacts, explicit activation and rollback.

Learning versions compile three runtime artifacts — one for each delivery edition. Universal Lab packages compile one runtime artifact. Only `COMPILED + VALID + APPROVED + READY` versions can activate.

See `docs/CONTENT_COMPILER_RUNTIME.md` for the full contract and rollback rules.
