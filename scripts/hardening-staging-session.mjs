import { readFile, writeFile } from "node:fs/promises";
import { createServerClient } from "@supabase/ssr";

export async function previewProtection(base) {
  const file = process.env.BIS_HARDENING_PREVIEW_ACCESS_FILE;
  if (!file) return [];
  const access = JSON.parse(await readFile(file, "utf8"));
  if (new URL(base).origin !== access.origin || !new URL(base).hostname.endsWith(".vercel.app")) throw new Error("Preview access is restricted to the recorded deployment origin.");
  const url = new URL("/api/staging-certification/environment", base);
  url.searchParams.set("_vercel_share", access.secret);
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 307) throw new Error("The temporary preview share link did not grant access.");
  const cookies = response.headers.getSetCookie().filter(cookie => cookie.startsWith("_vercel_jwt="));
  if (cookies.length !== 1) throw new Error("The preview protection cookie was not issued.");
  return cookies.map(cookie => {
    const pair = cookie.split(";", 1)[0], split = pair.indexOf("=");
    return { name: pair.slice(0, split), value: pair.slice(split + 1), domain: new URL(base).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Lax" };
  });
}

export async function stagingSession(role = "SYSTEM_ADMIN", index = 0) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const base = process.env.BIS_STAGING_BASE_URL || "http://127.0.0.1:3200";
  if (!url || new URL(url).hostname !== "lbmhkddrkhtmkcvfmumd.supabase.co") throw new Error("BIS Staging is required.");
  const protection = await previewProtection(base);
  const identity = await (await fetch(`${base}/api/staging-certification/environment`, { headers: { cookie: protection.map(row => `${row.name}=${row.value}`).join("; ") } })).json();
  if (identity.projectRef !== "lbmhkddrkhtmkcvfmumd" || !identity.stagingCertificationAllowed) throw new Error("Refusing a non-staging app.");
  const fixture = JSON.parse(await readFile(process.env.BIS_HARDENING_CREDENTIAL_FILE, "utf8"));
  const account = fixture.accounts.filter(account => account.role === role)[index];
  if (!account || !/^fullscope-20261006-/.test(account.email)) throw new Error("A dedicated hardening fixture account is required.");
  const cookies = new Map(protection.map(row => [row.name, row.value]));
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: {
    getAll: () => [...cookies].map(([name,value]) => ({name,value})),
    setAll: rows => rows.forEach(row => cookies.set(row.name,row.value)),
  }});
  const { error } = await client.auth.signInWithPassword(account);
  if (error) throw new Error("Staging fixture authentication failed.");
  async function request(route, body, method = body ? "POST" : "GET") {
    if (method !== "GET" && process.env.BIS_STAGING_ALLOW_MUTATIONS !== "true") throw new Error("Explicit staging mutation acknowledgement required.");
    const response = await fetch(base + route, { method, headers: { cookie: [...cookies].map(([name,value]) => `${name}=${value}`).join("; "), ...(body ? {"content-type":"application/json"} : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw new Error(`${route} ${response.status}: ${data.error || "Request rejected"}`);
    return data;
  }
  async function browserState(file) {
    await writeFile(file, JSON.stringify({cookies:[...cookies].map(([name,value]) => ({name,value,domain:new URL(base).hostname,path:"/",httpOnly:false,secure:new URL(base).protocol==="https:",sameSite:"Lax"})),origins:[]}), {mode:0o600});
  }
  return { client, request, browserState, base, account };
}
