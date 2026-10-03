import { customerSafeErrorResponse } from "../../../../lib/api-error-response";
import { eq } from "../../../../db/query";
import { getDb, withSupabaseRequest } from "../../../../db";
import {
  auditEvents,
  contentActivationUat,
  contentLibraryItems,
  contentLibraryVersions,
  contentRuntimeArtifacts,
} from "../../../../db/schema";
import {
  AccessError,
  getRoles,
  identityFrom,
  requireRole,
} from "../../../../lib/bis-access";
import { CONTENT_STUDIO_BUCKET, type ContentKind } from "../../../../lib/content-studio";
import { CONTENT_COMPILER_VERSION } from "../../../../lib/content-compiler";
import { artifactFingerprint, requiredPreviewKeys } from "../../../../lib/content-uat";
import { requestSupabaseClient } from "../../../../lib/supabase/server";

function parseJson(value: string | null | undefined, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function requireSuperUser() {
  const identity = await identityFrom();
  if (!identity) throw new AccessError("Sign in is required.", 401);
  const roles = await getRoles(identity);
  requireRole(roles, "SYSTEM_ADMIN");
  return identity;
}

async function handler(request: Request) {
  try {
    const identity = await requireSuperUser();
    const url = new URL(request.url);
    const versionId = String(url.searchParams.get("versionId") ?? "");
    const artifactKey = String(url.searchParams.get("artifact") ?? "");
    if (!versionId || !artifactKey) {
      return Response.json({ error: "Choose a compiled version and preview target." }, { status: 400 });
    }

    const db = getDb();
    const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
    if (!version || version.compilerStatus !== "COMPILED" || !["VALIDATED", "APPROVED"].includes(version.status)) {
      return Response.json({ error: "Only compiled draft versions can enter Activation UAT." }, { status: 409 });
    }
    if (version.compilerVersion !== CONTENT_COMPILER_VERSION) {
      return Response.json({
        error: "This preview was prepared by an older BIS engine. Prepare the version again before reviewing it.",
      }, { status: 409 });
    }
    const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, version.itemId)).limit(1);
    if (!item || item.status !== "ACTIVE") {
      return Response.json({ error: "The content item is not active." }, { status: 404 });
    }

    const artifacts = await db.select().from(contentRuntimeArtifacts).where(eq(contentRuntimeArtifacts.versionId, versionId));
    const expected = requiredPreviewKeys(
      item.kind as ContentKind,
      artifacts.map((candidate) => candidate.artifactKey),
    );
    if (!expected.includes(artifactKey)) {
      return Response.json({ error: "That edition is not ready to preview yet." }, { status: 400 });
    }

    const artifact = artifacts.find((candidate) => candidate.artifactKey === artifactKey);
    if (!artifact) {
      return Response.json({ error: "The compiled preview artifact is missing." }, { status: 409 });
    }

    const download = await requestSupabaseClient().storage.from(CONTENT_STUDIO_BUCKET).download(artifact.storagePath);
    if (download.error || !download.data) {
      return Response.json({ error: "The compiled preview could not be opened." }, { status: 500 });
    }
    const payload = JSON.parse(await download.data.text()) as unknown;
    const fingerprint = await artifactFingerprint(artifacts);

    const [existing] = await db.select().from(contentActivationUat).where(eq(contentActivationUat.versionId, versionId)).limit(1);
    const sameArtifactSet = existing?.artifactFingerprint === fingerprint;
    const previewed = new Set<string>(
      sameArtifactSet
        ? parseJson(existing?.previewedArtifacts, []) as string[]
        : [],
    );
    previewed.add(artifactKey);
    const now = new Date().toISOString();

    if (existing) {
      await db.update(contentActivationUat).set({
        itemId: item.id,
        artifactFingerprint: fingerprint,
        previewedArtifacts: JSON.stringify([...previewed]),
        checklist: sameArtifactSet ? existing.checklist : "{}",
        notes: sameArtifactSet ? existing.notes : "",
        status: sameArtifactSet ? existing.status : "IN_REVIEW",
        reviewedBy: sameArtifactSet ? existing.reviewedBy : null,
        reviewedAt: sameArtifactSet ? existing.reviewedAt : null,
        updatedBy: identity.id,
        updatedAt: now,
      }).where(eq(contentActivationUat.id, existing.id));
    } else {
      await db.insert(contentActivationUat).values({
        id: `uat:${versionId}`,
        versionId,
        itemId: item.id,
        artifactFingerprint: fingerprint,
        previewedArtifacts: JSON.stringify([...previewed]),
        checklist: "{}",
        notes: "",
        status: "IN_REVIEW",
        reviewedBy: null,
        reviewedAt: null,
        updatedBy: identity.id,
      });
    }

    await db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      actorId: identity.id,
      actorType: "STAFF",
      action: "CONTENT_RUNTIME_PREVIEWED",
      objectType: "CONTENT_LIBRARY_VERSION",
      objectId: versionId,
      metadata: JSON.stringify({
        artifactKey,
        artifactHash: artifact.artifactHash,
        artifactFingerprint: fingerprint,
      }),
    });

    return Response.json({
      item: {
        id: item.id,
        kind: item.kind,
        code: item.code,
        slug: item.slug,
        title: item.title,
      },
      version: {
        id: version.id,
        version: version.version,
        compilerVersion: version.compilerVersion,
      },
      artifact: {
        key: artifact.artifactKey,
        edition: artifact.deliveryEdition,
        hash: artifact.artifactHash,
      },
      uat: {
        artifactFingerprint: fingerprint,
        previewedArtifacts: [...previewed],
        requiredArtifacts: expected,
      },
      payload,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return customerSafeErrorResponse(error, { route: "/api/content-studio/preview", operation: "open" }, "The preview could not be opened. Please try again.", 400);
  }
}

export async function GET(request: Request) {
  return withSupabaseRequest(() => handler(request));
}
