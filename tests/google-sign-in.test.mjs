import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("BIS exposes Google as an alternative identity method", async () => {
  const form = await source("app/sign-in/sign-in-form.tsx");
  assert.match(form, /Continue with Google/);
  assert.match(form, /supabase\.auth\.signInWithOAuth/);
  assert.match(form, /provider: "google"/);
});

test("Google sign-in returns through the canonical BIS callback and preserves next", async () => {
  const form = await source("app/sign-in/sign-in-form.tsx");
  const callback = await source("app/auth/callback/route.ts");
  assert.match(form, /redirectTo: callbackUrl\(\)/);
  assert.match(form, /prompt: "select_account"/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /safeReturnPath/);
  assert.match(callback, /searchParams\.get\("next"\)/);
});

test("Google login requests identity only and keeps failures learner-safe", async () => {
  const form = await source("app/sign-in/sign-in-form.tsx");
  assert.match(form, /googleAuthErrorMessage/);
  assert.match(form, /BIS could not start Google sign-in/);
  assert.doesNotMatch(form, /access_type/);
  assert.doesNotMatch(form, /scopes:/);
  assert.doesNotMatch(form, /provider_token/);
  assert.doesNotMatch(form, /provider_refresh_token/);
});
