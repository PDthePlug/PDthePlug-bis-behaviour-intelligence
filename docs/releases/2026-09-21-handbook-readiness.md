# Learning handbook readiness repair — 21 September 2026

Scope: the five supplied learning handbooks, workbook reliability, completion navigation, table semantics and responsive learner/staff layouts. Volume 1 and 2 Lab manuscripts are explicitly excluded. Existing executable Lab content and scoring are unchanged.

## Requirements and source trace

| ID | Requirement | Authority | Implementation |
| --- | --- | --- | --- |
| HB-01 | Open supplied handbooks without sequential locks | User instruction; authored Handbooks 1–5 v13 HTML | HAB, DEC, MON, IDN, ATT open directly in Learn; three editions and 13 positions each |
| HB-02 | Preserve authored wording, sequence and existing answers | Frozen Habit 1.4 payloads; supplied v13 HTML | Habit response IDs retained exactly; new namespaces separated; manifest records hashes and counts |
| HB-03 | Restore meaningful tables | Authored table text and explicit row/column labels | Importer reconstructs tables and asserts exact normalized cell text; mobile rows retain labels |
| HB-04 | Protect edits during saving and page changes | Reproduced race in production source | Revision-aware single-writer queue; pending fields carry their own page identity; bounded batches; explicit retry, document-wide navigation guard (including the shared menu/header), and unload guard |
| HB-05 | Failed saves must block completion | Reproduced completion-after-failure | Completion requires a successful flush, locks inputs during completion and retains visible error on failure |
| HB-06 | Preserve answers if a database batch fails | Existing response provenance/history model | SECURITY INVOKER RPC; transaction covers new revisions, supersession and audit; idempotent retries; active consent required |
| HB-07 | Explain what comes after completion | User journey request | Completed handbook and Habit evidence views link to the other supplied handbooks |
| HB-08 | Deliberate desktop and mobile layouts | User screenshots | Desktop reader with programme map beside content; mobile table cards, nine-step reflow, constrained report grids and wrapping staff controls; compact header, two-column mobile library, and profile label/value rows |

No claim that all 34 catalogue titles have supplied content. Remaining titles retain their unavailable state. Learning reflections do not become formal Lab measurements or certificates.

## Validation

- Existing acceptance suite plus content-integrity and behavioral save-queue regressions: 186 tests passed at initial implementation gate.
- Final implementation lint, TypeScript and all 186 tests passed. Vercel preview build is READY for commit `65a1f6a70dfbdf2ba13d7dee3103128e3a9f0f64` (deployment `dpl_8owvi3MbC8rE81LK8YKN9kmvvPrd`).
- Database integration checks ran as authenticated with existing RLS: current revision, superseded history, invalid-batch rollback and idempotent retry passed. Entire test transaction rolled back; zero synthetic response rows remain.
- Five handbook releases × three editions published. RPC is SECURITY INVOKER, anonymous execution denied.
- Browser fixture `/qa-handbooks` uses synthetic data and simulated network responses, is available only when VERCEL_ENV is preview, and returns 404 in production. It never reads or writes learner records.

## Browser verification gap

The preview access gate redirects the verification browser to Vercel sign-in. The connected provider's temporary access link also redirected to sign-in, and its protected-fetch helper returned HTTP 302 to SSO. No protection settings were weakened. Therefore phone/tablet/desktop screenshot matching, measured horizontal overflow, and browser-driven failure-path checks are **not verified**. Unit tests cover queue concurrency/failure/completion ordering; transaction tests cover persistence separately. This is a release with verification gaps, not full market-readiness acceptance.

## Recovery and limits

Roll back the application deployment to the preceding revision if needed. The database migration is backward compatible with the old Habit player; retain new releases and saved responses. Do not delete learner answers or revert expanded constraints after new handbook responses exist.

The wider launch audit remains separate: this release does not certify unresolved safeguarding, provider configuration, domain redirect, dependency or operational gates. Authenticated real-user UI journeys require a separate session; synthetic browser verification must not be represented as a real learner completing the programme.
