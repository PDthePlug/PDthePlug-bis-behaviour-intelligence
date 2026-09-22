# BIS brand and installation foundation

## Brand

The forest-green icon uses an ivory B and an amber evidence point. Pair it with the name **Behaviour Intelligence Series™** and, where space permits, **Applied Commerce®**. The shared `BisMark` component supplies the same image across sign-in, account recovery, onboarding, learner navigation and staff navigation.

- App mark: `public/brand/bis-icon-512.png`
- Horizontal logo artwork: `public/brand/bis-logo-horizontal.webp`
- PWA launch sizes: 192 and 512 pixels, with central artwork kept inside the maskable safe region.
- Apple touch icon: 180 pixels. Favicon: SVG wrapper plus 32-pixel PNG.
- Preserve the icon's proportions and clear space. UI wordmarks remain live text so they stay crisp and accessible.
- Interface palette: forest `#173f35`, ivory `#faf8f1`, amber `#d7b36b`.

The login card now reads: **Every habit tells a story.** followed by **Let's discover yours.**

## PWA foundation

`app/manifest.ts` provides a stable app identity, standalone display, the `/habit` start URL and learning shortcuts. Existing authentication and canonical-domain routing still apply on launch. The Profile page provides an install button when the browser supplies a native prompt, with Android/iPhone instructions otherwise.

Only the canonical production host registers `public/sw.js`. That worker caches the generic offline HTML and public icon. It never stores learner HTML, authentication exchanges, API responses or workbook submissions. Save requests retain the existing online retry behaviour. A new worker waits for open pages to close rather than forcing a reload during editing.

This is an installable web-app foundation, not offline workbook editing, a background sync queue, push notifications or an app-store release. Installed users still need connectivity to load and save their work.

## Verification

Automated worker tests exercise cache contents, credential omission, navigation fallback, authenticated-page non-caching and bypassing APIs/auth/POSTs. Release checks include lint, the acceptance suite, production build and the deployed manifest/icon/worker responses.

Real Android installation, iOS Add to Home Screen, standalone Google sign-in, appearance and offline navigation still require device/browser acceptance. Prior cloud-browser access limitations prevent claiming those checks passed.

Implementation references: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [MDN manifest icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons).
