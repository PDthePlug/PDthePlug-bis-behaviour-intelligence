# BIS Content Compiler + Runtime Activation v1

## Product rule

A BIS learning module is **one version with three required editions**:

1. `school`
2. `emerging_adult`
3. `workplace`

No learning-module version may compile or activate with only one or two editions. The three editions are versioned, approved, activated and rolled back together.

Labs do not use delivery editions. A Lab version has one executable Lab package.

## Controlled pipeline

```text
Create draft
   ↓
Upload required source slots
   ↓
Compile
   ↓
Validate
   ↓
Approve
   ↓
Activate
   ↓
Learner runtime
```

For a learning module, the upload stage contains three distinct source slots. Compilation produces three immutable runtime artifacts:

- `learning:school`
- `learning:emerging_adult`
- `learning:workplace`

Activation creates one published `content_release` for each edition. The learner's existing `delivery_edition` determines which artifact Programme Player loads.

## Learning runtime contract

Each edition compiles to the same Programme Player schema and therefore keeps the same BIS learner shell and interaction rules.

Every edition must contain the 13 programme positions in canonical order:

- Welcome
- Day 1
- Day 2
- Day 3
- Day 4
- Day 5
- Weekend
- Day 6
- Day 7
- Day 8
- Day 9
- Day 10
- Certificate

The compiler:

- verifies content code, version and edition;
- assigns/validates stable `CODE.PROGRAMME.*` step IDs;
- assigns missing learner-response bindings to authored textareas;
- enforces the `CODE.WB.*` response namespace;
- rejects duplicate response IDs;
- rejects executable HTML;
- fingerprints the compiled artifact with SHA-256.

The handbook reader still applies the universal learner interaction hardening after load, including generated response spaces for uncovered questions and collapsed answer keys.

## Source formats

Content Studio can retain BIS JSON, DOCX, PDF, HTML, Markdown and ZIP source files.

Learning-module compilation is deliberately deterministic and now includes approved source adapters:

- **BIS JSON** — compiled directly;
- **DOCX** — extracts authored Word paragraphs/tables and requires the 13 canonical programme headings;
- **PDF** — extracts text from text-based PDF streams and requires the 13 canonical programme headings;
- **HTML** — preserves safe authored blocks and rejects executable markup;
- **Markdown** — converts authored headings/paragraphs into the programme contract;
- **ZIP** — accepts an edition JSON package or DOCX source inside the archive.

Scanned/image-only PDFs are rejected rather than guessed. Every adapted source must still produce the same 13-position BIS programme structure before it can activate.

Universal Lab activation remains stricter because Lab evidence semantics must not be inferred from prose: a Lab source must be a Universal Lab JSON package, or a ZIP containing that JSON package.

Reference template: `content/templates/learning-module.package.example.json`.

The template represents **one edition**. The same code + version must be supplied separately for School, Emerging Adult and Workplace.

## Universal Lab runtime

A newly activated generic Lab uses:

- `schemaVersion: universal-lab-v1`
- `runtimeProfile: UNIVERSAL_V1`
- exactly nine investigations;
- at least one learner prompt in every investigation;
- prompt IDs inside the Lab's own `CODE.*` evidence namespace.

The compiled package is rendered by the existing `LabInvestigationFrame`, so a newly loaded Lab does not create a new header, progress system, navigation model or responsive layout.

Universal v1 prompts support:

- text;
- integer;
- boolean;
- categorical choice;
- optional sensitivity class;
- required/optional response state;
- Prefer not to answer / PASS.

This generic runtime records private, versioned evidence and preserves corrections. Bespoke Labs with specialised experiment calculations can continue using dedicated runtimes until their calculation protocol is expressed as a future declarative runtime profile.

Reference template: `content/templates/lab.package.example.json`.

## Activation

Activation is permitted only when a version is:

- compiled;
- structurally valid;
- approved;
- runtime-ready.

For learning modules, activation additionally verifies that all three edition artifacts are present.

Activation:

1. marks the current active version as superseded;
2. retains its artifacts for rollback;
3. makes the approved version the active dynamic runtime;
4. publishes three edition-specific learning releases where applicable;
5. marks the version `PUBLISHED + LIVE`;
6. records an audit event.

Dynamic learning routes are `/handbooks/{code}`.

Dynamic Universal Lab routes are `/labs/{code}`.

The catalogue overlay uses the runtime activation table so known BIS catalogue modules become Open without editing the application for each version.

## Rollback

A dynamic activation never deletes the previous version.

Rollback changes the active pointer back to the preceding runtime version. For learning modules it also restores the preceding three edition-specific `content_releases` together.

This means a School edition can never roll back independently from Emerging Adult or Workplace within the same module version.

## Security

Raw source files remain restricted to `SYSTEM_ADMIN`.

Compiled artifacts are stored under the private bucket's `runtime/` prefix. Authenticated learners may read only compiled runtime artifacts; they cannot read `sources/`.

All compile, approval, activation and rollback operations remain `SYSTEM_ADMIN` actions and are audited.
