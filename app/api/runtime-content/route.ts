import { and, eq } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  contentEditionActivations,
  contentLibraryItems,
  contentLibraryVersions,
  contentRuntimeActivations,
  contentRuntimeArtifacts,
} from "../../../db/schema";
import { identityFrom } from "../../../lib/bis-access";
import { requestSupabaseClient } from "../../../lib/supabase/server";
import { CONTENT_STUDIO_BUCKET } from "../../../lib/content-studio";
import { isDeliveryEdition } from "../../../lib/learning-foundation";

async function loadHandler(request: Request) {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const code = String(url.searchParams.get("code") ?? "").toUpperCase();
  const edition = url.searchParams.get("edition");
  if (!["LEARNING_MODULE", "LAB"].includes(kind ?? "")) {
    return Response.json({ error: "Choose a runtime content kind." }, { status: 400 });
  }
  if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(code)) {
    return Response.json({ error: "Choose a valid BIS content code." }, { status: 400 });
  }
  if (kind === "LEARNING_MODULE" && !isDeliveryEdition(edition)) {
    return Response.json({ error: "Choose School, Emerging Adult, or Workplace edition." }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db.select().from(contentLibraryItems).where(and(
    eq(contentLibraryItems.kind, kind!),
    eq(contentLibraryItems.code, code),
    eq(contentLibraryItems.status, "ACTIVE"),
  )).limit(1);
  if (!item) return Response.json({ error: "This BIS content is not active." }, { status: 404 });

  let activeVersionId = "";
  let activatedAt: string | null = null;

  if (kind === "LEARNING_MODULE") {
    const [editionActivation] = await db.select().from(contentEditionActivations).where(and(
      eq(contentEditionActivations.itemId, item.id),
      eq(contentEditionActivations.deliveryEdition, edition!),
      eq(contentEditionActivations.status, "ACTIVE"),
    )).limit(1);
    if (editionActivation) {
      activeVersionId = editionActivation.versionId;
      activatedAt = editionActivation.activatedAt;
    }
  }

  if (!activeVersionId) {
    const [activation] = await db.select().from(contentRuntimeActivations).where(and(
      eq(contentRuntimeActivations.itemId, item.id),
      eq(contentRuntimeActivations.status, "ACTIVE"),
    )).limit(1);
    if (!activation || activation.runtimeMode !== "DYNAMIC") {
      return Response.json({
        error: kind === "LEARNING_MODULE"
          ? "This learning edition is not published yet."
          : "This content uses the built-in runtime.",
      }, { status: 404 });
    }
    activeVersionId = activation.versionId;
    activatedAt = activation.activatedAt;
  }

  const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, activeVersionId)).limit(1);
  if (!version || version.runtimeStatus !== "LIVE") {
    return Response.json({ error: "The published content is temporarily unavailable." }, { status: 409 });
  }

  const artifactKey = kind === "LEARNING_MODULE" ? `learning:${edition}` : "lab:universal";
  const [artifact] = await db.select().from(contentRuntimeArtifacts).where(and(
    eq(contentRuntimeArtifacts.versionId, version.id),
    eq(contentRuntimeArtifacts.artifactKey, artifactKey),
  )).limit(1);
  if (!artifact) return Response.json({ error: "The compiled runtime artifact is missing." }, { status: 409 });

  const download = await requestSupabaseClient().storage.from(CONTENT_STUDIO_BUCKET).download(artifact.storagePath);
  if (download.error || !download.data) {
    return Response.json({ error: "The runtime artifact could not be loaded." }, { status: 500 });
  }
  const payload = JSON.parse(await download.data.text()) as unknown;
  return Response.json({
    item: {
      id: item.id,
      kind: item.kind,
      code: item.code,
      slug: item.slug,
      title: item.title,
      routePath: item.routePath,
    },
    version: {
      id: version.id,
      version: version.version,
      compilerVersion: version.compilerVersion,
      activatedAt,
    },
    artifact: {
      key: artifact.artifactKey,
      hash: artifact.artifactHash,
      edition: artifact.deliveryEdition,
    },
    payload,
  }, { headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: Request) {
  return withSupabaseRequest(() => loadHandler(request));
}
