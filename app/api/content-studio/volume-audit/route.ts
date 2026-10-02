import {
  AccessError,
  getRoles,
  identityFrom,
  requireRole,
} from "../../../../lib/bis-access";
import { eq } from "../../../../db/query";
import { getDb } from "../../../../db";
import {
  contentActivationUat,
  contentLibraryItems,
  contentLibraryVersions,
  contentRuntimeArtifacts,
  contentSourceFiles,
} from "../../../../db/schema";
import { compileUniversalLab } from "../../../../lib/content-compiler";
import { adaptBisVolumeSource } from "../../../../lib/content-source-adapters";
import { CONTENT_STUDIO_BUCKET, sha256Hex } from "../../../../lib/content-studio";
import { requestSupabaseClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "The BIS volume could not be audited." },
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

function safeVersion(value: FormDataEntryValue | null) {
  const version = String(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(version)) {
    throw new Error("Use a short audit version such as 1.0, 4.5.2 or source-2026.");
  }
  return version;
}

export async function POST(request: Request) {
  try {
    const identity = await requireSuperUser();
    const form = await request.formData();
    const file = form.get("file");
    const volume = Number(form.get("volume"));
    const requestedVersion = safeVersion(form.get("version"));
    const stage = String(form.get("stage") ?? "") === "1";
    const version = stage ? "1.0" : requestedVersion;

    if (!(file instanceof File)) throw new Error("Choose a BIS Volume Word document.");
    if (![1, 2, 3].includes(volume)) throw new Error("Choose BIS Volume 1, 2 or 3.");
    if (!/\.docx$/i.test(file.name)) throw new Error("Volume Audit currently accepts the original Word (.docx) source.");
    if (file.size < 1 || file.size > 26_214_400) throw new Error("Use a BIS Volume source up to 25 MB.");

    const drafts = await adaptBisVolumeSource(
      new Uint8Array(await file.arrayBuffer()),
      volume as 1 | 2 | 3,
      version,
    );

    const labs = [];
    const staged: Array<{ code: string; versionId: string; storagePath: string }> = [];
    const db = getDb();
    const storage = requestSupabaseClient().storage.from(CONTENT_STUDIO_BUCKET);

    for (const draft of drafts) {
      try {
        const artifact = await compileUniversalLab(
          draft.packageBytes,
          draft.code,
          version,
        );
        const compiled = JSON.parse(artifact.content) as {
          standardVersion?: string;
          editorialAudit?: {
            status?: "PASS" | "REVIEW" | "BLOCKED";
            issues?: Array<{
              code?: string;
              severity?: string;
              investigation?: number;
              promptId?: string;
              message?: string;
            }>;
          };
          normalizationNotes?: Array<Record<string, unknown>>;
          sourceMigration?: Record<string, unknown>;
          investigations?: Array<{ number?: number; title?: string; prompts?: unknown[] }>;
        };
        const labResult = {
          code: draft.code,
          title: draft.title,
          slug: draft.slug,
          sourceProductNumber: draft.sourceProductNumber,
          sourcePosition: draft.sourcePosition,
          canonicalPosition: draft.canonicalPosition,
          detectedLearnerCopies: draft.detectedLearnerCopies,
          expectedLearnerCopies: draft.expectedLearnerCopies,
          sourceWarnings: draft.warnings,
          compileStatus: "COMPILED" as const,
          standardVersion: compiled.standardVersion ?? null,
          editorialStatus: compiled.editorialAudit?.status ?? "REVIEW",
          editorialIssues: compiled.editorialAudit?.issues ?? [],
          normalizationNotes: compiled.normalizationNotes ?? [],
          investigationCount: compiled.investigations?.length ?? 0,
          promptCount: compiled.investigations?.reduce((sum, item) => sum + (item.prompts?.length ?? 0), 0) ?? 0,
          stageStatus: (stage ? "PENDING" : "NOT_REQUESTED") as "PENDING" | "NOT_REQUESTED" | "STAGED",
        };

        if (stage) {
          const versionId = `content:lab:${draft.code}:1.0`;
          const [contentVersion] = await db
            .select()
            .from(contentLibraryVersions)
            .where(eq(contentLibraryVersions.id, versionId))
            .limit(1);
          if (!contentVersion || contentVersion.status !== "DRAFT") {
            throw new Error(`${draft.code}: version 1.0 is not an editable draft.`);
          }
          const [item] = await db
            .select()
            .from(contentLibraryItems)
            .where(eq(contentLibraryItems.id, contentVersion.itemId))
            .limit(1);
          if (!item || item.kind !== "LAB" || item.code !== draft.code) {
            throw new Error(`${draft.code}: the 1.0 draft is not linked to the expected Lab.`);
          }

          const slot = `sources/${versionId}/lab`;
          const existingObjects = await storage.list(slot, { limit: 100 });
          if (existingObjects.error) throw new Error(`${draft.code}: existing source files could not be inspected.`);
          if (existingObjects.data.length) {
            const removals = existingObjects.data
              .filter((entry) => entry.name)
              .map((entry) => `${slot}/${entry.name}`);
            if (removals.length) {
              const removed = await storage.remove(removals);
              if (removed.error) throw new Error(`${draft.code}: previous draft source could not be replaced.`);
            }
          }

          const sourceFileName = `${draft.code.toLowerCase()}-volume-${volume}-v1.0.json`;
          const storagePath = `${slot}/${sourceFileName}`;
          const upload = await storage.upload(storagePath, draft.packageBytes, {
            contentType: "application/json",
            cacheControl: "0",
            upsert: true,
          });
          if (upload.error) throw new Error(`${draft.code}: ${upload.error.message}`);

          const sourceHash = await sha256Hex(draft.packageBytes);
          const now = new Date().toISOString();
          await db.insert(contentSourceFiles).values({
            id: `${versionId}:source:lab`,
            versionId,
            itemId: item.id,
            sourceKey: "lab",
            deliveryEdition: null,
            sourceFormat: "BIS_PACKAGE_JSON",
            fileName: sourceFileName,
            storagePath,
            sourceHash,
            sourceBytes: draft.packageBytes.byteLength,
            mimeType: "application/json",
            createdBy: identity.id,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: [contentSourceFiles.versionId, contentSourceFiles.sourceKey],
            set: {
              deliveryEdition: null,
              sourceFormat: "BIS_PACKAGE_JSON",
              fileName: sourceFileName,
              storagePath,
              sourceHash,
              sourceBytes: draft.packageBytes.byteLength,
              mimeType: "application/json",
              updatedAt: now,
            },
          });

          await db.delete(contentRuntimeArtifacts).where(eq(contentRuntimeArtifacts.versionId, versionId));
          await db.delete(contentActivationUat).where(eq(contentActivationUat.versionId, versionId));
          await db.update(contentLibraryVersions).set({
            schemaVersion: "universal-lab-v1",
            sourceFormat: "BIS_PACKAGE_JSON",
            validationStatus: "PENDING",
            runtimeStatus: "REQUIRES_ADAPTER",
            validationReport: "{}",
            status: "DRAFT",
            compilerStatus: "NOT_COMPILED",
            compilerReport: "{}",
            compilerVersion: null,
            compiledAt: null,
            compiledBy: null,
            validatedAt: null,
            approvedAt: null,
            approvedBy: null,
            publishedAt: null,
            manifest: JSON.stringify({
              source: "BIS supplied volume migration",
              sourceVolume: volume,
              sourceFile: file.name,
              migrationVersion: "1.0",
              editorialStatus: compiled.editorialAudit?.status ?? "REVIEW",
              sourceWarnings: draft.warnings,
            }),
            releaseNotes: "Source-backed BIS Volume migration. Preserve authored content, strengthen to the Habit Lab standard, and complete editorial review before approval.",
            updatedAt: now,
          }).where(eq(contentLibraryVersions.id, versionId));

          staged.push({ code: draft.code, versionId, storagePath });
          labResult.stageStatus = "STAGED";
        }
        labs.push(labResult);
      } catch (error) {
        labs.push({
          code: draft.code,
          title: draft.title,
          slug: draft.slug,
          sourceProductNumber: draft.sourceProductNumber,
          sourcePosition: draft.sourcePosition,
          canonicalPosition: draft.canonicalPosition,
          detectedLearnerCopies: draft.detectedLearnerCopies,
          expectedLearnerCopies: draft.expectedLearnerCopies,
          sourceWarnings: draft.warnings,
          compileStatus: "BLOCKED",
          standardVersion: null,
          editorialStatus: "BLOCKED",
          editorialIssues: [{
            code: "COMPILE_BLOCKER",
            severity: "ERROR",
            message: error instanceof Error ? error.message : "This Lab could not be compiled.",
          }],
          normalizationNotes: [],
          investigationCount: 0,
          promptCount: 0,
          stageStatus: stage ? "FAILED" : "NOT_REQUESTED",
        });
      }
    }

    return Response.json({
      volume,
      fileName: file.name,
      version,
      expectedLabs: drafts.length,
      compiledLabs: labs.filter((lab) => lab.compileStatus === "COMPILED").length,
      blockedLabs: labs.filter((lab) => lab.compileStatus === "BLOCKED").length,
      editorialReviewLabs: labs.filter((lab) => lab.editorialStatus === "REVIEW").length,
      passLabs: labs.filter((lab) => lab.editorialStatus === "PASS").length,
      stagedLabs: staged.length,
      stageRequested: stage,
      staged,
      labs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
