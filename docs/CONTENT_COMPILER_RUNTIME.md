# BIS Content Compiler + Publishing

## Product rule

A BIS Learning Module can have three delivery editions:

- School
- Emerging Adult
- Workplace

The three editions belong to the same BIS title, but they do **not** need to be uploaded or published at the same time.

Each edition is an independent publishing slot. If only School is ready, School can be prepared, previewed and published while Emerging Adult and Workplace remain unavailable for learners in those editions.

Labs use one shared interactive Lab experience rather than delivery editions.

## Publishing flow

```text
Choose BIS title
   ↓
Create version
   ↓
Upload or paste the content that is ready
   ↓
Prepare preview
   ↓
Preview in the real learner experience
   ↓
Complete final check
   ↓
Approve for publishing
   ↓
Publish
```

Uploading never makes content live by itself.

## Existing BIS catalogue

The 34 BIS titles are preloaded in Content Studio. Each title has:

- a Learning Module entry;
- a Lab entry;
- a link between the Learning Module and its corresponding Lab.

New catalogue entries are only needed when BIS grows beyond the existing 34-title series.

## Learning Module import

Content Studio accepts:

- Word documents (DOCX)
- text-based PDFs
- pasted text
- Markdown
- safe HTML
- BIS JSON
- ZIP packages

If a document already contains the canonical Programme Player positions, those positions are preserved.

If an authored document is structured differently, the importer preserves the authored order and groups the document into the standard Programme Player journey for preview. No wording is rewritten by the importer. The Super User reviews the result before publishing.

The learner reader still applies shared BIS interaction rules, including answer spaces for questions that do not already have them and collapsed answer keys where an Answers section is present.

Scanned or image-only PDFs are not guessed. They must first be converted to selectable text.

## Learning edition publishing

Prepared learning artifacts use these keys:

- `learning:school`
- `learning:emerging_adult`
- `learning:workplace`

Only editions included in a version are prepared and reviewed.

Publishing creates an edition-specific active pointer. Updating School does not replace Emerging Adult or Workplace. The learner's saved delivery edition decides which published content they receive.

If no content is published for that learner edition, the library continues to show **Coming soon**.

Existing built-in BIS content remains available as a fallback until an edition-specific replacement is deliberately published.

## Lab import

Content Studio accepts a structured Lab from:

- Word documents (DOCX)
- text-based PDFs
- pasted text / Markdown
- safe HTML
- BIS JSON
- ZIP packages containing JSON or DOCX

For document-based Lab import, the source must contain nine clearly marked sections such as:

- Investigation 1
- Investigation 2
- …
- Investigation 9

The importer preserves the authored section content, detects learner questions and converts them into the shared Universal Lab experience. Questions remain editable only through a new source version; learner responses are stored separately.

If the importer cannot confidently identify all nine investigation sections or any learner questions, it stops and explains what needs to be fixed instead of inventing missing content.

## Runtime contracts

Learning Modules render through Programme Player and keep the canonical learner shell.

Universal Labs render through `LabInvestigationFrame` and keep the shared nine-investigation navigation and responsive layout.

Before a document-based Lab is compiled, Content Studio runs a capability preflight. Simple Labs can remain on Universal V1. A Lab that contains richer behavioural-runtime features — such as derived measures, a real multi-day experiment, repeatable evidence rows or a Behaviour Profile projection — is upgraded into the declarative Universal V2 contract. Preparation fails if the richer structure cannot be represented safely; it never silently flattens the Lab into generic prompts. Risk Lab is the first acceptance specimen for that V2 contract.

Raw uploaded source files are private to the Super User. Learners receive only prepared runtime content.

## Final check before publishing

Prepared content must be opened in the actual learner renderer before publishing.

For a Learning Module, the Super User previews only the editions included in that version. For a Lab, the Super User previews the Lab experience.

The final check covers:

1. wording and content order;
2. navigation;
3. answer spaces and privacy wording;
4. phone and desktop layout;
5. learning-to-Lab handoffs and completion;
6. clear learner-facing language.

The sign-off is bound to the exact prepared artifact fingerprint. Replacing a source or preparing it again resets the review.

## Publishing safety

A version cannot publish unless:

- at least one relevant source was successfully prepared;
- the prepared content was previewed;
- the final check was completed;
- the version was approved;
- the signed fingerprint still matches the prepared content.

Publishing never deletes older source or prepared versions.
