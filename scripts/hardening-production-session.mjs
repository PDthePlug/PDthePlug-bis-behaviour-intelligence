import { readFile, writeFile } from "node:fs/promises";
import { createServerClient } from "@supabase/ssr";

// User authorised account creation for final live verification on 2026-10-07.
// Never send staging credentials to production, and never use admin keys for QA.
export async function productionSession(role, index = 0) {
  if (process.env.BIS_HARDENING_ALLOW_PRODUCTION_CHECKS !== "true") throw new Error("Explicit production verification acknowledgement required.");
  const base = "https://www.bisportal.online";
  const identity = await (await fetch(`${base}/api/staging-certification/environment`)).json();
  if (identity.projectRef !== "swmhsqivqaqwovojbceo" || identity.stagingCertificationAllowed) throw new Error("Production backend identity does not match.");
  const fixture = JSON.parse(await readFile(process.env.BIS_PRODUCTION_HARDENING_CREDENTIAL_FILE, "utf8"));
  if (fixture.projectRef !== identity.projectRef || !fixture.publishableKey?.startsWith("sb_publishable_")) throw new Error("Production fixture configuration does not match.");
  const account = fixture.accounts.filter(row => row.role === role)[index];
  if (!account || !/^takeover-20261007-\d{2}-[a-f0-9]{8}@bis-qa\.invalid$/.test(account.email)) throw new Error("A user-authorised production QA account is required.");
  const cookies = new Map();
  const client = createServerClient("https://swmhsqivqaqwovojbceo.supabase.co", fixture.publishableKey, { cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: rows => rows.forEach(row => cookies.set(row.name, row.value)),
  } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error("Production QA account authentication failed.");
  async function response(route, body, method = body ? "POST" : "GET") {
    if (!route.startsWith("/api/") || route.startsWith("//")) throw new Error("A relative application API route is required.");
    if (method !== "GET" && process.env.BIS_HARDENING_ALLOW_PRODUCTION_FIXTURE_WRITES !== "true") throw new Error("Explicit isolated-production-fixture write acknowledgement required.");
    return fetch(base + route, { method, headers: {
      cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
      ...(body ? { "content-type": "application/json" } : {}),
    }, body: body ? JSON.stringify(body) : undefined });
  }
  async function request(route, body, method) {
    const result = await response(route, body, method);
    const data = await result.json();
    if (!result.ok) throw new Error(`Production QA ${route.split("?", 1)[0]} returned ${result.status}; response body omitted.`);
    return data;
  }
  async function browserState(file) {
    await writeFile(file, JSON.stringify({ cookies: [...cookies].map(([name, value]) => ({ name, value, domain: "www.bisportal.online", path: "/", httpOnly: false, secure: true, sameSite: "Lax" })), origins: [] }), { mode: 0o600 });
  }
  return { account, client, request, response, browserState, base };
}
