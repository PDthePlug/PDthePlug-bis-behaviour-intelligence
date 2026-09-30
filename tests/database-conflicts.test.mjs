import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../db/query.ts", import.meta.url), "utf8");
const { SupabaseDatabase } = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source, { mode: "transform" })).toString("base64"));
const column = (key) => ({ key, name: key, tableName: "measurements" });
const columns = { id: column("id"), user_id: column("user_id"), experiment_id: column("experiment_id"), code: column("code"), value: column("value") };
const table = { __meta: { name: "measurements", columns } };

function fixture(results) {
  const calls = [];
  const client = { from() {
    const call = { filters: [] };
    calls.push(call);
    const query = {
      select() { call.operation = "select"; return query; },
      limit() { return query; },
      order(key, options) { (call.orders ??= []).push([key, options]); return query; },
      range(start, end) { call.range = [start, end]; return query; },
      eq(key, value) { call.filters.push(["eq", key, value]); return query; },
      is(key, value) { call.filters.push(["is", key, value]); return query; },
      insert(row) { call.operation = "insert"; call.row = row; return query; },
      update(row) { call.operation = "update"; call.row = row; return query; },
      then(resolve, reject) { assert.ok(results.length, "unexpected database call"); return Promise.resolve(results.shift()).then(resolve, reject); },
    };
    return query;
  } };
  return { db: new SupabaseDatabase(client), calls };
}

const row = { id: "new-id", user_id: "owner", experiment_id: null, code: "SHIFT", value: "2" };
const conflict = { target: [columns.user_id, columns.experiment_id, columns.code], set: { value: "3" } };

test("nullable natural keys use IS NULL and preserve the original record identity", async () => {
  const { db, calls } = fixture([{ data: [{ id: "existing" }] }, {}]);
  await db.insert(table).values(row).onConflictDoUpdate(conflict);
  assert.deepEqual(calls.map((call) => call.operation), ["select", "update"]);
  assert.deepEqual(calls[1].row, { value: "3" });
  assert.deepEqual(calls[1].filters[1], ["is", "experiment_id", null]);
});

test("concurrent insert resolves only the requested natural-key conflict", async () => {
  const { db, calls } = fixture([{ data: [] }, { error: { code: "23505", message: "duplicate" } }, { data: [{ id: "winner" }] }, {}]);
  await db.insert(table).values(row).onConflictDoUpdate(conflict);
  assert.deepEqual(calls.map((call) => call.operation), ["select", "insert", "select", "update"]);
  assert.deepEqual(calls[3].row, { value: "3" });
});

test("unrelated unique violations and denied lookups are not swallowed", async () => {
  const first = fixture([{ data: [] }, { error: { code: "23505", message: "unrelated key" } }, { data: [] }]);
  await assert.rejects(async () => await first.db.insert(table).values(row).onConflictDoUpdate(conflict), /unrelated key/);
  const second = fixture([{ error: { message: "permission denied" } }]);
  await assert.rejects(async () => await second.db.insert(table).values(row).onConflictDoUpdate(conflict), /permission denied/);
});

test("ignore-duplicate handles a concurrent winner without overwriting it", async () => {
  const { db, calls } = fixture([{ data: [] }, { error: { code: "23505", message: "duplicate" } }, { data: [{ id: "winner" }] }]);
  await db.insert(table).values(row).onConflictDoNothing({ target: conflict.target });
  assert.equal(calls.some((call) => call.operation === "update"), false);
});

test("unbounded reads retrieve every page beyond the platform row cap", async () => {
  const { db, calls } = fixture([
    { data: Array.from({ length: 500 }, (_, index) => ({ id: String(index) })) },
    { data: Array.from({ length: 500 }, (_, index) => ({ id: String(index + 500) })) },
    { data: [{ id: "1000" }] },
  ]);
  const rows = await db.select().from(table);
  assert.equal(rows.length, 1001);
  assert.equal(rows.at(-1).id, "1000");
  assert.deepEqual(calls.map((call) => call.range), [[0, 499], [500, 999], [1000, 1499]]);
  assert.ok(calls.every((call) => call.orders[0][0] === "id"));
});

test("explicit limits bound database reads and a later-page failure is surfaced", async () => {
  const first = fixture([{ data: [{ id: "one" }] }]);
  assert.equal((await first.db.select().from(table).limit(1)).length, 1);
  assert.deepEqual(first.calls[0].range, [0, 0]);
  const second = fixture([{ data: Array.from({ length: 500 }, () => ({ id: "row" })) }, { error: { message: "read interrupted" } }]);
  await assert.rejects(async () => await second.db.select().from(table), /read interrupted/);
});
