import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const source = await readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");
let identity = { id: "learner", authUserId: "auth-learner", email: "learner@example.test", displayName: "Learner" };
let failure = false, affected = true, updateValues, owner;
const rows = [{ displayName: "Learner", deliveryEdition: "school", appearancePreference: "warm" }];
const selection = { from() { return this; }, where() { return this; }, limit() { return this; }, then(ok, fail) { return (failure ? Promise.reject(new Error("column learners.appearance_preference does not exist")) : Promise.resolve(rows)).then(ok, fail); } };
const columns = Object.fromEntries(["deliveryEdition", "appearancePreference", "accentPreference", "textSizePreference", "readingWidthPreference", "updatedAt"].map(key => [key, { name: key.replace(/[A-Z]/g, c => "_" + c.toLowerCase()) }]));
const mocks = {
  eq: (_, value) => value, getDb: () => ({ select: () => selection }), withSupabaseRequest: fn => fn(), learners: { __meta: { columns } }, identityFrom: () => identity, getRoles: () => ["LEARNER"],
  requestSupabaseClient: () => ({ from: () => ({ update: values => { updateValues = values; return { eq: (_, id) => { owner = id; return { select: () => ({ maybeSingle: async () => ({ data: affected ? { user_id: id } : null, error: null }) }) }; } }; } }) }),
};
globalThis.__profileMocks = mocks;
const moduleText = source.replace(/^import .*;\n/gm, "");
const moduleUrl = "data:text/javascript;base64," + Buffer.from("const {eq,getDb,withSupabaseRequest,learners,identityFrom,getRoles,requestSupabaseClient}=globalThis.__profileMocks;\n" + stripTypeScriptTypes(moduleText)).toString("base64");
const { GET, PATCH } = await import(moduleUrl);
const patch = body => PATCH(new Request("https://bis.invalid/api/profile", { method: "PATCH", body: JSON.stringify(body) }));

test("profile load failures return private JSON rather than an empty server response", async () => {
  failure = true;
  const original = console.error; console.error = () => {};
  try { const result = await GET(); assert.equal(result.status, 503); assert.equal(result.headers.get("cache-control"), "private, no-store"); assert.deepEqual(await result.json(), { error: "Your profile is unavailable. Please try again." }); }
  finally { failure = false; console.error = original; }
});
test("only validated preferences are updated against the signed-in owner", async () => {
  const result = await patch({ appearance: "warm", deliveryEdition: "workplace" });
  assert.equal(result.status, 200); assert.equal(owner, "learner"); assert.equal(updateValues.appearance_preference, "warm"); assert.equal(updateValues.delivery_edition, "workplace"); assert.deepEqual(Object.keys(updateValues).sort(), ["appearance_preference", "delivery_edition", "updated_at"]);
  for (const body of [null, [], { appearance: "unsupported" }, { userId: "other", appearance: "warm" }]) assert.equal((await patch(body)).status, 400);
});
test("a zero-row update is not reported as saved", async () => {
  affected = false;
  try { assert.equal((await patch({ accent: "blue" })).status, 409); } finally { affected = true; }
});
test("signed-out reads and writes are denied", async () => {
  const previous = identity; identity = null;
  try { assert.equal((await GET()).status, 401); assert.equal((await patch({ appearance: "warm" })).status, 401); } finally { identity = previous; }
});
