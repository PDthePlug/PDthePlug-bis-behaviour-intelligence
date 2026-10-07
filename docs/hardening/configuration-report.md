# Staging and production configuration differences

## Current takeover comparison — 7 October 2026

The earlier baseline below is retained as release history. Current exact inventories are `staging-platform-takeover-20261007.json`, `production-platform-takeover-20261007.json` and `platform-takeover-differences-20261007.json`.

| Area | Staging | Production | Current disposition |
| --- | --- | --- | --- |
| Relations / functions | 102 / 188 | 119 / 213 | Common definitions match except `private.can_write_commercial`; six CRM relations and two private functions belong to unmerged PR136 and are not promoted |
| Policies / triggers | 126 / 35 | 144 / 36 | Sixteen staging commercial additions include fourteen policies/two triggers; production additions remain preserved |
| Indexes / constraints | 331 / 393 | 389 / 464 | Staging has eighteen added CRM indexes/twenty-five constraints; production-only service definitions remain preserved |
| Schemas / extensions / role settings / buckets | 10 / 5 / 9 / 2 | Same | Definitions/settings match; source and evidence buckets remain private |
| Auth configuration | 243 settings inspected | 243 settings inspected | Six provider/origin differences enumerated with credential values omitted; production Google is intentionally enabled, staging Google disabled |
| Password minimum | 8 | 8 | Reviewed management change aligns existing signup/reset forms; current passwords are not replaced |
| Compromised-password protection | Disabled | Disabled | Enablement returned HTTP402 requiring Pro plan or above; billing was not changed |
| Auth return origins | Exact local callbacks; preview origins pending | Canonical www allowlist preserved | Staging-only frontend preview binding accepts only deployment-bound origins; production ignores it |
| Email delivery | Default provider; no custom SMTP; 2 emails/hour | Same | Delivered recovery requires a real inbox; no delivery is claimed for synthetic invalid-domain accounts |
| PostgreSQL | 17.11.0.002 | 17.6.1.166 | Read-only compatibility catalogue completed; backup/maintenance/rollback and owning-service review remain required |
| Agency/Companion services | Absent | 23 preserved additional relations | Associated definitions and grants inventoried; service owner remains unidentified after user reports being unsure; no consolidation or deletion |
| Production verification accounts | Separate 24 existing staging fixtures | 11 new authorised QA accounts; 6 synthetic learners | Normal application enrolment/role access; no staging records copied; original 73-table count/fingerprint comparison passes; exact new structural mapping is separately recorded |

The current published production definitions are also inventoried independently in `production-takeover-metric-register.json`: 32 Labs, 20 bound computed fields, and 135 explicitly UNBOUND indicator entries across 29 older version-1.0 Labs. The canonical/current-compiler register contains 283 calculations and no unbound indicators; it must not be used as evidence that production has those bindings. No accepted artifact or learner version is replaced to equalise the two. METRIC-LIVE-BINDINGS records the required governed source/version review.

The four temporary Edge endpoints retain their inspected closed implementations (HTTP410), versions, body hashes and JWT verification settings. Current source retrieval confirms the closed response bodies. The security advisors still flag the same four intentional authenticated definer functions and disabled compromised-password protection; role/owner boundaries remain required, not waived by the inventory.

`auth-takeover-setting-review.json` records applied settings and the provider rejection. `auth-configuration-differences.json` gives every differing setting. `postgres-patch-compatibility-20261007.json` records compatibility checks without claiming an upgrade. `dns-takeover-verification-20261007.json` records the user's correction report alongside fresh resolver results: both public resolvers still return the two old website-builder addresses, and apex deep links still return 404. Canonical www is healthy.

These provider settings are managed configuration rather than SQL schema migrations. Existing append-only publishing/scope migrations remain applied and preserved. None of the current presentation changes requires another database migration. Production-only services and staging's unmerged CRM changes must not be equalised by copying data, deleting objects or installing unreviewed definitions.

Observed 2026-10-06. The baseline queries were read-only configuration inventories; no production data was copied, edited or replaced. A subsequent workflow regression required the append-only migration below.

| Area | Staging | Production | Disposition |
| --- | --- | --- | --- |
| Supabase project | `lbmhkddrkhtmkcvfmumd` | `swmhsqivqaqwovojbceo` | Distinct healthy projects, both eu-west-1 |
| Postgres | 17.11.0.002 | 17.6.1.166 | Platform patch difference recorded; production upgrade remains a separate provider operation requiring management access and compatibility review |
| Non-system schemas | 10 | 10 | Same schema set |
| Tables/views | 96 | 119 | Common definitions/options/RLS/ACL hashes match; 23 preserved production-only Agency/Companion/private relations |
| Functions | 186 | 213 | Common definitions, definer settings, search paths and ACLs match; 25 Agency/Companion additions and two provider-managed Realtime functions in production |
| RLS policies | 111 | 143 | Common policy definitions/roles/checks match; 32 production-only policies accompany production-only relations |
| Triggers | 33 | 36 | Common trigger definitions/enabled states match; three preserved production-only triggers |
| Constraints | 368 | 464 | Common definitions and validation match; 96 production-only constraints |
| Indexes | 313 | 389 | Common definitions match; 76 production-only indexes |
| Extensions | 5 | 5 | Same names and versions |
| Database role settings | 9 entries | 9 entries | Same settings |
| Schema grants | `private`: postgres UC, authenticated U | Also anon U on `private` | Production Agency public RPC helpers require separate review. USAGE does not confer table access or function EXECUTE; common BIS policies and EXECUTE grants match and were preserved |
| Content Studio bucket | Private, 25 MiB, permitted source document/JSON formats | Same | No settings change |
| Evidence bucket | Private, 3 MiB stored JPEG | Same | Authenticated staging owner upload/removal/refresh and cross-user read/write denial verified |
| Edge endpoints | Two temporary endpoints, both return 410 | Two temporary endpoints, both return 410 | Bodies, JWT settings and hashes inspected; no active provisioning/publication capability |
| Preview binding | Before this pass, old branch-specific bindings only | Not applicable | Added global preview staging URL/public key and production acknowledgement false; retained existing branch scopes |
| Production binding | Not applicable | Production URL/public key, production acknowledgement | Preserved; live deployment identity confirms production project and staging certification disabled |
| Auth sign-in | Dedicated synthetic accounts sign in successfully | Public sign-in/redirect surface available | Complete provider, redirect, SMTP, session and password configuration remains unverified without management access |

`staging-platform-configuration.json`, `production-platform-configuration.json` and `platform-differences.json` give the complete inventory and exact named differences. Function/view/table definitions are fingerprinted rather than disclosing internal bodies. `staging-configuration.json`, `production-configuration.json` and `configuration-differences.json` retain the BIS/Storage-focused comparison and migration/advisor observations. Migration identifiers/timestamps differ between environments; common effective definitions match. Identical schemas alone do not establish identical Auth settings or publishing state.

## Published content and compiler differences

Before certification, staging's core Labs were static HAB 4.5.2, DEC 4.2.1 and MON 4.2. Production had dynamic HAB 4.5.3, DEC 4.2.2 and MON 4.2.1 (compiler 7), plus RSK/IDN 1.0 prepared by earlier compilers. The current repository compiler is version 8. Previously published production artifacts remain immutable and accepted; they were not silently recompiled.

New checksum-verified canonical Volume 1 staging candidates were prepared through Content Studio's normal authenticated APIs and private source uploads: HAB 4.5.4, DEC 4.2.3, MON 4.2.2, RSK 1.0 and IDN 1.0. All nine stages across all five candidates were inspected at 360, 430 and 1280 pixels. HAB, MON and RSK received a recorded final check and explicit staging publication. DEC and IDN remain unpublished pending source repetition review. Prior source versions and activations were retained.

DEC repeats “My perceived options” between Hook and Mapping. IDN repeats “The identity I am building” between Hook and Pattern/Prediction. These are separate authored fields; their purpose must be confirmed rather than silently removing one or asserting that repetition measures change. Fourteen of the 32 canonical-source Lab preparations have editorial REVIEW findings; the metric register lists them. This is not a claim that accepted production content is invalid, and it is not authority to republish it.

## Advisor review

Both projects report leaked-password protection disabled. Remediation: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). It remains open because the current connector cannot read or update Auth management configuration.

Both projects flag four authenticated SECURITY DEFINER RPCs: `active_bis_lab_runtime`, `learner_bis_lab_runtime`, `bis_portfolio_lab_artifacts`, and `sponsor_cohort_question_patterns`. These intentionally serve published package metadata, owner/enrolment-scoped historical package metadata or authorised aggregate patterns. Their common definitions/ACLs match; privacy and role checks are covered by the database acceptance suite. Retain the warning as an explicit exception for review, rather than disabling a necessary RPC or weakening its access checks. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Required migration decision

The baseline common definitions matched. Actual publication review then exposed a functional defect: explicitly unpublishing a Learning module disabled edition activations but retained its older global static fallback. `supabase/migrations/20261006120007_hardening_learning_static_offline.sql` replaces only `bis_transition_content`, preserving its invoker security, empty search path, permissions, role checks, atomicity and preview fingerprint gates. Explicit unpublish now closes both activation families; normal edition publication continues to preserve fallback availability for other editions. Source versions, artifacts, releases and response histories are retained.

The regression failed against the prior function and passed with this migration; the ten database lifecycle/access tests pass. The reviewed migration is now applied to staging and production. Post-install full inventories confirm only the intended function changed, with identical definition, invoker security, empty search path and execution ACL. The baseline snapshots predate this intentional one-function difference. See `migration-review.md` for verification and recovery. No data is copied between environments, and production-only service relations/grants are preserved.

The unresolved provider patch, Auth configuration and production-only service review remain visible in the open findings. Configuration certification is not complete.

## Retained Learning deployment correction

The protected Vercel preview exposed a runtime self-fetch failure: static Learning requested its own public asset without the preview protection cookie and received an SSO HTML page. The correction reads the exact trusted deployment files directly, and the release build now asserts all 15 accepted editions are present in the serverless file trace. It changes no content or database records. Failed learning retries now preserve the current module/page, and the error paragraph meets contrast on its actual background.

Learning HAB 1.6 was prepared in staging from the accepted 1.4 packages, with all 13 page identities/order/text relationships and ten touchpoints verified in three editions. Only void-element serialization and the existing 20,000-character response limit differ. 117 actual preview states passed after shared-shell corrections. Normal fingerprint-bound sign-off/approval/publication, first-edition rollback denial, whole-module unpublish and exact-version republish passed; old sources, workbook responses and progress were retained. Production accepted publications remain unchanged.

## Programme-owner configuration correction

An actual assigned-owner decision save exposed a second baseline defect: the validation SELECT could not see its own group metadata. The append-only `20261006123109_hardening_programme_owner_cohort_read.sql` adds one exact-cohort SELECT policy using the existing decision-owner scope helper. It leaves cohort writes, participant detail, private responses and existing facilitator/sponsor controls unchanged. Both owner-positive regressions fail before the policy; six positive/negative scope tests pass after it. The policy is applied to staging and production after green PR #128 checks. Full inventory comparison confirms only the intended SELECT policy was added; fifteen production source/evidence/history table counts were preserved. Baseline policy counts above predate this intentional addition.

## Live host verification

The canonical `https://www.bisportal.online` serves BIS Production and reports staging certification disabled. Anonymous staff/commercial/Studio APIs deny access. The apex domain has mixed registrar A records: Vercel 216.198.79.1 and GoDaddy website-builder 76.223.105.230 / 13.248.243.5. It can serve a correct redirect or a non-BIS page/404 depending on the address. Vercel's 308 project redirect is correctly configured; registrar correction and propagation checks remain open in CONFIG-DNS. The user is removing only the two website-builder A records. The old short `bis-behaviour-intelligence.vercel.app` host is not an active alias and returns DEPLOYMENT_NOT_FOUND; the actual team-scoped Vercel alias is protected. Public verification uses the canonical www origin.
