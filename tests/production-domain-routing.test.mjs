import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server.js";

const auth = await readFile(new URL("../lib/auth-redirect.ts", import.meta.url), "utf8");
const authUrl = "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(auth)).toString("base64");
const configText = (await readFile(new URL("../next.config.ts", import.meta.url), "utf8")).replace('from "./lib/auth-redirect"', 'from "' + authUrl + '"');
const { default: nextConfig } = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(configText)).toString("base64"));

test("apex and old stable alias permanently redirect while preserving paths and query strings", async () => {
  for (const host of ["bisportal.online", "bis-behaviour-intelligence.vercel.app"]) {
    for (const path of ["/", "/auth/callback?code=test-code&next=%2Fworkspace", "/habit-lab/experiment?day=3"]) {
      const response = await unstable_getResponseFromNextConfig({ url: "https://" + host + path, nextConfig });
      assert.equal(response.status, 308);
      const destination = new URL(response.headers.get("location"));
      const original = new URL("https://" + host + path);
      assert.equal(destination.origin, "https://www.bisportal.online");
      assert.equal(destination.pathname, original.pathname);
      assert.deepEqual([...destination.searchParams], [...original.searchParams]);
    }
  }
});

test("canonical domain and preview infrastructure do not redirect in a loop", async () => {
  for (const host of ["www.bisportal.online", "bis-preview.vercel.app"]) {
    const response = await unstable_getResponseFromNextConfig({ url: "https://" + host + "/sign-in", nextConfig });
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
});
