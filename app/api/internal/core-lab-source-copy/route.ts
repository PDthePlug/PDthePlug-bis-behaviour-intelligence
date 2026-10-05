import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const files = [
  { code: "HAB", path: "sources/content:lab:HAB:4.5.3/lab/a21838cf25766e3eeabda2571e285e6b812e3a27d98172658b0a04658bc62e0d.json", hash: "a21838cf25766e3eeabda2571e285e6b812e3a27d98172658b0a04658bc62e0d", bytes: 43361 },
  { code: "DEC", path: "sources/content:lab:DEC:4.2.2/lab/98eda12327de591efe41d03fcb6806c560131946d953645209eb5ae754356a33.json", hash: "98eda12327de591efe41d03fcb6806c560131946d953645209eb5ae754356a33", bytes: 44762 },
  { code: "MON", path: "sources/content:lab:MON:4.2.1/lab/d80a747501e6d7870eecc71908513d8aa5a3fef03c174e8827d451495e9debaa.json", hash: "d80a747501e6d7870eecc71908513d8aa5a3fef03c174e8827d451495e9debaa", bytes: 44131 },
] as const;

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export async function GET() {
  if (process.env.BIS_CORE_LAB_MIGRATION_ENABLED !== "true") return Response.json({ error: "Migration bridge is disabled." }, { status: 404 });
  const stagingKey = process.env.BIS_MIGRATION_STAGING_PUBLISHABLE_KEY;
  const productionKey = process.env.BIS_MIGRATION_PRODUCTION_PUBLISHABLE_KEY;
  if (!stagingKey || !productionKey) return Response.json({ error: "Migration bridge is not configured." }, { status: 503 });

  const copied: Array<{ code: string; hash: string; bytes: number }> = [];
  for (const file of files) {
    const source = await fetch(`https://lbmhkddrkhtmkcvfmumd.supabase.co/storage/v1/object/authenticated/bis-content-studio/${file.path}`, {
      headers: { apikey: stagingKey, authorization: `Bearer ${stagingKey}` }, cache: "no-store",
    });
    if (!source.ok) throw new Error(`Could not read staged ${file.code} source package.`);
    const bytes = new Uint8Array(await source.arrayBuffer());
    const hash = digest(bytes);
    if (hash !== file.hash || bytes.byteLength !== file.bytes) throw new Error(`Staged ${file.code} source package fingerprint mismatch.`);
    const target = await fetch(`https://swmhsqivqaqwovojbceo.supabase.co/storage/v1/object/bis-content-studio/${file.path}`, {
      method: "POST",
      headers: { apikey: productionKey, authorization: `Bearer ${productionKey}`, "content-type": "application/json", "x-upsert": "false" },
      body: bytes,
    });
    if (!target.ok) throw new Error(`Could not copy ${file.code} source package (${target.status}).`);
    copied.push({ code: file.code, hash, bytes: bytes.byteLength });
  }
  return Response.json({ copied });
}
