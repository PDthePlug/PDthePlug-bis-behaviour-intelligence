# BIS measurement release

This release is verified on BIS Staging. Production is unchanged. The production migration inventory already includes `facilitator_development_projection`; that existing migration must not be reapplied. The two new append-only migrations below are absent from the production history.

| Migration source | SHA-256 |
|---|---|
| `20261013084751_programme_learning_consent_and_comparison_scope.sql` | `9e6948dcfe4d403cb5b355a972226c93215015d25729a025287e6377d56d66d9` |
| `20261013111400_programme_learning_private_response_exclusion.sql` | `b201a65c95d9cde15adb4ed6da040ca495dbf6153efc787388c89f4792e9f2d2` |

## Controlled rollout

1. Apply the current-consent/comparison migration, then the P3 exclusion migration to BIS Production. They replace guarded private reporting functions and add a private membership helper; they do not rewrite learner records or change curriculum activations.
2. Confirm the two history entries and the reporting RPC/helper grants through metadata-only reads. Do not inject QA records or run synthetic learner journeys against production.
3. Merge PR #161 at its reviewed head and allow the existing production deployment pipeline to release the application changes.
4. Confirm deployment/backend identity and the release build status. Keep private records and QA credentials out of release logs.

Hosted staging verification covers real Auth, API permissions, PDF, read-only source audit, three supported browser widths and rollback privacy/scope tests. The current combined-head repository result is recorded in `BIS_REPORT_CERTIFICATION.md`.

The prior private function definitions remain available in the earlier append-only migration sources for an explicitly reviewed reversal. A reversal must not silently restore the P3 exposure or remove current-consent checks; prefer a forward correction if a release defect appears.

No automatic curriculum publication is included. Authored rate bindings, assessment criteria, edition equivalence and sustained-transfer capture remain governed source work. Facility pooling still needs an explicit facility boundary and unique-person handling.
