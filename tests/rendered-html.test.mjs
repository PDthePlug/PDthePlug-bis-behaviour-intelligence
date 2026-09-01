import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines BIS product metadata without starter copy", async () => {
  const [layout, experience] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bis-app.tsx", import.meta.url), "utf8"),
  ]);

  const product = `${layout}\n${experience}`;
  assert.match(product, /BIS — Behaviour Intelligence System/);
  assert.match(product, /Understand a pattern in your behaviour/);
  assert.doesNotMatch(product, /Starter Project/);
});
