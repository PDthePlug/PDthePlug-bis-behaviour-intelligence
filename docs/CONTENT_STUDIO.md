# BIS Content Studio

## Purpose

Content Studio is the Super User publishing workspace for the Behaviour Intelligence Series.

It is designed around the existing BIS catalogue rather than around creating technical packages.

The normal task is:

1. choose one of the 34 BIS titles;
2. choose **Learning module** or **Lab**;
3. create a version;
4. upload a Word/PDF file or paste the authored text;
5. prepare and preview it;
6. complete the final check;
7. publish when ready.

The **Add something new** control is reserved for future BIS titles beyond the current catalogue.

## Learning editions

A Learning Module has three possible editions:

- School
- Emerging Adult
- Workplace

They are separate publishing slots. A Super User may upload and publish only one edition without waiting for the other two.

Missing editions remain unavailable to learners in those editions. They do not block an edition that is ready.

## Labs

A Lab has one interactive runtime. The Super User can supply the source as Word, PDF, pasted text, Markdown, safe HTML, BIS JSON or ZIP.

Document import looks for the nine investigation sections and learner questions, then produces the same shared BIS Lab presentation used by other Labs.

## Plain-language workflow

Content Studio intentionally avoids exposing internal compiler and runtime terms in the normal UI.

Customer-facing states are:

- **In progress**
- **Ready to review**
- **Ready to publish**
- **Published**
- **Needs attention**

The internal database still keeps detailed technical status for safety and audit.

## Privacy and access

Content Studio is restricted to `SYSTEM_ADMIN`.

Raw source files stay private. Learners cannot browse or download the uploaded authoring files.

Preview mode does not save learner progress, workbook answers, Lab responses or evidence.

## Existing content

Current BIS content remains live until a Super User deliberately publishes a replacement.

For Learning Modules, edition-specific publication means a new School version can be live while Emerging Adult or Workplace continues using the existing built-in version, where one exists.

For a catalogue title that has never been published for an edition, the learner library shows **Coming soon**.
