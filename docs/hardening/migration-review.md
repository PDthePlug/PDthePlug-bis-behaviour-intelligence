# Explicit Learning unpublish recovery

Migration: `supabase/migrations/20261006120007_hardening_learning_static_offline.sql`.

An older global STATIC activation remains a legitimate fallback while individual editions move to governed packages. Before this correction, whole-module UNPUBLISH closed only the edition activations. The catalogue and runtime could then expose the older fallback, contrary to the operator's explicit action.

The correction replaces only `public.bis_transition_content(text,text,text,text)`. Its UNPUBLISH branch collects both activation families, deactivates their active rows and updates the affected version availability using the existing transaction. It does not modify rows when the migration is installed. Subsequent explicit content operations remain authorised, atomic and audited. Normal publishing, exact predecessor rollback and fingerprint-bound republishing retain their existing contracts. No content, learner, response, storage or production fixture rows are inserted or replaced by this migration.

Security remains invoker-based, with empty search path and the existing authenticated SYSTEM_ADMIN check. CREATE OR REPLACE retains the prior EXECUTE ACL. Review compares the effective function definition and ACL after both installations; all unrelated common schema hashes must remain unchanged.

The new database regression starts with a retained global static activation plus a published School edition. It verifies that fallback remains available before explicit unpublish, both families go offline afterward, old and new source/artifact versions remain, and republishing the reviewed School edition does not silently re-enable the old global activation. The regression fails before the correction. All ten content-publishing database tests pass after it, including unauthenticated/wrong-role denial, stale artifact rejection, transactional failure, edition preservation and exact rollback edges.

Applied to staging for normal-API lifecycle verification. Production application is pending reviewed PR and green verification; production publication/data state must not be modified merely to test the migration.

Recovery, if required: add a new reviewed forward migration restoring the prior function body from `20261004111602_atomic_content_publication.sql`; retain the same signature, security and ACL. This restores the old operation behaviour, not activation records. Do not automatically re-enable content, delete history or roll the database back wholesale. Any intended content restoration must use a separately authorised normal governed publication operation.

## Programme-owner group metadata

Migration: `supabase/migrations/20261006123109_hardening_programme_owner_cohort_read.sql`. Actual staging owner testing found that a correctly scoped owner could view aggregate reporting but could not save a decision: the handler validates an active group through a metadata SELECT, and the existing cohort policy admitted only administrators/facilitators.

The migration adds one authenticated SELECT policy using the existing `private.can_manage_programme_decisions(id)` helper. That helper requires an active COHORT assignment for the exact group and resolves email or linked application identity. The policy does not change the facilitator helper, cohort writes, membership access, responses, private reflections or sponsor permissions. No records or existing definitions are modified.

Both owner-positive regressions fail against the previous policies; all six actual-policy database regressions pass after the addition. They cover own-group decision insert, linked identity, foreign-group denial, revoked/global-only/unauthenticated/anonymous denial, no cohort writes or participant-detail access, and preserved administrator/facilitator scopes. It is applied to staging pending reviewed production release. Recovery is a forward migration dropping only `cohorts_programme_owner_read`; do not remove prior policies or delete decisions.
