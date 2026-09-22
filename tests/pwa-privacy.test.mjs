import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
function worker({ offline = false } = {}) {
  const listeners = new Map(), writes = [], requests = [], deleted = [];
  const assets = new Map([["/offline.html", new Response("Generic offline screen")]]);
  const cache = { match: async key => assets.get(key)?.clone(), put: async (key, value) => { writes.push(key); assets.set(key, value); } };
  const context = {
    self: { location: { origin: "https://www.bisportal.online" }, clients: { claim: async () => {} }, addEventListener: (type, fn) => listeners.set(type, fn) },
    caches: { open: async () => cache, keys: async () => ["bis-public-v0", "bis-public-v1", "other-app"], delete: async name => deleted.push(name) },
    fetch: async request => { requests.push(request); if (offline) throw new TypeError("Offline"); return new Response("Online response"); },
    Request: class extends Request { constructor(path, init) { super(new URL(path, "https://www.bisportal.online"), init); } },
    Response, URL,
  };
  vm.runInNewContext(source, context);
  const dispatch = (method, path, mode = "navigate") => {
    let response;
    listeners.get("fetch")({ request: { method, url: new URL(path, context.self.location.origin).href, mode }, respondWith: value => { response = value; } });
    return response;
  };
  const lifecycle = async type => { let completion; listeners.get(type)({ waitUntil: value => { completion = value; } }); await completion; };
  return { dispatch, lifecycle, writes, requests, deleted };
}

test("PWA never intercepts workbook writes, auth requests, APIs or foreign origins", () => {
  const w = worker({ offline: true });
  for (const [method, path] of [["POST", "/api/learning"], ["POST", "/auth/signout"], ["POST", "/habit"], ["GET", "/api/learning"], ["GET", "/auth/callback?code=secret"], ["GET", "https://external.example/"]]) {
    assert.equal(w.dispatch(method, path), undefined);
  }
  assert.equal(w.writes.length, 0);
});

test("offline navigation returns only the generic screen and does not store personal URLs", async () => {
  const w = worker({ offline: true });
  const result = await w.dispatch("GET", "/profile?private=example");
  assert.equal(await result.text(), "Generic offline screen");
  assert.deepEqual(w.writes, []);
});

test("online authenticated navigation is fetched without adding HTML to a cache", async () => {
  const w = worker();
  const response = await w.dispatch("GET", "/habit");
  assert.equal(await response.text(), "Online response");
  assert.deepEqual(w.writes, []);
});

test("installation caches only two public resources without session credentials", async () => {
  const w = worker();
  await w.lifecycle("install");
  assert.deepEqual(w.writes, ["/offline.html", "/brand/bis-icon-192.png"]);
  assert.ok(w.requests.every(request => request.credentials === "omit"));
});

test("activation removes only obsolete BIS public caches", async () => {
  const w = worker();
  await w.lifecycle("activate");
  assert.deepEqual(w.deleted, ["bis-public-v0"]);
});
