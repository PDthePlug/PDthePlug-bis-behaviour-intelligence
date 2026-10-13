# Measurement and comparison implementation

This pass implements measurement-readiness review in Content Studio, matched-comparison coverage in programme reports and PDFs, and current-consent eligibility in the protected reporting functions. It does not publish new curriculum, infer rate denominators from day counts, or widen access to private learner responses.

## Source-to-calculation boundary

The supplied manuscript defines opportunity-based adherence. Current compiled Volume 1 sources often capture a Boolean daily action check and a count of answered day rows. These are different denominators. A registered BEI field is not automatically a valid numeric measure, and a copied profile value is not a new observation or assessment.

`auditMeasurementReadiness` inspects the source field graph only. It distinguishes numerical calculations, projections that reuse answers, source-only indicators and unresolved rate formulas. Cyclic or missing calculation bindings are blocked in the audit. An authored rate requires explicit numerator, denominator and formula bindings. Prediction inputs remain predictions. The audit does not grant consent or certify a behavioural construct.

Content Studio displays these findings when preparing a Lab and in the read-only Volume source audit. Existing published artifacts are not rewritten to retrofit a different measurement definition. New manuscript editions still require explicit version-specific binding and governed publication.

## Comparable check-ins

The programme model retains the cohort population, paired participant count and count without a comparable pair for each measure. Samples may overlap and are never added into a unique-person total. A small paired cell or complementary cell suppresses the entire comparison, including averages and differences. Zero pairs, unavailable inputs and privacy withholding remain distinct states.

The results overview and PDF show the comparison coverage beside the existing self-report graphics. Learning detail directs readers to that canonical comparison instead of repeating a second “growth” panel. Self-report change does not establish competence, transfer or programme causation.

The API strips withheld averages before serialization. It withholds all aggregate payloads if outcome and evidence-flow populations disagree or either report is suppressed. This protects the network response as well as the rendered dashboard.

## Protected database scope

Append-only migration `20261013084751_programme_learning_consent_and_comparison_scope.sql` aligns the existing private outcomes, deeper-analysis, learning-summary and organisational-learning functions with current active learners and the latest granted product consent. Response and experiment calculations require a matching, non-withdrawn Lab enrolment and retain the existing Lab version filter. Small baseline and paired complements are withheld in the database.

The public RPC boundary remains security invoker. The existing scoped private functions retain their guarded aggregate responsibilities. The shared membership helper is private and cannot be invoked directly by authenticated or anonymous clients. Original evidence is unchanged. The migration has only been exercised locally; it has not been applied to a live project.

## Accepted presentation contract

PR #152 records Pride's explicit request to restore the centred floating Menu and numbered Handbook/Lab cards. The remaining browser failures expected the superseded bottom strip and removal of card headers. Updated checks preserve offline/failed-publication handling, unavailable titles without links, module numbering/icons, opaque actual Menu controls, viewport reachability, centre position, keyboard focus and Escape recovery. No product interface was reverted and no test timeout or skip was added.

## Remaining scope

Facility-wide pooling needs an explicit organisation/facility boundary and participant deduplication; authorised cohort rows alone do not establish either. Editions and Lab versions must not be pooled by indicator number. Activity-level manuscript mappings, new authored rate bindings, assessment criteria and sustained-transfer capture remain governed source work.

Live deployment requires isolated staging verification of the migration and authenticated API flows. Staging capacity remains unresolved; neither BIS Production nor ThePlugOS was paused for this task.
