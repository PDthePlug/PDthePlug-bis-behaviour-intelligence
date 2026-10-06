# Verified correction release

Full hardening certification remains ongoing. [PR #127](https://github.com/PDthePlug/PDthePlug-bis-behaviour-intelligence/pull/127) contains the application corrections, append-only publication migration and complete audit register. Its final release evidence will be recorded in the PR after green checks and live verification; this document does not predeclare those outcomes.

Base: `d8ca307ae455024b5816240d4db08f0dddd6bf73`. Application correction commits: `b0aee73`, `75bf471`, `9aa717e`, `6835a04`, `e6c3c2e`, `958e2cd`, `f9ff382`. Branch: `hardening/production-readiness-20261006`.

The 958e2cd Vercel preview was READY and bound to staging. Forty-two actual authenticated/public states at 360/430/1280 passed except six repeated retained-Learning requests: their server self-fetch received the protected preview's SSO page, and the resulting error paragraph also failed contrast. f9ff382 corrects that deployment dependency and retry/contrast behavior. Final preview verification must use the new deployment, including an unchanged retained static module; publishing the HAB test candidate cannot substitute for verifying static fallback.

The latest full verification before the artifact correction passed 620 acceptance checks and 162 browser tests. Final `npm run verify` is running with the additional static-file regression, built-artifact check and same-module Learning retry journey. Do not merge on an earlier revision's result.

Actual staging proof includes 162 audited page/role/size states; 135 Lab preview states; 117 clean Learning preview states; 20 completed full Lab enrolments with 340 normal-API saves; owner photo upload/refresh/removal and cross-user denial; explicit sharing/review/revocation and sponsor PDF/CSV privacy; 15 module/edition response/check/text-size refresh journeys; governed Lab rollback/unpublish/republish; and all-three-edition Learning publish/unpublish/republish with retained source/response/progress data. These are synthetic software verification fixtures, never programme outcomes.

Before release: final checks green on PR HEAD; final protected preview review; reviewed one-function migration applied to production; both environments' effective function/ACL verified; authorised merge; READY production deployment matches merge SHA; live origin/redirect/security/backend identity and public mobile/desktop pages verified. Authenticated production journeys require securely bound existing approved accounts, and cannot be replaced by staging fixture credentials.

Unresolved Auth binding/provider settings, delivered recovery, platform patch/service differences, editorial candidates, customer-language variants and role/state coverage remain in `open-findings.md` and the route register. None is marked complete by this release.
