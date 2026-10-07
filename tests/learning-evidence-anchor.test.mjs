import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("authored learning evidence anchors survive compiler, queue and atomic save boundaries", async () => {
  const adapter = await readFile("lib/content-source-adapters.ts", "utf8");
  const queue = await readFile("lib/workbook-save-queue.ts", "utf8");
  const player = await readFile("app/learning/programme-player.tsx", "utf8");
  const api = await readFile("app/api/learning/route.ts", "utf8");
  const sql = await readFile("supabase/migrations/20261007033500_learning_response_evidence_anchors.sql", "utf8");

  assert.match(adapter, /data-evidence-anchor/);
  assert.match(queue, /evidenceAnchor\?: string/);
  assert.match(player, /evidenceAnchor: target\.dataset\.evidenceAnchor/);
  assert.match(sql, /v_anchor := nullif/);
  assert.match(sql, /:EVIDENCE:/);
  assert.match(sql, /'evidenceAnchor',v_anchor/);
  assert.match(api, /promptParts\[3\] === "EVIDENCE"/);
});

test("evidence anchors remain optional for all existing workbook responses", async () => {
  const sql = await readFile("supabase/migrations/20261007033500_learning_response_evidence_anchors.sql", "utf8");
  assert.match(sql, /case when v_anchor is null then '' else ':EVIDENCE:'\|\|v_anchor end/);
  assert.doesNotMatch(sql, /v_anchor is null\s+or/i);
});
