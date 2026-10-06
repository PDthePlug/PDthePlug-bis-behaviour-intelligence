# Reader tables and record meaning

Identity and Attention Day 10 encoded the “Element / My Answer” profile as an unpaired paragraph inventory. The shared renderer now preserves those authored labels in a semantic two-column table, with column and row headers. Existing resolved values and their source context remain visible, including zero and negative values. A single caption explains unavailable values. The renderer creates no answers, fields or guessed calculations, and repeated enhancement does not duplicate the table.

The shared reader also restores authored list markers and describes reference-only response controls accurately. Editable saving, error and retry status retain priority. The restored centred Menu is preserved.

Facilitator participant detail now describes saved records: opportunities recorded, experiment start recorded and Lab marked complete. It no longer treats counts as proof of repeated testing or Lab completion as completion of the whole learning cycle. Unavailable Universal counts do not trigger a claim that the learner has not started. The summary states its limits without exposing private learner responses.

The application revision `9eb62ae135246137f1fd6424ebdf2d75d25d0ab0` passed full `npm run verify`: 633 acceptance and 231 browser tests, lint, TypeScript, source audit, optimized build and retained-package trace. Additional audit-script lint passed. Verification is recorded in `reader-document-verification.json`. All six accepted profile source variants have browser checks at 360, 430 and 1280 pixels. Read-only actual staging checks cover Identity and Attention emerging-adult reference pages, selected facilitator detail and 33 representative Learn/Lab/facilitator/sponsor states. Affected profile and participant-summary regions were manually inspected. The original 5,957 controls across 195 source variants and all 15 source packages are unchanged.

Presentation recovery does not supply the absent approved narrative/value/unit binding contract for these profile rows. That remains CONTENT-PROFILE-BINDINGS. Other exact pages, populated live Lab versions, assigned-facilitator variants, production roles and Auth provider configuration remain explicitly open. This batch does not complete the broader hardening pass.

PR #133 merged after exact-head CI and 42 protected-preview states passed. The merge is READY on the canonical www alias and nine public live states passed. Temporary preview access was revoked. Full certification and authenticated production roles remain open; see reader-document-verification.json.
