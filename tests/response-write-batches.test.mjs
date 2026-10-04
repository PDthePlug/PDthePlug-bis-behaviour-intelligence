import assert from "node:assert/strict";
import test from "node:test";
import { writeResponseBatches } from "../lib/response-write-batches.mjs";

test("batched saves bound load and preserve correction and investigation order", async () => {
  const completed = new Set();
  let active = 0, peak = 0;
  const items = Array.from({ length: 11 }, (_, index) => ({ semanticFieldId: `baseline-${index}`, investigation: 0 }));
  items.splice(1, 0, { semanticFieldId: "baseline-0", investigation: 0, correction: true });
  items.push({ semanticFieldId: "story", investigation: 1 });
  await writeResponseBatches(items, async (item) => {
    if (item.correction) assert.ok(completed.has("baseline-0"));
    if (item.investigation === 1) assert.equal(completed.size, 11);
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    completed.add(item.semanticFieldId); active -= 1;
  });
  assert.equal(peak, 4);
  assert.equal(completed.size, 12);
});

test("save failures settle in-flight writes and stop the next investigation", async () => {
  let settled = false, nextStarted = false;
  await assert.rejects(writeResponseBatches([
    { semanticFieldId: "fails", investigation: 0 }, { semanticFieldId: "slow", investigation: 0 }, { semanticFieldId: "next", investigation: 1 },
  ], async (item) => {
    if (item.semanticFieldId === "fails") throw new Error("Write failed");
    if (item.semanticFieldId === "next") nextStarted = true;
    await new Promise((resolve) => setTimeout(resolve, 10)); settled = true;
  }), /Write failed/);
  assert.ok(settled);
  assert.equal(nextStarted, false);
});
