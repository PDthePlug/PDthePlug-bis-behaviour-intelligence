import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const artifacts = [
  {
    code: "HAB",
    path: "runtime/content:lab:HAB:4.5.3/lab/universal.json",
    hash: "c961f4bfbfa355cf397ee737dc2ee7292f9a635496d6e3def1cafa5394824cc1",
    bytes: 57541,
  },
  {
    code: "DEC",
    path: "runtime/content:lab:DEC:4.2.2/lab/universal.json",
    hash: "182a5feafec13f8d4a0855393d74c108143c131a1117a33f06958f9db27b2fa9",
    bytes: 60407,
  },
  {
    code: "MON",
    path: "runtime/content:lab:MON:4.2.1/lab/universal.json",
    hash: "676518718fa051ee3dde69e8d024a64ce064145bdc6bd201a004bfc4eb777a85",
    bytes: 59573,
  },
] as const;

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function GET() {
  if (process.env.BIS_CORE_LAB_MIGRATION_ENABLED !== "true") {
    return Response.json({ error: "Migration bridge is disabled." }, { status: 404 });
  }
  const stagingKey = process.env.BIS_MIGRATION_STAGING_PUBLISHABLE_KEY;
  const productionKey = process.env.BIS_MIGRATION_PRODUCTION_PUBLISHABLE_KEY;
  if (!stagingKey || !productionKey) {
    return Response.json({ error: "Migration bridge is not configured." }, { status: 503 });
  }

  const copied: Array<{ code: string; hash: string; bytes: number }> = [];
  for (const artifact of artifacts) {
    const sourceUrl = `https://lbmhkddrkhtmkcvfmumd.supabase.co/storage/v1/object/authenticated/bis-content-studio/${artifact.path}`;
    const source = await fetch(sourceUrl, {
      headers: { apikey: stagingKey, authorization: `Bearer ${stagingKey}` },
      cache: "no-store",
    });
    if (!source.ok) throw new Error(`Could not read staged ${artifact.code} Universal artifact.`);
    const bytes = new Uint8Array(await source.arrayBuffer());
    const digest = sha256(bytes);
    if (digest !== artifact.hash || bytes.byteLength !== artifact.bytes) {
      throw new Error(`Staged ${artifact.code} Universal artifact did not match its governed fingerprint.`);
    }

    const targetUrl = `https://swmhsqivqaqwovojbceo.supabase.co/storage/v1/object/bis-content-studio/${artifact.path}`;
    const target = await fetch(targetUrl, {
      method: "POST",
      headers: {
        apikey: productionKey,
        authorization: `Bearer ${productionKey}`,
        "content-type": "application/json",
        "x-upsert": "false",
      },
      body: bytes,
    });
    if (!target.ok) {
      const detail = await target.text();
      throw new Error(`Could not copy ${artifact.code} Universal artifact: ${target.status} ${detail.slice(0, 120)}`);
    }
    copied.push({ code: artifact.code, hash: digest, bytes: bytes.byteLength });
  }

  return Response.json({ copied });
}
