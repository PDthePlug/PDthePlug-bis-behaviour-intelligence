import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { loadContentTools } from "./lib/load-content-tools.mjs";

// Prepare retained drafts through normal authenticated application operations.
// Publication, enrolment migration and UAT sign-off are separate operations.
const base = process.env.BIS_STAGING_BASE_URL;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!base || !url || new URL(url).hostname !== "lbmhkddrkhtmkcvfmumd.supabase.co"
    || process.env.BIS_STAGING_ALLOW_MUTATIONS !== "true") {
  throw new Error("A verified BIS staging application and explicit staging mutation acknowledgement are required.");
}
const identity = await (await fetch(`${base}/api/staging-certification/environment`)).json();
if (identity.projectRef !== "lbmhkddrkhtmkcvfmumd" || !identity.stagingCertificationAllowed) throw new Error("Refusing a non-staging application.");
for (const name of ["BIS_STAGING_ADMIN_EMAIL", "BIS_STAGING_ADMIN_PASSWORD"]) {
  if (!process.env[name]) throw new Error(`${name} is required outside source control.`);
}
const cookies = new Map();
const client = createServerClient(url, key, { cookies: {
  getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
  setAll: rows => rows.forEach(row => cookies.set(row.name, row.value)),
} });
const { error } = await client.auth.signInWithPassword({ email: process.env.BIS_STAGING_ADMIN_EMAIL, password: process.env.BIS_STAGING_ADMIN_PASSWORD });
if (error) throw new Error("Staging administrator authentication failed.");
async function studio(body) {
  const response = await fetch(`${base}/api/content-studio`, {
    method: body ? "POST" : "GET", headers: {
      cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
      ...(body ? { "content-type": "application/json" } : {}),
    }, body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Content preparation failed (${response.status}): ${result.error ?? "Request rejected"}`);
  return result;
}
let catalogue = await studio();
async function prepare(code, kind, version, sources) {
  const item = catalogue.items.find(item => item.code === code && item.kind === kind);
  if (!item) throw new Error(`Staging catalogue needs the existing ${kind} ${code}.`);
  const versionId = `${item.id}:${version}`;
  const existing = item.versions.find(row => row.id === versionId);
  if (existing?.status === "PUBLISHED") throw new Error(`Refusing to overwrite published ${code} ${version}.`);
  if (!existing) catalogue = await studio({ action: "createVersion", itemId: item.id, version, sourceFormat: sources[0].format, releaseNotes: "Current source-backed preparation using the shared BIS compiler and runtime standards. Staging review candidate." });
  for (const source of sources) {
    const digest = createHash("sha256").update(source.bytes).digest("hex");
    const storagePath = `sources/${versionId}/${source.slot}/${digest}.${source.format === "DOCX" ? "docx" : "json"}`;
    const upload = await client.storage.from("bis-content-studio").upload(storagePath, source.bytes, { contentType: source.mime, upsert: true });
    if (upload.error) throw new Error(`Source upload rejected for ${code} ${source.slot}.`);
    catalogue = await studio({ action: "attachSource", versionId, sourceKey: source.slot, deliveryEdition: kind === "LEARNING_MODULE" ? source.slot : null, sourceFileName: source.name, sourceStoragePath: storagePath, sourceBytes: source.bytes.length, mimeType: source.mime, sourceFormat: source.format });
  }
  catalogue = await studio({ action: "compileVersion", versionId });
  const prepared = catalogue.items.find(row => row.id === item.id).versions.find(row => row.id === versionId);
  if (!prepared.compilerCurrent || prepared.runtimeStatus !== "READY") throw new Error(`Current preparation is not ready for ${code}.`);
  console.log(JSON.stringify({ code, kind, version, compiler: prepared.compilerVersion, status: prepared.status, artifacts: prepared.artifacts.map(row => row.artifactKey), editorial: prepared.compilerReport.editorialStatus ?? null }));
}
const tools = await loadContentTools();
try {
  const volume = await readFile(new URL("../content/sources/volume-1.docx", import.meta.url));
  const manifest = JSON.parse(await readFile(new URL("../content/sources/manifest.json", import.meta.url)));
  if (createHash("sha256").update(volume).digest("hex") !== manifest.find(row => row.volume === 1).sha256) throw new Error("Canonical Volume 1 fingerprint differs.");
  for (const [code, version] of [["HAB", "4.5.3"], ["DEC", "4.2.2"], ["MON", "4.2.1"]]) {
    const packages = await tools.adaptBisVolumeSource(volume, 1, version);
    const lab = packages.find(row => row.code === code);
    if (!lab) throw new Error(`Canonical source has no ${code} Lab.`);
    await prepare(code, "LAB", version, [{ slot: "lab", format: "BIS_PACKAGE_JSON", bytes: lab.packageBytes, name: `${code}-Volume-1-${version}.json`, mime: "application/json" }]);
  }
  const learning = [];
  for (const [slot, variable] of [["school", "BIS_STAGING_LEARNING_SCHOOL_SOURCE"], ["emerging_adult", "BIS_STAGING_LEARNING_EA_SOURCE"], ["workplace", "BIS_STAGING_LEARNING_WORKPLACE_SOURCE"]]) {
    const path = process.env[variable];
    if (!path) throw new Error(`${variable} is required for current learning preparation.`);
    learning.push({ slot, format: "DOCX", bytes: await readFile(path), name: path.split("/").at(-1), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  await prepare("HAB", "LEARNING_MODULE", "1.5", learning);
} finally { await tools.dispose(); }
