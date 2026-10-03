# BIS engineering environments

## Runtime

BIS uses Node.js **22.13.0 or newer**. The canonical repository version is in both `.nvmrc` and `.node-version`; run `nvm use` before installing dependencies or executing repository scripts. `npm install` and every supported run, check, build, and test entry point execute the runtime preflight and stop with a human-readable error on an older Node release.

## Required public backend configuration

Every environment must explicitly provide both variables below:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

They are public Supabase client configuration, not privileged credentials. Never add a service-role key, database password, or secret key to a `NEXT_PUBLIC_*` variable.

There is no code-level Supabase fallback. Missing or partial configuration stops the application rather than selecting another environment.

### Local development

Create `.env.local` with the URL and publishable key of a dedicated local or development Supabase project. Keep `NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE` absent or set to `false`.

### Automated tests

Source-only tests do not require a live backend. Build jobs receive an explicit non-routable URL and non-secret placeholder publishable key. Integration tests must use an isolated test project and must not enable the production override.

### Preview and staging

Configure the Vercel Preview environment with a dedicated preview/staging project URL and its publishable key. Keep `NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE` absent or `false`.

### Production

Configure the Vercel Production environment explicitly with the BIS Production project URL and its public publishable key. Production is the only environment that may also set:

```text
NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE=true
```

This flag is a public safety acknowledgement, not a credential. Do not configure it for Development, Test, or Preview scopes.

## Release verification

`npm run verify` is the authoritative release-readiness contract. It runs, in order:

1. Node runtime preflight
2. ESLint
3. TypeScript
4. acceptance tests
5. canonical-source audit
6. optimized production build
7. Playwright browser tests

GitHub CI and Vercel's `vercel-build` both invoke this contract. A failing stage blocks release; tests must not be disabled or weakened to obtain a green deployment.
