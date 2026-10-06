# BIS personal settings and Portfolio repair

The production release of Profile and Settings queried four learner preference columns that had not been migrated. Both `/api/profile` reads and writes failed; home routing used the same API and consequently failed after sign-in.

The existing learner-personalisation migration was applied to BIS Production. Each column, default and not-null requirement was checked. Read-only transactions under `authenticated` verified that an existing learner could read their own profile and an unrelated identity could not read learner profiles. Existing RLS and ownership policies were retained. No learner responses or enrolments were edited.

## Product changes

- Profile uses compact navigation rows without decorative icons or explanatory paragraphs.
- My experience has its own `/experience` route and contains only the three context choices.
- Settings separates Appearance and Reading. Controls save against the account, restore from the returned profile and roll back presentation on failure. Load failures provide Retry; controls cannot write before load completes.
- The home router restores saved account preferences from its existing profile request.
- Portfolio uses the existing evidence-summary API to show Lab progress and measured results. Labs and response history start collapsed. Facilitator feedback appears within its Lab, while sharing and earlier submissions are disclosed separately.
- Learner review submissions are filtered to the authenticated learner even when that account also has staff roles. Source links, revocation, consent, result history and original responses remain available.
- Profile failures return private JSON errors. Updates reject invalid fields and zero-row saves.

## Domain finding

Vercel records both domain aliases and an apex-to-www redirect. In the inspection browser, `https://www.bisportal.online` opened BIS sign-in, while `https://bisportal.online` opened GoDaddy's Launching Soon page. Public DNS returned three apex A records: `216.198.79.1`, `76.223.105.230` and `13.248.243.5`. The www CNAME points to `f50a8927f70ca75d.vercel-dns-017.com`. The two parking A records explain the inconsistent destination. The apex routing could not be corrected through the available Vercel capabilities. Domain registration/DNS needs a separate check; application routing alone cannot redirect a request that reaches GoDaddy.

## Verification

API regression tests cover empty-server error handling, validation, owner-scoped writes, zero-row updates and signed-out access. Browser tests cover preference refresh, separate context navigation, failure recovery, Lab/result/response disclosure, sharing and revocation at 360px, 430px and 1280px.

The required release command is `npm run verify`, using isolated placeholder backend configuration for local tests. Authenticated production browser verification requires a signed-in browser session; no production QA identity was created.
