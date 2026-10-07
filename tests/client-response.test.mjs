import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = stripTypeScriptTypes(await readFile(new URL("../lib/client-response.ts", import.meta.url), "utf8"), { mode: "transform" });
const { readClientResponse, clientResponseMessage, clientResponseDenied } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("empty and malformed workspace responses offer recovery without decoder messages", async () => {
  for (const [body, status] of [["", 503], ["<html>upstream error</html>", 502], ["{}", 200], ["null", 200]]) {
    try {
      await readClientResponse(new Response(body, { status }), "Refresh the workspace.", value => Array.isArray(value.records));
      assert.fail("Incomplete workspace should not render as saved data");
    } catch (cause) {
      assert.equal(clientResponseMessage(cause, "Connection unavailable."), "Refresh the workspace.");
      assert.equal(clientResponseDenied(cause), false);
    }
  }
  assert.equal(clientResponseMessage(new TypeError("Failed to fetch"), "Try again."), "Try again.");
});

test("permission failures retain application guidance and identify revoked data", async () => {
  for (const status of [401, 403]) {
    await assert.rejects(() => readClientResponse(Response.json({ error: "This account cannot review that group." }, { status }), "Try again."), cause => {
      assert.equal(clientResponseDenied(cause), true);
      assert.equal(clientResponseMessage(cause, "Try again."), "This account cannot review that group.");
      return true;
    });
  }
});

test("valid empty rosters and zero results remain valid source data", async () => {
  const snapshot = { records: [], value: 0 };
  assert.deepEqual(await readClientResponse(Response.json(snapshot), "Refresh.", value => Array.isArray(value.records)), snapshot);
});
