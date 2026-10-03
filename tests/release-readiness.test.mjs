import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rootPage = readFileSync("app/page.tsx", "utf8");
const roleRouter = readFileSync("app/role-router.tsx", "utf8");
const requireUser = readFileSync("lib/supabase/require-user.ts", "utf8");
const habitPage = readFileSync("app/habit/page.tsx", "utf8");
const decisionPage = readFileSync("app/decision/page.tsx", "utf8");
const moneyPage = readFileSync("app/money/page.tsx", "utf8");
const workspacePage = readFileSync("app/workspace/page.tsx", "utf8");
const callbackRoute = readFileSync("app/auth/callback/route.ts", "utf8");
const signInPage = readFileSync("app/sign-in/page.tsx", "utf8");
const signInForm = readFileSync("app/sign-in/sign-in-form.tsx", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("authenticated BIS entry resolves staff and learner routes from one root", () => {
  assert.match(rootPage, /await requireUser\("\/"\)/);
  assert.match(rootPage, /return <RoleRouter/);
  assert.match(roleRouter, /SYSTEM_ADMIN/);
  assert.match(roleRouter, /FACILITATOR/);
  assert.match(roleRouter, /SAFEGUARDING_OFFICER/);
  assert.match(roleRouter, /router\.replace\(staff \? "\/workspace" : "\/habit"\)/);
});

test("every primary learner and staff surface requires authenticated identity", () => {
  assert.match(habitPage, /requireUser\("\/habit"\)/);
  assert.match(decisionPage, /const next = returnTo \? `\/decision\?returnTo=\$\{encodeURIComponent\(returnTo\)\}` : "\/decision"/);
  assert.match(decisionPage, /requireUser\(next\)/);
  assert.match(moneyPage, /const next = returnTo \? `\/money\?returnTo=\$\{encodeURIComponent\(returnTo\)\}` : "\/money"/);
  assert.match(moneyPage, /requireUser\(next\)/);
  assert.match(workspacePage, /requireUser\("\/workspace"\)/);
  assert.match(requireUser, /redirect\(`\/sign-in\?next=\$\{encodeURIComponent\(next\)\}`\)/);
});

test("auth callback keeps only local return paths and preserves them on failure", () => {
  assert.match(callbackRoute, /import \{ applicationOrigin, safeReturnPath \}/);
  assert.match(callbackRoute, /const next = safeReturnPath\(url\.searchParams\.get\("next"\)\)/);
  assert.match(callbackRoute, /signInUrl\.searchParams\.set\("error", "confirmation"\)/);
  assert.match(callbackRoute, /signInUrl\.searchParams\.set\("next", next\)/);
});

test("failed confirmation returns a clear learner-safe sign-in state", () => {
  assert.match(signInPage, /error\?: string/);
  assert.match(signInPage, /value === "confirmation"/);
  assert.match(signInPage, /That sign-in link could not be confirmed/);
  assert.match(signInPage, /initialError=\{safeCallbackError\(params\.error\)\}/);
  assert.match(signInForm, /initialError\?: string/);
  assert.match(signInForm, /useState\(initialError\)/);
  assert.match(signInForm, /role="alert"/);
});

test("authentication failures do not expose arbitrary provider messages", () => {
  assert.doesNotMatch(signInForm, /return message;/);
  assert.doesNotMatch(signInForm, /provider email throttle/i);
  assert.doesNotMatch(signInForm, /authentication provider's project-wide email limit/i);
  assert.match(signInForm, /BIS could not complete that request\. Check your details and try again\./);
});

test("release metadata resolves to the canonical BIS origin", () => {
  assert.match(rootLayout, /new URL\(BIS_PRODUCTION_ORIGIN\)/);
  assert.doesNotMatch(rootLayout, /VERCEL_PROJECT_PRODUCTION_URL|vercel\.app/);
  assert.doesNotMatch(rootLayout, /chatgpt\.site/);
});

test("the release contract keeps browser verification in CI while Vercel runs the deterministic build gate", () => {
  assert.equal(packageJson.scripts["vercel-build"], "npm run verify:build");
  assert.equal(packageJson.scripts["test:acceptance"], "npm run runtime:check && node --test tests/*.test.mjs");
  assert.equal(packageJson.scripts.verify, "npm run verify:build && npm run test:browser");
  assert.match(packageJson.scripts["verify:build"], /npm run lint && npm run typecheck && npm run test:acceptance && npm run audit:source && npm run build/);
});
