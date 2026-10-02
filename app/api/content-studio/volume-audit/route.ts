import {
  AccessError,
  getRoles,
  identityFrom,
  requireRole,
} from "../../../../lib/bis-access";
import { compileUniversalLab } from "../../../../lib/content-compiler";
import { adaptBisVolumeSource } from "../../../../lib/content-source-adapters";

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
    await requireSuperUser();
    const form = await request.formData();
    const file = form.get("file");
    const volume = Number(form.get("volume"));
    const version = safeVersion(form.get("version"));

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
          compileStatus: "COMPILED",
          standardVersion: compiled.standardVersion ?? null,
          editorialStatus: compiled.editorialAudit?.status ?? "REVIEW",
          editorialIssues: compiled.editorialAudit?.issues ?? [],
          normalizationNotes: compiled.normalizationNotes ?? [],
          investigationCount: compiled.investigations?.length ?? 0,
          promptCount: compiled.investigations?.reduce((sum, item) => sum + (item.prompts?.length ?? 0), 0) ?? 0,
        });
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
      labs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
