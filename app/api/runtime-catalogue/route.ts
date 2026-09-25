import { eq } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  contentEditionActivations,
  contentLibraryItems,
  contentLibraryVersions,
  contentRuntimeActivations,
  learners,
} from "../../../db/schema";
import { identityFrom } from "../../../lib/bis-access";

async function handler() {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const db = getDb();
  const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
  const deliveryEdition = profile?.deliveryEdition ?? "school";
  const [items, activations, editionActivations, versions] = await Promise.all([
    db.select().from(contentLibraryItems).where(eq(contentLibraryItems.status, "ACTIVE")),
    db.select().from(contentRuntimeActivations).where(eq(contentRuntimeActivations.status, "ACTIVE")),
    db.select().from(contentEditionActivations).where(eq(contentEditionActivations.status, "ACTIVE")),
    db.select().from(contentLibraryVersions),
  ]);

  const active = items.map((item) => {
    if (item.kind === "LEARNING_MODULE") {
      const editionActivation = editionActivations.find(
        (candidate) => candidate.itemId === item.id && candidate.deliveryEdition === deliveryEdition,
      );
      if (editionActivation) {
        const version = versions.find((candidate) => candidate.id === editionActivation.versionId);
        return {
          itemId: item.id,
          kind: item.kind,
          code: item.code,
          slug: item.slug,
          title: item.title,
          routePath: item.routePath,
          runtimeMode: "DYNAMIC",
          version: version?.version ?? "",
          live: Boolean(version && version.runtimeStatus === "LIVE"),
          deliveryEdition,
        };
      }
    }

    const activation = activations.find((candidate) => candidate.itemId === item.id);
    const version = activation
      ? versions.find((candidate) => candidate.id === activation.versionId)
      : null;
    return {
      itemId: item.id,
      kind: item.kind,
      code: item.code,
      slug: item.slug,
      title: item.title,
      routePath: item.routePath,
      runtimeMode: activation?.runtimeMode ?? null,
      version: version?.version ?? "",
      live: Boolean(activation && version && version.runtimeStatus === "LIVE"),
      deliveryEdition: item.kind === "LEARNING_MODULE" ? deliveryEdition : null,
    };
  });

  return Response.json(
    { deliveryEdition, items: active },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function GET() {
  return withSupabaseRequest(() => handler());
}
