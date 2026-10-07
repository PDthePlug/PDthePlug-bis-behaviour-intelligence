import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const asModule = (text) => "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(text)).toString("base64");
const authModule = asModule(await source("lib/auth-redirect.ts"));
const { applicationOrigin, safeReturnPath, confirmationRedirectUrl, recoveryRedirectUrl } = await import(authModule);
const canonical = "https://www.bisportal.online";

test("all remote authentication origins resolve to www, with loopback development preserved", () => {
  for (const origin of [canonical, "https://bisportal.online", "https://bis-behaviour-intelligence.vercel.app", "https://untrusted.example", "https://localhost.evil.example"]) {
    assert.equal(applicationOrigin(origin), canonical);
  }
  for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    assert.equal(applicationOrigin(origin), origin);
  }
});

test("staging recovery returns only to explicitly bound preview origins and production ignores them", () => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_BIS_PREVIEW_ORIGIN", "NEXT_PUBLIC_BIS_PREVIEW_BRANCH_ORIGIN"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://lbmhkddrkhtmkcvfmumd.supabase.co";
    process.env.NEXT_PUBLIC_BIS_PREVIEW_ORIGIN = "https://bis-preview-reviewed.vercel.app";
    process.env.NEXT_PUBLIC_BIS_PREVIEW_BRANCH_ORIGIN = "https://bis-preview-branch.vercel.app";
    for (const origin of [process.env.NEXT_PUBLIC_BIS_PREVIEW_ORIGIN, process.env.NEXT_PUBLIC_BIS_PREVIEW_BRANCH_ORIGIN]) {
      assert.equal(new URL(recoveryRedirectUrl(origin)).origin, origin);
    }
    for (const origin of ["https://bis-preview-reviewed.vercel.app.evil.example", "https://another.vercel.app", "https://bis-preview-reviewed.vercel.app/"]) {
      assert.equal(applicationOrigin(origin), canonical);
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://swmhsqivqaqwovojbceo.supabase.co";
    assert.equal(applicationOrigin(process.env.NEXT_PUBLIC_BIS_PREVIEW_ORIGIN), canonical);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://lbmhkddrkhtmkcvfmumd.supabase.co";
    process.env.NEXT_PUBLIC_BIS_PREVIEW_ORIGIN = "https://untrusted.example";
    assert.equal(applicationOrigin("https://untrusted.example"), canonical);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("local destinations survive without allowing external and browser-normalised redirects", () => {
  for (const path of ["/workspace", "/learn?edition=school", "/habit-lab/experiment#day-3", "/"]) {
    assert.equal(safeReturnPath(path), path);
  }
  for (const path of [null, undefined, "", "https://evil.example", "//evil.example", "/\\\\evil.example", "/%5cevil.example", "/%2fevil.example", "/%0a/evil.example", "/%09/evil.example", "/%"]) {
    assert.equal(safeReturnPath(path), "/");
  }
});

test("confirmation, Google and recovery callbacks return to the intended BIS route", () => {
  const callback = new URL(confirmationRedirectUrl("/workspace?view=cohorts", "https://bisportal.online"));
  assert.equal(callback.origin, canonical);
  assert.equal(callback.pathname, "/auth/callback");
  assert.equal(callback.searchParams.get("next"), "/workspace?view=cohorts");
  assert.equal(new URL(confirmationRedirectUrl("//evil.example", canonical)).searchParams.get("next"), "/");
  assert.equal(new URL(recoveryRedirectUrl(canonical)).searchParams.get("next"), "/reset-password");
});

const callbackSource = (await source("app/auth/callback/route.ts"))
  .replace('import { NextResponse } from "next/server";', 'const NextResponse = { redirect: (url) => new Response(null, { status: 307, headers: { Location: url.toString() } }) };')
  .replace('from "@/lib/auth-redirect"', 'from "' + authModule + '"')
  .replace('import { createClient } from "@/lib/supabase/server";', 'const createClient = async () => ({ auth: { exchangeCodeForSession: async (code) => ({ error: code === "valid" ? null : new Error("invalid") }) } });');
const { GET } = await import(asModule(callbackSource));

test("callback exchanges the provider code and returns only to a safe canonical destination", async () => {
  const response = await GET(new Request("https://bis-behaviour-intelligence.vercel.app/auth/callback?code=valid&next=%2Fworkspace"));
  assert.equal(response.headers.get("location"), canonical + "/workspace");
  const unsafe = await GET(new Request(canonical + "/auth/callback?code=valid&next=%2F%5Cevil.example"));
  assert.equal(unsafe.headers.get("location"), canonical + "/");
  const recovery = await GET(new Request(canonical + "/auth/callback?code=valid&next=%2Freset-password"));
  assert.equal(recovery.headers.get("location"), canonical + "/reset-password");
});

test("missing or invalid codes return a safe error and preserve the intended internal route", async () => {
  for (const code of ["", "&code=expired"]) {
    const response = await GET(new Request(canonical + "/auth/callback?next=%2Fworkspace" + code));
    const url = new URL(response.headers.get("location"));
    assert.equal(url.origin, canonical);
    assert.equal(url.pathname, "/sign-in");
    assert.equal(url.searchParams.get("error"), "confirmation");
    assert.equal(url.searchParams.get("next"), "/workspace");
    assert.equal(url.searchParams.has("code"), false);
  }
});

test("reset page requires a verified user before rendering a password update form", async () => {
  assert.match(await source("app/reset-password/page.tsx"), /await requireUser\("\/reset-password"\)/);
  const form = await source("app/forgot-password/password-recovery-form.tsx");
  assert.match(form, /resetPasswordForEmail/);
  assert.match(form, /recoveryRedirectUrl/);
  assert.match(form, /updateUser\(\{ password \}\)/);
});
