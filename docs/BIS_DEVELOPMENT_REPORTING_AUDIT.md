# BIS development reporting audit

## Scope and source

The owner supplied Volume 1 Bis handbooks.docx on 12 October 2026. The detailed question inventory and source extracts are retained in the private review artifact, not copied into this public repository. This audit concerns the canonical BIS application at baseline commit 125cde7, following merged PR 158.

The manuscript contains 30 handbook sections, 10 distinct Lab titles and 29 unique Lab/edition pairs. Time Workplace occurs twice; the section after Risk Emerging Adult is Time Workplace, not Risk Workplace. Identity and Trust are absent. The file is a sample of the 34-Lab catalogue, not a complete replacement for it.

The extraction located 300 baseline item occurrences (290 after removing the repeated Time Workplace baseline), 267 measure/formula references, 3,850 activity heading candidates and 10,018 candidate question/prompt lines inside those blocks. Activity candidates include repeated portfolio prompts, instructions and compound questions; these are not 10,018 independently validated assessment items. All 300 baseline rows have item-level curriculum relevance mappings. The remaining activity mappings are provisional and must pass content governance before use in scoring.

## Material findings

1. **Question number is not construct identity.** Workplace Habit has materially different baseline questions. Adult Money changes several questions and includes positively worded resource items. Families therefore include Lab and edition. Do not pool equivalent-looking item numbers or compare editions without an explicit equivalence review.
2. **Entry baseline is self-report.** The ten frequency rows describe reported experience; they cannot be summed into an overall maturity or risk score. Changing a decision, seeking advice, borrowing or feeling uncertainty can be appropriate to context. The source has no universal direction key or validated composite.
3. **The manuscript already supports useful calculations.** Adherence uses completed routines/pauses divided by eligible opportunities. Prediction Accuracy is 100 minus the absolute predicted-versus-recorded adherence difference. Zero opportunity is N/A, not 0%. Secondary rates often use completed pauses as their denominator.
4. **Names can overstate their numerators.** Resilience Recovery Rate counts pauses yielding resource clarity, Purpose Alignment Rate counts purpose clarity, Influence Direction Rate counts influence clarity and Leadership Presence Rate counts leadership clarity. Preserve authored identifiers, but display the actual counted event and denominator. None alone proves recovery, aligned behaviour or leadership performance.
5. **Transfer tasks are not automatically real-world transfer.** Day 9 can ask the learner to map another behaviour. That can support task-level transfer after review. It does not demonstrate independent sustained use outside the programme or continued use after the ten touchpoints.
6. **Private response content cannot become a staff profile by stealth.** School entry instructions say only the learner will see the response. Workplace handbooks explicitly exclude individual reporting to managers and HR. Derived behavioural labels could breach that intent even if verbatim text is hidden. The implemented facilitator view uses only the existing authorised structural projection; it does not classify private text.
7. **Duration needs editorial resolution.** The manuscript describes an experiment from Day 3 to before Day 8 as seven days, includes a weekend, and gives Day 1 60 minutes. Runtime must distinguish touchpoints from calendar experiment days. Do not compress the seven-day experiment into seven sessions or silently change authored durations.
8. **BEI labels repeat across Labs and editions.** BEI-03/05 references say that the Lab records them, but do not supply a universal cross-Lab scoring rule. BEI-09 is a private identity sentence. Missing universal definitions must not be filled with invented numeric scoring.

## What the application was doing

`lib/development-profile.mjs` constructed events with verified provenance from mapped metadata, assigned an explicit second-context flag from the task binding, and reused the generic progression model. The generic model could classify PLAN as APPLY and a learning-check submission as EXPLAIN without an assessment result. The cohort SQL migration could classify TRANSFER plus another class as stage 5 without a second-context verification field. These are structural record categories, not reviewed capability judgements.

`app/programme-outcomes-view.tsx` displayed a competency grid on the overview, repeated competency findings in the narrative, and rendered the same competency data again as charts under the programme-context disclosure. Other helper functions returned the same insight array for findings, organisational learning and decisions. Distinct screens often rephrased the same progress facts.

## Implemented change

- The facilitator API adds an evidence-class projection built from approved mappings and explicit active/non-private records. It deduplicates evidence IDs, preserves usable dates and ignores private values.
- The compatibility profile in that endpoint now says NOT_ASSESSED. It cannot transmit the earlier unreviewed ability claim.
- Individual detail shows a capability-by-evidence matrix, dated record history and a specific next facilitation question. Operational participation is collapsed.
- Cohort decoration explicitly marks structural-only evidence, uses task-record labels and removes inferred progression counts. A hidden/small/incomplete partition is withheld together with the related count, preventing subtraction from reconstructing a small cell in this projection.
- Programme overview groups each finding and graphic once: development evidence, starting points, change and practice, reviewed learning, support/decisions, then delivery. The full competency grid is reserved for its evidence drill-down.
- Comparable self-report graphics distinguish starting point from later check-in and keep the paired sample and limitation visible.
- The exported programme PDF consumes the same conservative report model. Its existing detailed layout remains; further editorial compression of the PDF is not completed in this change.

No database schema, live curriculum publication or production learner record is changed. The manuscript is not activated as new content. Existing role checks, consent checks, cohort scope and P3 exclusions remain in the database projection.

## Reporting contract to finish through governed publication

| Evidence | Calculation or interpretation | View | Gate still required |
|---|---|---|---|
| Baseline items | Item-specific category distribution; respondent denominator | Private learner and permitted aggregate report | Edition-specific runtime field binding and consent |
| Perceived control/confidence | Matched within-person pre/post change, same version and scale | Learner and aggregate paired plot | Confirm equivalent wording, timing and scale; report missing pairs |
| Authored learning checks | Correctness/criteria results, not submission count | Learner, shared review, aggregate distribution | Published answer keys or rubrics |
| Experiment observations | Opportunities, complete/partial/no action, no opportunity, missing; authored denominator | Learner and privacy-safe aggregates | Versioned links to the canonical observation fields |
| Prediction calibration | 100 − absolute percentage-point gap | Learner and paired aggregate | Same behaviour, window and opportunity denominator |
| Secondary Lab rates | Actual named event divided by completed pauses | Learner and aggregate chart | Lab/edition formula registry; no relabelled performance claim |
| Capability | Reviewed task criteria, rubric/version and assessor provenance | Shared assessment and aggregate criteria matrix | Explicit review, never an automatic promotion from record type |
| Transfer | Separate planned, task-demonstrated, real-world recorded and sustained follow-up | Learner, permitted facilitator and aggregate | Distinct context, action date, review/source and later follow-up |
| Programme effectiveness | Descriptive change plus coverage, missingness and delivery context | Institutional report | Causal impact requires an appropriate evaluation design |

The new experiment calculation helper encodes manuscript denominators and N/A handling and has regression tests. It is a tested reference calculation, not yet bound to every live Lab. Unpublished manuscript fields must not be guessed from similarly named live fields.

## Remaining implementation work

This is a bounded reporting implementation and forensic inventory, not a validated 34-Lab measurement system. Complete semantic field binding, activity-by-activity review, edition equivalence checks, authored assessment criteria, follow-up capture and governed publication for each updated Lab. Do not auto-publish provisional mappings or train a classifier on private reflections to fill the gaps.

Release requires the repository verification contract and an isolated staging check of the authenticated facilitator/cohort routes. Production is not a development backend. A draft pull request is the reviewable release unit until those checks pass.

## Verification recorded for this change

- 709 acceptance tests passed, including new evidence-class, privacy, invalid-date, duplicate-record and no-opportunity regressions.
- Lint and TypeScript passed.
- Canonical source audits and optimized production build passed using the repository's non-production harness configuration.
- `npm run verify` reached Playwright, but browser execution could not complete because Chromium and headless-shell downloads produced invalid archives. Browser assertions are not certified.
- BIS Staging was observed INACTIVE. No production learner data was used for testing, and no backend was resumed or changed.
- Authenticated API-to-database validation and responsive browser verification remain release blockers. Draft code must not be described as deployed or as a fully validated 34-Lab implementation.

## Follow-up: responsive reporting and certification

PR #159 was merged on 12 October 2026. Its original verification record above describes that change at submission, not a completed release certification.

The follow-up adds context visibility, immediate learner-switch isolation, unavailable-count handling, responsive evidence-table containment, full repeat-response partition suppression and a shared, non-repeating institutional PDF structure. The restored implementation passes 712 acceptance tests, lint, TypeScript, source audits, optimized build and 15 learning-package runtime checks. Focused evidence/calculation/PDF tests pass (15). The responsive reporting suite exercises 57 cases; full repository verification is still required.

BIS Staging restore was rejected because both available active-project slots are occupied. No production learner data was used and no active application was paused. See `BIS_REPORT_CERTIFICATION.md` for the verification scope and remaining gates. All activity-level mappings and the remaining unpublished Lab measurement bindings remain provisional.
