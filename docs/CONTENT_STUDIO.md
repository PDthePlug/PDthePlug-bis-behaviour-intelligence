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
Upload private source
        ↓
Validate
        ↓
Approve
        ↓
Runtime activation (separate controlled milestone)
```

The separation between **Approve** and **Activate** is intentional.

A malformed or unexpected upload must not be able to replace a live Lab or handbook simply because a Super User uploaded it.

## Source formats

Content Studio accepts:

- BIS package JSON
- DOCX
- PDF
- HTML
- Markdown
- ZIP

DOCX, PDF, HTML, Markdown and ZIP sources are valid archival/editorial inputs but currently receive `REQUIRES_ADAPTER`. They must be converted to a BIS package before learner activation.

BIS package JSON can be structurally validated and become `READY`, but it is still not automatically published into the learner runtime.

## Learning-module package

A learning package carries:

- identity: code, title, version;
- schema version;
- linked Lab code where applicable;
- one or more delivery editions;
- ordered pages;
- authored HTML/content blocks.

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

## Deliberate v1 boundary

v1 lets the Super User **load, catalogue, version, validate and approve** future content.

It does not yet dynamically activate arbitrary content into the production learner runtime. That is the next engineering boundary because activation must also update:

- route/runtime registration;
- learning release records;
- Lab/evidence namespaces;
- assignment compatibility;
- cohort compatibility;
- rollback/version pinning.

That activation layer should consume approved Content Studio packages rather than introduce another manual code path.
