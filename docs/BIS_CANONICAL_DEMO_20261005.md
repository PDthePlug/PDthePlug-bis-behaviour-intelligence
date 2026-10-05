# BIS canonical demo and learner runtime access — 5 October 2026

## Canonical demo lineage

PR #111, **Feature/bis demo evidence certification 20261004**, supersedes the PR #32 Leap9 seed contract.

The four PR #111 branch commits were not merged as a pull request, but the evidence-intelligence implementation they introduced was subsequently carried forward and extended on main through later evidence, reporting and Universal-runtime work. The canonical demo contract is therefore the PR #111 evidence-certification model, not the older production-only Leap9 SQL fixture.

The canonical synthetic demo is an engineering demonstration: twenty synthetic learners, one administrator and one facilitator; version-scoped evidence; deterministic evidence guidance; privacy-preserving staff/sponsor projections; and no claim of behaviour change or programme effectiveness. The old script that hard-coded `LEAP9-DEMO-HAB-20`, HAB 4.5.2 and the founder account is retired and now fails closed if executed.

## Production access incident

The learner UI was correctly rendering the 34-item catalogue shell but authenticated non-admin accounts could not see the same runtime state as SYSTEM_ADMIN.

Three independent defects combined:

1. `/api/runtime-catalogue` and `/api/runtime-content` read activation/version/artifact tables through the signed-in learner session, while those tables had SYSTEM_ADMIN-only read policies. Non-admin users therefore saw no active runtime metadata and the UI fell back to the old static catalogue, where only Habit, Decision and Money were marked open.
2. Most of the already-published Universal Lab artifacts use `artifacts/...` storage paths. The learner storage policy only allowed `runtime/...`, so those packages existed but could not be downloaded by a normal authenticated learner.
3. The compatibility resolver could prioritise an older STATIC HAB/DEC/MON enrolment. After those routes were consolidated onto the Universal player, returning a STATIC runtime made the Universal API reject the request even though a newer DYNAMIC version was live.

The runtime-access migration fixes all three without exposing drafts or source files. Authenticated users may read only ACTIVE activation pointers, PUBLISHED/LIVE version metadata and artifacts referenced by an active runtime. Storage access is likewise limited to objects referenced by an active published runtime. Historical enrolments and evidence are not rewritten or deleted; an old STATIC enrolment simply no longer blocks entry into the current Universal runtime.

## Availability boundary

The production content registry currently has active DYNAMIC Universal runtimes for 32 of the 34 catalogue Labs. Career Lab (CAR) and Failure Lab (FAI) have no published runtime version and therefore remain unavailable by design until governed source/version publication exists.

Learning availability is independent from Lab availability. Existing published learning modules continue to resolve through their active runtime/edition activation. A catalogue title with no published learning runtime remains unavailable rather than being fabricated from Lab content.
