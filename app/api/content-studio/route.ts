import { asc, desc, eq } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  auditEvents,
  contentLibraryItems,
  contentLibraryVersions,
} from "../../../db/schema";
import {
  CONTENT_KINDS,
  CONTENT_SOURCE_FORMATS,
  safeContentCode,
  safeContentSlug,
  validateContentSource,
  type ContentKind,
  type ContentSourceFormat,
} from "../../../lib/content-studio";
import {
  AccessError,
  getRoles,
  identityFrom,
  requireRole,
} from "../../../lib/bis-access";
import { requestSupabaseClient } from "../../../lib/supabase/server";

function parseJson(value: string | null | undefined, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "The content operation could not be completed." },
    { status: 400 },
  );
}

async function requireSuperUser() {
  const identity = await identityFrom();
  if (!identity) throw new AccessError("Sign in is required.", 401);
  const roles = await getRoles(identity);
  requireRole(roles, "SYSTEM_ADMIN");
  return identity;
}

async function audit(
  actorId: string,
  action: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, unknown> = {},
) {
  await getDb().insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorId,
    actorType: "STAFF",
    action,
    objectType,
    objectId,
    metadata: JSON.stringify(metadata),
  });
}

async function snapshot() {
  const db = getDb();
  const [items, versions] = await Promise.all([
    db.select().from(contentLibraryItems).orderBy(asc(contentLibraryItems.kind), asc(contentLibraryItems.title)),
    db.select().from(contentLibraryVersions).orderBy(desc(contentLibraryVersions.createdAt)),
  ]);
  const mappedVersions = versions.map((row) => ({
    ...row,
    deliveryEditions: parseJson(row.deliveryEditions, []),
    manifest: parseJson(row.manifest, {}),
    validationReport: parseJson(row.validationReport, {}),
  }));
  const mappedItems = items.map((item) => ({
    ...item,
    versions: mappedVersions.filter((version) => version.itemId === item.id),
  }));
  return {
    metrics: {
      learningModules: items.filter((item) => item.kind === "LEARNING_MODULE" && item.status === "ACTIVE").length,
      labs: items.filter((item) => item.kind === "LAB" && item.status === "ACTIVE").length,
      drafts: versions.filter((version) => ["DRAFT", "VALIDATED", "APPROVED"].includes(version.status)).length,
      live: versions.filter((version) => version.runtimeStatus === "LIVE" && version.status === "PUBLISHED").length,
      ready: versions.filter((version) => version.runtimeStatus === "READY" && ["VALIDATED", "APPROVED"].includes(version.status)).length,
    },
    items: mappedItems,
  };
}

function validVersion(value: string) {
  return /^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$/.test(value);
}

async function getHandler() {
  try {
    await requireSuperUser();
    return Response.json(await snapshot(), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

async function postHandler(request: Request) {
  try {
    const identity = await requireSuperUser();
    const db = getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "createItem") {
      const kind = String(body.kind ?? "") as ContentKind;
      const code = safeContentCode(String(body.code ?? ""));
      const slug = safeContentSlug(String(body.slug ?? ""));
      const title = String(body.title ?? "").trim();
      const summary = String(body.summary ?? "").trim();
      const linkedLabItemId = String(body.linkedLabItemId ?? "").trim() || null;
      if (!CONTENT_KINDS.includes(kind)) throw new Error("Choose Learning module or Lab.");
      if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(code)) throw new Error("Use a short uppercase content code, for example FOC or RES.");
      if (!slug || slug.length < 2) throw new Error("Add a short URL slug.");
      if (title.length < 3 || title.length > 120) throw new Error("Use a title between 3 and 120 characters.");
      if (summary.length > 500) throw new Error("Keep the summary under 500 characters.");
      if (kind === "LAB" && linkedLabItemId) throw new Error("A Lab cannot link to another Lab.");
      if (linkedLabItemId) {
        const [linked] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, linkedLabItemId)).limit(1);
        if (!linked || linked.kind !== "LAB" || linked.status !== "ACTIVE") throw new Error("Choose an active Lab to link this learning module to.");
      }
      const id = `content:${kind === "LAB" ? "lab" : "module"}:${code}`;
      await db.insert(contentLibraryItems).values({
        id,
        kind,
        code,
        slug,
        title,
        summary,
        linkedLabItemId,
        status: "ACTIVE",
        createdBy: identity.id,
        updatedAt: new Date().toISOString(),
      });
      await audit(identity.id, "CONTENT_ITEM_CREATED", "CONTENT_LIBRARY_ITEM", id, { kind, code, slug });
      return Response.json(await snapshot(), { status: 201 });
    }

    if (action === "createVersion") {
      const itemId = String(body.itemId ?? "");
      const version = String(body.version ?? "").trim();
      const schemaVersion = String(body.schemaVersion ?? "1.0").trim() || "1.0";
      const sourceFormat = String(body.sourceFormat ?? "BIS_PACKAGE_JSON") as ContentSourceFormat;
      const releaseNotes = String(body.releaseNotes ?? "").trim();
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, itemId)).limit(1);
      if (!item || item.status !== "ACTIVE") throw new Error("Choose an active content item.");
      if (!validVersion(version)) throw new Error("Use a short version such as 1.0, 2.1 or 4.5.3.");
      if (!CONTENT_SOURCE_FORMATS.includes(sourceFormat)) throw new Error("Choose a supported source format.");
      if (releaseNotes.length > 1200) throw new Error("Keep release notes under 1,200 characters.");
      const id = `${itemId}:${version}`;
      await db.insert(contentLibraryVersions).values({
        id,
        itemId,
        version,
        schemaVersion,
        sourceFormat,
        validationStatus: "PENDING",
        runtimeStatus: "REQUIRES_ADAPTER",
        validationReport: "{}",
        manifest: "{}",
        status: "DRAFT",
        releaseNotes,
        createdBy: identity.id,
        updatedAt: new Date().toISOString(),
      });
      await audit(identity.id, "CONTENT_VERSION_CREATED", "CONTENT_LIBRARY_VERSION", id, { itemId, version, sourceFormat });
      return Response.json(await snapshot(), { status: 201 });
    }

    if (action === "validateVersion") {
      const versionId = String(body.versionId ?? "");
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version) throw new Error("That draft version was not found.");
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, version.itemId)).limit(1);
      if (!item) throw new Error("The parent content item was not found.");
      if (!version.sourceStoragePath) throw new Error("Upload a source file before validation.");
      const sourceFormat = version.sourceFormat as ContentSourceFormat;
      if (!CONTENT_SOURCE_FORMATS.includes(sourceFormat)) throw new Error("The source format is not supported.");
      const download = await requestSupabaseClient().storage
        .from("bis-content-studio")
        .download(version.sourceStoragePath);
      if (download.error || !download.data) throw new Error("The source file could not be opened for validation.");
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      const result = validateContentSource(item.kind as ContentKind, item.code, version.version, sourceFormat, bytes);
      const now = new Date().toISOString();
      await db.update(contentLibraryVersions).set({
        validationStatus: result.validationStatus,
        runtimeStatus: result.runtimeStatus,
        validationReport: JSON.stringify(result.report),
        manifest: JSON.stringify(result.manifest),
        status: result.validationStatus === "VALID" ? "VALIDATED" : "DRAFT",
        validatedAt: now,
        updatedAt: now,
      }).where(eq(contentLibraryVersions.id, versionId));
      await audit(identity.id, "CONTENT_VERSION_VALIDATED", "CONTENT_LIBRARY_VERSION", versionId, {
        validationStatus: result.validationStatus,
        runtimeStatus: result.runtimeStatus,
      });
      return Response.json(await snapshot());
    }

    if (action === "approveVersion") {
      const versionId = String(body.versionId ?? "");
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version) throw new Error("That draft version was not found.");
      if (version.validationStatus !== "VALID" || version.status !== "VALIDATED") {
        throw new Error("Validate this version successfully before approval.");
      }
      const now = new Date().toISOString();
      await db.update(contentLibraryVersions).set({
        status: "APPROVED",
        approvedAt: now,
        approvedBy: identity.id,
        updatedAt: now,
      }).where(eq(contentLibraryVersions.id, versionId));
      await audit(identity.id, "CONTENT_VERSION_APPROVED", "CONTENT_LIBRARY_VERSION", versionId, {
        runtimeStatus: version.runtimeStatus,
      });
      return Response.json(await snapshot());
    }

    if (action === "reopenVersion") {
      const versionId = String(body.versionId ?? "");
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version || !["VALIDATED", "APPROVED"].includes(version.status)) throw new Error("Choose a validated or approved draft.");
      const now = new Date().toISOString();
      await db.update(contentLibraryVersions).set({
        status: "DRAFT",
        validationStatus: "PENDING",
        runtimeStatus: "REQUIRES_ADAPTER",
        validationReport: "{}",
        approvedAt: null,
        approvedBy: null,
        updatedAt: now,
      }).where(eq(contentLibraryVersions.id, versionId));
      await audit(identity.id, "CONTENT_VERSION_REOPENED", "CONTENT_LIBRARY_VERSION", versionId);
      return Response.json(await snapshot());
    }

    if (action === "archiveItem") {
      const itemId = String(body.itemId ?? "");
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, itemId)).limit(1);
      if (!item) throw new Error("That content item was not found.");
      const live = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.itemId, itemId));
      if (live.some((version) => version.status === "PUBLISHED" && version.runtimeStatus === "LIVE")) {
        throw new Error("A live content item must be retired from the runtime before it can be archived.");
      }
      await db.update(contentLibraryItems).set({ status: "ARCHIVED", updatedAt: new Date().toISOString() }).where(eq(contentLibraryItems.id, itemId));
      await audit(identity.id, "CONTENT_ITEM_ARCHIVED", "CONTENT_LIBRARY_ITEM", itemId);
      return Response.json(await snapshot());
    }

    return Response.json({ error: "Unknown Content Studio operation." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  return withSupabaseRequest(() => getHandler());
}

export async function POST(request: Request) {
  return withSupabaseRequest(() => postHandler(request));
}
