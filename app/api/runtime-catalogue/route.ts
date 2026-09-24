import { eq } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  contentLibraryItems,
  contentLibraryVersions,
  contentRuntimeActivations,
} from "../../../db/schema";
import { identityFrom } from "../../../lib/bis-access";

async function handler() {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const db = getDb();
  const [items, activations, versions] = await Promise.all([
    db.select().from(contentLibraryItems).where(eq(contentLibraryItems.status, "ACTIVE")),
    db.select().from(contentRuntimeActivations).where(eq(contentRuntimeActivations.status, "ACTIVE")),
    db.select().from(contentLibraryVersions),
  ]);
  const active = activations.map((activation) => {
    const item = items.find((candidate) => candidate.id === activation.itemId);
    const version = versions.find((candidate) => candidate.id === activation.versionId);
    if (!item || !version) return null;
    return {
      itemId: item.id,
      kind: item.kind,
      code: item.code,
      slug: item.slug,
      title: item.title,
      routePath: item.routePath,
      runtimeMode: activation.runtimeMode,
      version: version.version,
      live: version.runtimeStatus === "LIVE",
    };
  }).filter(Boolean);
  return Response.json({ items: active }, { headers: { "cache-control": "private, no-store" } });
}

export async function GET() {
  return withSupabaseRequest(() => handler());
}
