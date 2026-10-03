import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
const { supabaseBrowserConfig } = await import(
  "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source, { mode: "transform" })).toString("base64")
);

const productionUrl = "https://swmhsqivqaqwovojbceo.supabase.co";
const variables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE",
];

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(variables.map((name) => [name, process.env[name]]));
  for (const name of variables) delete process.env[name];
  Object.assign(process.env, values);
  try {
    return callback();
  } finally {
    for (const name of variables) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test("backend configuration is explicit and complete", () => {
  withEnvironment({}, () => assert.throws(() => supabaseBrowserConfig(), /configuration is missing/i));
  withEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "https://development.example" }, () => {
    assert.throws(() => supabaseBrowserConfig(), /configuration is missing/i);
  });
});

test("development, test and preview cannot silently resolve the BIS Production project", () => {
  withEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: productionUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value",
  }, () => assert.throws(() => supabaseBrowserConfig(), /Refusing to use the BIS Production Supabase project/));
});

test("the production project requires the explicitly named production-only override", () => {
  withEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: productionUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_production_value",
    NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE: "true",
  }, () => assert.deepEqual(supabaseBrowserConfig(), {
    url: productionUrl,
    publishableKey: "sb_publishable_production_value",
  }));
});

test("explicit non-production configuration remains usable without an override", () => {
  withEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: "https://bis-preview.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_preview_value",
  }, () => assert.deepEqual(supabaseBrowserConfig(), {
    url: "https://bis-preview.example",
    publishableKey: "sb_publishable_preview_value",
  }));
});
