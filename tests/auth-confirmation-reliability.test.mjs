import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("production verification returns to the canonical BIS deployment", async () => {
  const redirect = await source("lib/auth-redirect.ts");
  assert.match(redirect, /https:\/\/bis-behaviour-intelligence\.vercel\.app/);
  assert.match(redirect, /\/auth\/callback\?next=/);
  assert.match(redirect, /localhost/);
  assert.match(redirect, /runtimeOrigin/);
});

test("signup and resend share the same confirmation callback builder", async () => {
  const form = await source("app/sign-in/sign-in-form.tsx");
  assert.match(form, /confirmationRedirectUrl\(next, window\.location\.origin\)/);
  assert.match(form, /emailRedirectTo: callbackUrl\(\)/);
  assert.match(form, /supabase\.auth\.signUp/);
  assert.match(form, /supabase\.auth\.resend/);
});

test("an unconfirmed account can request another verification email without recreating the account", async () => {
  const form = await source("app/sign-in/sign-in-form.tsx");
  assert.match(form, /type: "signup"/);
  assert.match(form, /Resend verification email/);
  assert.match(form, /email not confirmed/);
  assert.match(form, /setConfirmationPending\(true\)/);
  assert.match(form, /setResendCooldown\(60\)/);
});

test("verification delivery errors stay learner-safe", async () => {
  const form = await source("app/sign-in/sign-in-form.tsx");
  assert.match(form, /BIS could not send the verification email/);
  assert.match(form, /BIS cannot send another verification email right now/);
  assert.doesNotMatch(form, /return message;/);
  assert.doesNotMatch(form, /smtp/i);
});
