import { and, asc, desc, eq } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  auditEvents,
  contentActivationUat,
  contentEditionActivations,
  contentLibraryItems,
  contentLibraryVersions,
  contentReleases,
  contentRuntimeActivations,
  contentRuntimeArtifacts,
  contentSourceFiles,
} from "../../../db/schema";
import {
  CONTENT_KINDS,
  CONTENT_SOURCE_FORMATS,
  CONTENT_STUDIO_BUCKET,
  safeContentCode,
  safeContentSlug,
  sha256Hex,
  validateContentSource,
  type ContentKind,
  type ContentSourceFormat,
} from "../../../lib/content-studio";
import {
  CONTENT_COMPILER_VERSION,
  LEARNING_EDITION_KEYS,
  compileLearningEdition,
  compileUniversalLab,
} from "../../../lib/content-compiler";
import type { DeliveryEdition } from "../../../lib/learning-foundation";
import { adaptLabSource, adaptLearningSource } from "../../../lib/content-source-adapters";
import {
  artifactFingerprint,
  checklistComplete,
  normalizeUatChecklist,
  previewCoverageComplete,
} from "../../../lib/content-uat";
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

async function resetUat(versionId: string, actorId: string) {
  const db = getDb();
  const [row] = await db.select().from(contentActivationUat).where(eq(contentActivationUat.versionId, versionId)).limit(1);
  if (!row) return;
  await db.update(contentActivationUat).set({
    artifactFingerprint: "PENDING",
    previewedArtifacts: "[]",
    checklist: "{}",
    notes: "",
    status: "IN_REVIEW",
    reviewedBy: null,
    reviewedAt: null,
    updatedBy: actorId,
    updatedAt: new Date().toISOString(),
  }).where(eq(contentActivationUat.id, row.id));
}


async function snapshot() {
  const db = getDb();
  const [items, versions, sourceFiles, artifacts, activations, editionActivations, uatRows] = await Promise.all([
    db.select().from(contentLibraryItems).orderBy(asc(contentLibraryItems.kind), asc(contentLibraryItems.title)),
    db.select().from(contentLibraryVersions).orderBy(desc(contentLibraryVersions.createdAt)),
    db.select().from(contentSourceFiles).orderBy(desc(contentSourceFiles.createdAt)),
    db.select().from(contentRuntimeArtifacts).orderBy(desc(contentRuntimeArtifacts.createdAt)),
    db.select().from(contentRuntimeActivations).orderBy(desc(contentRuntimeActivations.activatedAt)),
    db.select().from(contentEditionActivations).orderBy(desc(contentEditionActivations.activatedAt)),
    db.select().from(contentActivationUat).orderBy(desc(contentActivationUat.updatedAt)),
  ]);
  const mappedVersions = versions.map((row) => ({
    ...row,
    deliveryEditions: parseJson(row.deliveryEditions, []),
    manifest: parseJson(row.manifest, {}),
    validationReport: parseJson(row.validationReport, {}),
    compilerReport: parseJson(row.compilerReport, {}),
    sourceFiles: sourceFiles.filter((source) => source.versionId === row.id),
    artifacts: artifacts.filter((artifact) => artifact.versionId === row.id),
    uat: (() => {
      const uat = uatRows.find((candidate) => candidate.versionId === row.id);
      return uat ? {
        ...uat,
        previewedArtifacts: parseJson(uat.previewedArtifacts, []),
        checklist: parseJson(uat.checklist, {}),
      } : null;
    })(),
  }));
  const mappedItems = items.map((item) => ({
    ...item,
    activeActivation: activations.find((activation) => activation.itemId === item.id && activation.status === "ACTIVE") ?? null,
    activeEditions: editionActivations
      .filter((activation) => activation.itemId === item.id && activation.status === "ACTIVE")
      .map((activation) => ({
        id: activation.id,
        deliveryEdition: activation.deliveryEdition,
        versionId: activation.versionId,
        activatedAt: activation.activatedAt,
      })),
    versions: mappedVersions.filter((version) => version.itemId === item.id),
  }));
  return {
    metrics: {
      learningModules: items.filter((item) => item.kind === "LEARNING_MODULE" && item.status === "ACTIVE").length,
      labs: items.filter((item) => item.kind === "LAB" && item.status === "ACTIVE").length,
      drafts: versions.filter((version) => ["DRAFT", "VALIDATED", "APPROVED"].includes(version.status)).length,
      live: versions.filter((version) => version.runtimeStatus === "LIVE" && version.status === "PUBLISHED").length,
      ready: versions.filter((version) => version.runtimeStatus === "READY" && ["VALIDATED", "APPROVED"].includes(version.status)).length,
      compiled: versions.filter((version) => version.compilerStatus === "COMPILED").length,
      activeDynamic: activations.filter((activation) => activation.status === "ACTIVE" && activation.runtimeMode === "DYNAMIC").length,
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
      if (!item || item.status !== "ACTIVE") throw new Error("Choose a BIS title.");
      if (!validVersion(version)) throw new Error("Use a short version such as 1.0, 2.1 or 4.5.3.");
      if (!CONTENT_SOURCE_FORMATS.includes(sourceFormat)) throw new Error("Use a Word document, PDF, pasted text, HTML, Markdown, BIS JSON or ZIP file.");
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

    if (action === "attachSource") {
      const versionId = String(body.versionId ?? "");
      const sourceKey = String(body.sourceKey ?? "");
      const deliveryEdition = String(body.deliveryEdition ?? "") || null;
      const sourceFileName = String(body.sourceFileName ?? "").trim();
      const sourceStoragePath = String(body.sourceStoragePath ?? "").trim();
      const sourceBytes = Number(body.sourceBytes ?? 0);
      const mimeType = String(body.mimeType ?? "").trim() || null;
      const sourceFormat = String(body.sourceFormat ?? "") as ContentSourceFormat;
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version || version.status !== "DRAFT") throw new Error("Choose an editable draft version.");
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, version.itemId)).limit(1);
      if (!item) throw new Error("That BIS title could not be found.");
      const expectedKeys = item.kind === "LEARNING_MODULE" ? [...LEARNING_EDITION_KEYS] : ["lab"];
      if (!expectedKeys.includes(sourceKey as DeliveryEdition | "lab")) throw new Error("Choose the correct source slot for this content.");
      if (item.kind === "LEARNING_MODULE" && deliveryEdition !== sourceKey) throw new Error("The learning source must match its delivery edition.");
      if (item.kind === "LAB" && deliveryEdition) throw new Error("Lab sources do not use delivery editions.");
      if (!sourceFileName || sourceFileName.length > 180) throw new Error("The source file name is not valid.");
      if (!sourceStoragePath.startsWith(`sources/${versionId}/${sourceKey}/`)) throw new Error("The source upload path does not match this draft slot.");
      if (!Number.isFinite(sourceBytes) || sourceBytes < 1 || sourceBytes > 26_214_400) throw new Error("Use a source file up to 25 MB.");
      if (!CONTENT_SOURCE_FORMATS.includes(sourceFormat)) throw new Error("Use a Word document, PDF, pasted text, HTML, Markdown, BIS JSON or ZIP file.");

      const list = await requestSupabaseClient().storage
        .from(CONTENT_STUDIO_BUCKET)
        .list(`sources/${versionId}/${sourceKey}`, { limit: 100 });
      if (list.error || !list.data.some((entry) => sourceStoragePath.endsWith(`/${entry.name}`))) {
        throw new Error("The uploaded source could not be confirmed.");
      }

      const id = `${versionId}:source:${sourceKey}`;
      const now = new Date().toISOString();
      await db.insert(contentSourceFiles).values({
        id,
        versionId,
        itemId: item.id,
        sourceKey,
        deliveryEdition,
        sourceFormat,
        fileName: sourceFileName,
        storagePath: sourceStoragePath,
        sourceHash: null,
        sourceBytes,
        mimeType,
        createdBy: identity.id,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [contentSourceFiles.versionId, contentSourceFiles.sourceKey],
        set: {
          deliveryEdition,
          sourceFormat,
          fileName: sourceFileName,
          storagePath: sourceStoragePath,
          sourceHash: null,
          sourceBytes,
          mimeType,
          updatedAt: now,
        },
      });

      await db.update(contentLibraryVersions).set({
        compilerStatus: "NOT_COMPILED",
        compilerReport: "{}",
        compilerVersion: null,
        compiledAt: null,
        compiledBy: null,
        validationStatus: "PENDING",
        runtimeStatus: "REQUIRES_ADAPTER",
        validationReport: "{}",
        manifest: "{}",
        updatedAt: now,
      }).where(eq(contentLibraryVersions.id, versionId));
      await resetUat(versionId, identity.id);
      await audit(identity.id, "CONTENT_SOURCE_ATTACHED", "CONTENT_LIBRARY_VERSION", versionId, {
        sourceKey,
        deliveryEdition,
        sourceFileName,
        sourceBytes,
        mimeType,
        sourceFormat,
      });
      return Response.json(await snapshot());
    }

    if (action === "compileVersion") {
      const versionId = String(body.versionId ?? "");
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version || version.status !== "DRAFT") throw new Error("Choose an editable draft version.");
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, version.itemId)).limit(1);
      if (!item || item.status !== "ACTIVE") throw new Error("That BIS title is not available.");
      const sources = await db.select().from(contentSourceFiles).where(eq(contentSourceFiles.versionId, versionId));
      if (item.kind === "LEARNING_MODULE" && !sources.some((source) => LEARNING_EDITION_KEYS.includes(source.sourceKey as DeliveryEdition))) {
        throw new Error("Upload at least one learning edition before preparing a preview.");
      }
      if (item.kind === "LAB" && !sources.some((source) => source.sourceKey === "lab")) {
        throw new Error("Upload the Lab document before preparing a preview.");
      }

      const compiled = [];
      try {
        if (item.kind === "LEARNING_MODULE") {
          const editionsToCompile = LEARNING_EDITION_KEYS.filter((edition) =>
            sources.some((entry) => entry.sourceKey === edition),
          );
          for (const edition of editionsToCompile) {
            const source = sources.find((entry) => entry.sourceKey === edition)!;
            const download = await requestSupabaseClient().storage.from(CONTENT_STUDIO_BUCKET).download(source.storagePath);
            if (download.error || !download.data) throw new Error(`${edition}: source file could not be opened.`);
            const bytes = new Uint8Array(await download.data.arrayBuffer());
            const sourceHash = await sha256Hex(bytes);
            await db.update(contentSourceFiles).set({ sourceHash, sourceBytes: bytes.byteLength, updatedAt: new Date().toISOString() }).where(eq(contentSourceFiles.id, source.id));
            const adapted = await adaptLearningSource(
              bytes,
              source.sourceFormat as ContentSourceFormat,
              item.code,
              version.version,
              edition,
              { title: item.title, slug: item.slug },
            );
            compiled.push(await compileLearningEdition(adapted, item.code, version.version, edition));
          }
        } else {
          const source = sources.find((entry) => entry.sourceKey === "lab")!;
          const download = await requestSupabaseClient().storage.from(CONTENT_STUDIO_BUCKET).download(source.storagePath);
          if (download.error || !download.data) throw new Error("Lab source file could not be opened.");
          const bytes = new Uint8Array(await download.data.arrayBuffer());
          const sourceHash = await sha256Hex(bytes);
          await db.update(contentSourceFiles).set({ sourceHash, sourceBytes: bytes.byteLength, updatedAt: new Date().toISOString() }).where(eq(contentSourceFiles.id, source.id));
          const adapted = await adaptLabSource(
            bytes,
            source.sourceFormat as ContentSourceFormat,
            item.code,
            version.version,
            { title: item.title, slug: item.slug },
          );
          compiled.push(await compileUniversalLab(adapted, item.code, version.version));
        }

        for (const artifact of compiled) {
          const storagePath = `runtime/${versionId}/${artifact.artifactKey.replace(":", "/")}.json`;
          const upload = await requestSupabaseClient().storage.from(CONTENT_STUDIO_BUCKET).upload(
            storagePath,
            new TextEncoder().encode(artifact.content),
            { contentType: artifact.mimeType, cacheControl: "0", upsert: true },
          );
          if (upload.error) throw new Error(upload.error.message);
          const id = `${versionId}:artifact:${artifact.artifactKey}`;
          await db.insert(contentRuntimeArtifacts).values({
            id,
            versionId,
            itemId: item.id,
            artifactKey: artifact.artifactKey,
            deliveryEdition: artifact.deliveryEdition,
            storagePath,
            artifactHash: artifact.hash,
            artifactBytes: artifact.bytes,
            mimeType: artifact.mimeType,
            compilerVersion: CONTENT_COMPILER_VERSION,
          }).onConflictDoUpdate({
            target: [contentRuntimeArtifacts.versionId, contentRuntimeArtifacts.artifactKey],
            set: {
              deliveryEdition: artifact.deliveryEdition,
              storagePath,
              artifactHash: artifact.hash,
              artifactBytes: artifact.bytes,
              mimeType: artifact.mimeType,
              compilerVersion: CONTENT_COMPILER_VERSION,
            },
          });
        }

        const now = new Date().toISOString();
        const report = {
          summary: item.kind === "LEARNING_MODULE"
            ? `Prepared ${compiled.length} learning edition${compiled.length === 1 ? "" : "s"} for preview.`
            : "Prepared the Lab for preview.",
          compilerVersion: CONTENT_COMPILER_VERSION,
          artifactKeys: compiled.map((artifact) => artifact.artifactKey),
          requiredEditions: item.kind === "LEARNING_MODULE"
            ? compiled.map((artifact) => artifact.deliveryEdition).filter(Boolean)
            : [],
        };
        await db.update(contentLibraryVersions).set({
          compilerStatus: "COMPILED",
          compilerReport: JSON.stringify(report),
          compilerVersion: CONTENT_COMPILER_VERSION,
          compiledAt: now,
          compiledBy: identity.id,
          validationStatus: "VALID",
          runtimeStatus: "READY",
          validationReport: JSON.stringify({ summary: report.summary, activationReady: true }),
          manifest: JSON.stringify(report),
          deliveryEditions: JSON.stringify(
            item.kind === "LEARNING_MODULE"
              ? compiled.map((artifact) => artifact.deliveryEdition).filter(Boolean)
              : [],
          ),
          status: "VALIDATED",
          validatedAt: now,
          updatedAt: now,
        }).where(eq(contentLibraryVersions.id, versionId));
        await resetUat(versionId, identity.id);
        await audit(identity.id, "CONTENT_VERSION_COMPILED", "CONTENT_LIBRARY_VERSION", versionId, report);
        return Response.json(await snapshot());
      } catch (compileError) {
        const now = new Date().toISOString();
        const detail = compileError instanceof Error ? compileError.message : "Compilation failed.";
        await db.update(contentLibraryVersions).set({
          compilerStatus: "FAILED",
          compilerReport: JSON.stringify({ summary: detail, compilerVersion: CONTENT_COMPILER_VERSION }),
          validationStatus: "INVALID",
          runtimeStatus: "BLOCKED",
          validationReport: JSON.stringify({ summary: detail, activationReady: false }),
          updatedAt: now,
        }).where(eq(contentLibraryVersions.id, versionId));
        await audit(identity.id, "CONTENT_VERSION_COMPILE_FAILED", "CONTENT_LIBRARY_VERSION", versionId, { detail });
        throw compileError;
      }
    }

    if (action === "validateVersion") {
      const versionId = String(body.versionId ?? "");
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version) throw new Error("That draft version was not found.");
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, version.itemId)).limit(1);
      if (!item) throw new Error("That BIS title could not be found.");
      if (!version.sourceStoragePath) throw new Error("Upload some content first.");
      const sourceFormat = version.sourceFormat as ContentSourceFormat;
      if (!CONTENT_SOURCE_FORMATS.includes(sourceFormat)) throw new Error("That file type is not supported yet.");
      const download = await requestSupabaseClient().storage
        .from("bis-content-studio")
        .download(version.sourceStoragePath);
      if (download.error || !download.data) throw new Error("I couldn't open the uploaded file. Please upload it again.");
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      const sourceHash = await sha256Hex(bytes);
      const result = validateContentSource(item.kind as ContentKind, item.code, version.version, sourceFormat, bytes);
      const now = new Date().toISOString();
      await db.update(contentLibraryVersions).set({
        sourceHash,
        sourceBytes: bytes.byteLength,
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
      if (version.validationStatus !== "VALID" || version.status !== "VALIDATED" || version.compilerStatus !== "COMPILED") {
        throw new Error("Prepare this version successfully before approval.");
      }
      const [review] = await db.select().from(contentActivationUat).where(eq(contentActivationUat.versionId, versionId)).limit(1);
      if (!review || review.status !== "PASSED") {
        throw new Error("Complete the final preview check before approving this version.");
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
        compilerStatus: "NOT_COMPILED",
        compilerReport: "{}",
        compilerVersion: null,
        compiledAt: null,
        compiledBy: null,
        validationStatus: "PENDING",
        runtimeStatus: "REQUIRES_ADAPTER",
        validationReport: "{}",
        approvedAt: null,
        approvedBy: null,
        updatedAt: now,
      }).where(eq(contentLibraryVersions.id, versionId));
      await resetUat(versionId, identity.id);
      await audit(identity.id, "CONTENT_VERSION_REOPENED", "CONTENT_LIBRARY_VERSION", versionId);
      return Response.json(await snapshot());
    }

    if (action === "saveUat") {
      const versionId = String(body.versionId ?? "");
      const notes = String(body.notes ?? "").trim();
      if (notes.length > 2000) throw new Error("Keep your review notes under 2,000 characters.");
      const checklist = normalizeUatChecklist(body.checklist);
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version || version.compilerStatus !== "COMPILED" || !["VALIDATED", "APPROVED"].includes(version.status)) {
        throw new Error("Prepare this version before starting the final check.");
      }
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, version.itemId)).limit(1);
      if (!item || item.status !== "ACTIVE") throw new Error("That BIS title is not available.");
      const artifacts = await db.select().from(contentRuntimeArtifacts).where(eq(contentRuntimeArtifacts.versionId, versionId));
      const fingerprint = await artifactFingerprint(artifacts);
      const [existing] = await db.select().from(contentActivationUat).where(eq(contentActivationUat.versionId, versionId)).limit(1);
      const sameArtifactSet = existing?.artifactFingerprint === fingerprint;
      const now = new Date().toISOString();
      const values = {
        itemId: item.id,
        artifactFingerprint: fingerprint,
        previewedArtifacts: sameArtifactSet ? existing!.previewedArtifacts : "[]",
        checklist: JSON.stringify(checklist),
        notes,
        status: "IN_REVIEW",
        reviewedBy: null,
        reviewedAt: null,
        updatedBy: identity.id,
        updatedAt: now,
      };
      if (existing) {
        await db.update(contentActivationUat).set(values).where(eq(contentActivationUat.id, existing.id));
      } else {
        await db.insert(contentActivationUat).values({
          id: `uat:${versionId}`,
          versionId,
          ...values,
        });
      }
      await audit(identity.id, "CONTENT_ACTIVATION_UAT_SAVED", "CONTENT_LIBRARY_VERSION", versionId, {
        checklist,
        previewedArtifacts: sameArtifactSet ? parseJson(existing?.previewedArtifacts, []) : [],
      });
      return Response.json(await snapshot());
    }

    if (action === "signOffUat") {
      const versionId = String(body.versionId ?? "");
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version || version.compilerStatus !== "COMPILED" || !["VALIDATED", "APPROVED"].includes(version.status)) {
        throw new Error("Prepare this version before completing the final check.");
      }
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, version.itemId)).limit(1);
      if (!item || item.status !== "ACTIVE") throw new Error("That BIS title is not available.");
      const [uat] = await db.select().from(contentActivationUat).where(eq(contentActivationUat.versionId, versionId)).limit(1);
      if (!uat) throw new Error("Open the preview and complete the final check first.");
      const artifacts = await db.select().from(contentRuntimeArtifacts).where(eq(contentRuntimeArtifacts.versionId, versionId));
      const fingerprint = await artifactFingerprint(artifacts);
      if (uat.artifactFingerprint !== fingerprint) {
        throw new Error("This version changed after your review started. Open the latest preview again.");
      }
      const previewed = parseJson(uat.previewedArtifacts, []) as string[];
      const checklist = normalizeUatChecklist(parseJson(uat.checklist, {}));
      const artifactKeys = artifacts.map((artifact) => artifact.artifactKey);
      if (!previewCoverageComplete(item.kind as ContentKind, previewed, artifactKeys)) {
        throw new Error(item.kind === "LEARNING_MODULE"
          ? "Preview every learning edition you prepared before signing off."
          : "Preview the Lab before signing off.");
      }
      if (!checklistComplete(checklist)) throw new Error("Complete every item in the final check before marking it ready.");
      const now = new Date().toISOString();
      await db.update(contentActivationUat).set({
        status: "PASSED",
        reviewedBy: identity.id,
        reviewedAt: now,
        updatedBy: identity.id,
        updatedAt: now,
      }).where(eq(contentActivationUat.id, uat.id));
      await audit(identity.id, "CONTENT_ACTIVATION_UAT_PASSED", "CONTENT_LIBRARY_VERSION", versionId, {
        artifactFingerprint: fingerprint,
        previewedArtifacts: previewed,
      });
      return Response.json(await snapshot());
    }

    if (action === "activateVersion") {
      const versionId = String(body.versionId ?? "");
      const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, versionId)).limit(1);
      if (!version || version.status !== "APPROVED" || version.compilerStatus !== "COMPILED" || version.runtimeStatus !== "READY") {
        throw new Error("Prepare, review and approve this version before publishing.");
      }
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, version.itemId)).limit(1);
      if (!item || item.status !== "ACTIVE") throw new Error("That BIS title is not available.");
      const artifacts = await db.select().from(contentRuntimeArtifacts).where(eq(contentRuntimeArtifacts.versionId, versionId));
      const [uat] = await db.select().from(contentActivationUat).where(eq(contentActivationUat.versionId, versionId)).limit(1);
      const fingerprint = await artifactFingerprint(artifacts);
      const uatPreviewed = parseJson(uat?.previewedArtifacts, []) as string[];
      const uatChecklist = normalizeUatChecklist(parseJson(uat?.checklist, {}));
      if (
        !uat ||
        uat.status !== "PASSED" ||
        uat.artifactFingerprint !== fingerprint ||
        !previewCoverageComplete(
          item.kind as ContentKind,
          uatPreviewed,
          artifacts.map((artifact) => artifact.artifactKey),
        ) ||
        !checklistComplete(uatChecklist)
      ) {
        throw new Error("Finish the preview checklist and sign off this exact version before publishing.");
      }
      if (item.kind === "LEARNING_MODULE") {
        const editions = artifacts.map((artifact) => artifact.deliveryEdition).filter(Boolean);
        if (!editions.length) throw new Error("Prepare at least one learning edition before publishing.");
      } else if (!artifacts.some((artifact) => artifact.artifactKey === "lab:universal")) {
        throw new Error("The prepared Lab preview is missing. Prepare this version again.");
      }

      const now = new Date().toISOString();
      const supersededVersions: string[] = [];
      const publishedEditions: DeliveryEdition[] = [];

      if (item.kind === "LEARNING_MODULE") {
        const learningArtifacts = artifacts.filter(
          (artifact) => artifact.deliveryEdition && LEARNING_EDITION_KEYS.includes(artifact.deliveryEdition as DeliveryEdition),
        );
        for (const artifact of learningArtifacts) {
          const edition = artifact.deliveryEdition as DeliveryEdition;
          const [previousEdition] = await db.select().from(contentEditionActivations).where(and(
            eq(contentEditionActivations.itemId, item.id),
            eq(contentEditionActivations.deliveryEdition, edition),
            eq(contentEditionActivations.status, "ACTIVE"),
          )).limit(1);

          if (previousEdition) {
            await db.update(contentEditionActivations).set({
              status: "SUPERSEDED",
              deactivatedAt: now,
            }).where(eq(contentEditionActivations.id, previousEdition.id));
            supersededVersions.push(previousEdition.versionId);
          }

          await db.insert(contentEditionActivations).values({
            id: crypto.randomUUID(),
            itemId: item.id,
            deliveryEdition: edition,
            versionId,
            status: "ACTIVE",
            activatedBy: identity.id,
            supersedesActivationId: previousEdition?.id ?? null,
          });

          const existingPublished = await db.select().from(contentReleases).where(and(
            eq(contentReleases.labCode, item.code),
            eq(contentReleases.deliveryEdition, edition),
            eq(contentReleases.status, "PUBLISHED"),
          ));
          for (const release of existingPublished) {
            await db.update(contentReleases).set({ status: "CONTROLLED" }).where(eq(contentReleases.id, release.id));
          }

          const releaseId = `${item.code}:${edition}:${version.version}:${artifact.artifactHash.slice(0, 8)}`;
          await db.insert(contentReleases).values({
            id: releaseId,
            handbookId: `${item.slug}-content-studio`,
            labCode: item.code,
            deliveryEdition: edition,
            contentVersion: version.version,
            runtimeVersion: "programme-player-3",
            schemaVersion: version.schemaVersion,
            releaseHash: artifact.artifactHash,
            status: "PUBLISHED",
            releasedAt: now,
          }).onConflictDoUpdate({
            target: [contentReleases.labCode, contentReleases.deliveryEdition, contentReleases.contentVersion, contentReleases.releaseHash],
            set: { status: "PUBLISHED", releasedAt: now },
          });
          publishedEditions.push(edition);
        }
      } else {
        const activeRows = await db.select().from(contentRuntimeActivations).where(and(
          eq(contentRuntimeActivations.itemId, item.id),
          eq(contentRuntimeActivations.status, "ACTIVE"),
        ));
        const previous = activeRows[0] ?? null;
        if (previous) {
          await db.update(contentRuntimeActivations).set({
            status: "SUPERSEDED",
            deactivatedAt: now,
          }).where(eq(contentRuntimeActivations.id, previous.id));
          supersededVersions.push(previous.versionId);
        }

        await db.insert(contentRuntimeActivations).values({
          id: crypto.randomUUID(),
          itemId: item.id,
          versionId,
          runtimeMode: "DYNAMIC",
          status: "ACTIVE",
          activatedBy: identity.id,
          supersedesActivationId: previous?.id ?? null,
        });
      }

      const routePath = item.kind === "LEARNING_MODULE" ? `/handbooks/${item.code.toLowerCase()}` : `/labs/${item.code.toLowerCase()}`;
      await db.update(contentLibraryItems).set({ routePath, updatedAt: now }).where(eq(contentLibraryItems.id, item.id));
      await db.update(contentLibraryVersions).set({
        status: "PUBLISHED",
        runtimeStatus: "LIVE",
        publishedAt: now,
        updatedAt: now,
      }).where(eq(contentLibraryVersions.id, versionId));
      await audit(identity.id, "CONTENT_VERSION_ACTIVATED", "CONTENT_LIBRARY_VERSION", versionId, {
        itemId: item.id,
        kind: item.kind,
        routePath,
        editions: item.kind === "LEARNING_MODULE" ? publishedEditions : [],
        supersedes: supersededVersions,
        uatId: uat.id,
        uatReviewedBy: uat.reviewedBy,
        uatReviewedAt: uat.reviewedAt,
        artifactFingerprint: fingerprint,
      });
      return Response.json(await snapshot());
    }

    if (action === "rollbackActivation") {
      const itemId = String(body.itemId ?? "");
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, itemId)).limit(1);
      if (!item) throw new Error("That BIS title could not be found.");
      const activationRows = await db.select().from(contentRuntimeActivations).where(eq(contentRuntimeActivations.itemId, itemId)).orderBy(desc(contentRuntimeActivations.activatedAt));
      const current = activationRows.find((activation) => activation.status === "ACTIVE");
      const previous = activationRows.find((activation) => activation.status === "SUPERSEDED");
      if (!current || !previous) throw new Error("There is no previous runtime version available for rollback.");
      const [currentVersion] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, current.versionId)).limit(1);
      const [previousVersion] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, previous.versionId)).limit(1);
      if (!currentVersion || !previousVersion) throw new Error("Rollback version records are incomplete.");
      const now = new Date().toISOString();
      await db.update(contentRuntimeActivations).set({ status: "ROLLED_BACK", deactivatedAt: now }).where(eq(contentRuntimeActivations.id, current.id));
      await db.update(contentRuntimeActivations).set({ status: "ACTIVE", deactivatedAt: null }).where(eq(contentRuntimeActivations.id, previous.id));
      await db.update(contentLibraryVersions).set({ runtimeStatus: "READY", updatedAt: now }).where(eq(contentLibraryVersions.id, currentVersion.id));
      await db.update(contentLibraryVersions).set({ runtimeStatus: "LIVE", status: "PUBLISHED", publishedAt: now, updatedAt: now }).where(eq(contentLibraryVersions.id, previousVersion.id));

      if (item.kind === "LEARNING_MODULE") {
        const currentReleases = await db.select().from(contentReleases).where(and(
          eq(contentReleases.labCode, item.code),
          eq(contentReleases.contentVersion, currentVersion.version),
        ));
        for (const release of currentReleases) {
          if (release.status === "PUBLISHED") await db.update(contentReleases).set({ status: "CONTROLLED" }).where(eq(contentReleases.id, release.id));
        }
        const previousReleases = await db.select().from(contentReleases).where(and(
          eq(contentReleases.labCode, item.code),
          eq(contentReleases.contentVersion, previousVersion.version),
        ));
        for (const release of previousReleases) {
          await db.update(contentReleases).set({ status: "PUBLISHED", releasedAt: now }).where(eq(contentReleases.id, release.id));
        }
      }
      await audit(identity.id, "CONTENT_RUNTIME_ROLLED_BACK", "CONTENT_LIBRARY_ITEM", itemId, {
        fromVersion: currentVersion.version,
        toVersion: previousVersion.version,
      });
      return Response.json(await snapshot());
    }

    if (action === "archiveItem") {
      const itemId = String(body.itemId ?? "");
      const [item] = await db.select().from(contentLibraryItems).where(eq(contentLibraryItems.id, itemId)).limit(1);
      if (!item) throw new Error("That BIS title could not be found.");
      const live = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.itemId, itemId));
      if (live.some((version) => version.status === "PUBLISHED" && version.runtimeStatus === "LIVE")) {
        throw new Error("A published BIS title cannot be archived while it is live.");
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
