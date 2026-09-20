# BIS production domain migration

Canonical origin: https://www.bisportal.online

## Scope and release identity

- Repository: PDthePlug/PDthePlug-bis-behaviour-intelligence
- Base commit: 1c51e0a49aa18d5d6c94ae02a7ff83fd70cfcd07 (current main)
- Vercel project: bis-behaviour-intelligence / prj_lJFrx8m2tjcEbSJ0sDYyTy0wSQVp
- Vercel team: team_0F7XVax56npxBWgjVdXMJj3V
- Supabase: BIS Production / swmhsqivqaqwovojbceo
- No database, identity, role, cohort or learning-content migration.

## Code changes

The production origin is defined once in lib/auth-redirect.ts. Vercel-generated environment URLs no longer control metadata or authentication links. The apex and former stable hosting alias receive HTTP 308 redirects, preserving paths and query parameters. The hosting project and deployment URLs remain infrastructure.

Signup, resend, Google and password recovery return through /auth/callback. Return destinations are validated as local paths, including backslash and control-character attacks. A noncanonical sign-in page moves the browser to www before initiating authentication so the PKCE verifier and callback use the same cookie origin.

Password recovery is now available from sign-in. The request goes to Supabase with the canonical callback and next=/reset-password. The reset page requires an authenticated Supabase user before showing the password form. Provider errors remain generic. The form does not expose whether an account exists. The user must open the reset email in the browser which requested it for this PKCE flow.

Metadata uses the canonical domain, with route-specific canonical links. Authentication endpoints disable caching, indexing and referrer propagation.

## Provider configuration required before production promotion

Read and preserve existing settings before editing. The Supabase project is also used by ThePlug2036; do not remove its authorised callbacks or rotate its credentials.

### Vercel

1. Verify www.bisportal.online belongs to this project and serves the intended production revision with a valid TLS certificate. An HTTP check already returned the BIS sign-in page, but the connected project's domain listing did not list the custom domain; resolve that discrepancy in the dashboard.
2. Attach bisportal.online and set its redirect target to www.bisportal.online with status 308. Verify ownership and use Vercel's actual suggested DNS values; do not guess DNS records.
3. Set production NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_SITE_URL to https://www.bisportal.online. Code deliberately does not derive public URLs from VERCEL_PROJECT_PRODUCTION_URL.
4. Preserve the Vercel project and aliases. Check existing deployment protection separately; domain redirects cannot run if hosting protection intercepts the request first. Do not weaken protection on private previews.
5. Deploy this branch only after provider settings below are ready.

### Supabase Auth

Site URL:
https://www.bisportal.online

Required production redirect patterns:
- https://www.bisportal.online
- https://www.bisportal.online/auth/callback
- https://www.bisportal.online/auth/callback?next=**

The query-only wildcard supports the validated encoded internal return path; it does not allow arbitrary paths or origins. Recovery uses:
https://www.bisportal.online/auth/callback?next=%2Freset-password

Keep necessary local development and other existing applications' callbacks. Review old BIS alias entries after the transition; do not remove shared project entries blindly.

Inspect confirmation, recovery, magic-link, invite and email-change templates. Preserve the normal Supabase verification mechanism, for example {{ .ConfirmationURL }}. Replace literal old BIS links, including footers. A template using {{ .SiteURL }} will pick up the new default. Do not replace the secure verification URL with a plain link to BIS, and do not switch to token-hash templates without a matching verification handler.

### Google OAuth

Edit the existing OAuth client used by BIS Production:
- Authorised JavaScript origin: https://www.bisportal.online
- Keep authorised redirect URI: https://swmhsqivqaqwovojbceo.supabase.co/auth/v1/callback
- Review consent-screen homepage and any existing BIS policy links for the new domain.
- Add bisportal.online to authorised domains if needed.
- Preserve client ID, client secret, scopes and other applications' authorised settings.

Google returns to Supabase first; Supabase then returns to the BIS callback. Replacing the Google redirect URI with the BIS callback would break this flow.

## Acceptance

Automated: local origin and return-path tests; callback success/failure/recovery with a stubbed provider; Next.js redirect tests; existing lint, acceptance and TypeScript CI; production build.

Live acceptance still requires:
- www TLS and intended production revision.
- Apex and old stable alias -> www with 308 and retained path/query, without a loop.
- Canonical and social metadata on sign-in and deep links.
- Email signup/confirmation and resend, Google sign-in, recovery/password update and sign-out with an authorised test account.
- Staff/learner destinations retained after sign-in.
- Expired callback handled safely.
- Email template links and organisation/facilitator invitations checked where applicable.

Existing cookies cannot migrate across unrelated hostnames. Users signed in on the former Vercel host will need to sign in again. Already-issued PKCE links tied to that host may need to be requested again on www; do not transfer session tokens through URLs.

## Status when prepared

- www serves the BIS sign-in page; its live social metadata still used the Vercel origin.
- The apex returned 502 and the stable Vercel alias returned 404 from the available HTTP probe. These are observations from this environment, not proof of a worldwide outage.
- Provider dashboards require sign-in; their configuration and email delivery have not been changed or accepted.
- Source changes are prepared separately from the production cutover.

## Recovery

If the code release fails, redeploy the preceding known-good production revision while retaining the custom-domain assignment. If reverting the canonical URL is necessary, coordinate code, Supabase Site URL/redirects and Google configuration together; do not leave mixed authentication origins. Permanent redirects may be cached, so a rollback does not instantly clear every browser's routing.

References:
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/passwords
- https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects
