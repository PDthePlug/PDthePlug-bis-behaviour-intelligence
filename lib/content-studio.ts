export const CONTENT_STUDIO_BUCKET = "bis-content-studio";
export const CONTENT_KINDS = ["LEARNING_MODULE", "LAB"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_SOURCE_FORMATS = [
  "BIS_PACKAGE_JSON",
  "DOCX",
  "PDF",
  "HTML",
  "MARKDOWN",
  "ZIP",
] as const;
export type ContentSourceFormat = (typeof CONTENT_SOURCE_FORMATS)[number];

export type ContentValidationResult = {
  validationStatus: "VALID" | "INVALID";
  runtimeStatus: "READY" | "REQUIRES_ADAPTER" | "BLOCKED";
  report: {
    summary: string;
    checks: Array<{ id: string; label: string; status: "PASS" | "WARN" | "FAIL"; detail: string }>;
    activationReady: boolean;
  };
  manifest: Record<string, unknown>;
};

const unsafeHtml = /<\s*(script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript\s*:/i;

export function sourceFormatFor(fileName: string, mimeType = ""): ContentSourceFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json") || mimeType === "application/json") return "BIS_PACKAGE_JSON";
  if (lower.endsWith(".docx") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "DOCX";
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "PDF";
  if (lower.endsWith(".html") || lower.endsWith(".htm") || mimeType === "text/html") return "HTML";
  if (lower.endsWith(".md") || mimeType === "text/markdown") return "MARKDOWN";
  if (lower.endsWith(".zip") || mimeType === "application/zip") return "ZIP";
  return null;
}

export function safeContentCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12);
}

export function safeContentSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function scanHtml(html: string) {
  return !unsafeHtml.test(html);
}

function validateLearningPackage(payload: Record<string, unknown>, expectedCode: string, expectedVersion: string) {
  const checks: ContentValidationResult["report"]["checks"] = [];
  const envelope = text(payload.kind) === "LEARNING_MODULE";
  const identity = object(payload.identity);
  const treatment = object(payload.treatment);
  const pages = array(treatment?.pages);

  const code = envelope ? text(identity?.code) : text(payload.labCode);
  const version = envelope ? text(identity?.version) : text(payload.contentVersion);
  const title = envelope ? text(identity?.title) : text(payload.title);
  const editions = envelope ? object(payload.editions) : null;

  const hasPageSet = pages.length > 0 || Boolean(editions && Object.keys(editions).length > 0);
  checks.push({
    id: "identity",
    label: "Module identity",
    status: code && title && version ? "PASS" : "FAIL",
    detail: code && title && version ? `${code} · ${title} · v${version}` : "Code, title and version are required.",
  });
  checks.push({
    id: "code",
    label: "Code matches catalogue",
    status: code === expectedCode ? "PASS" : "FAIL",
    detail: code === expectedCode ? expectedCode : `Package code ${code || "missing"} does not match ${expectedCode}.`,
  });
  checks.push({
    id: "version",
    label: "Version matches draft",
    status: version === expectedVersion ? "PASS" : "FAIL",
    detail: version === expectedVersion ? expectedVersion : `Package version ${version || "missing"} does not match ${expectedVersion}.`,
  });
  checks.push({
    id: "pages",
    label: "Learning sequence present",
    status: hasPageSet ? "PASS" : "FAIL",
    detail: hasPageSet ? "A learning sequence is present." : "No learning pages or edition sets were found.",
  });

  const htmlPages = pages
    .map((page) => object(page))
    .filter(Boolean)
    .map((page) => text(page?.html))
    .filter(Boolean);
  const safe = htmlPages.every(scanHtml);
  checks.push({
    id: "html-safety",
    label: "Embedded content safety",
    status: safe ? "PASS" : "FAIL",
    detail: safe ? "No executable HTML was detected." : "Scripts, embedded frames or inline JavaScript are not allowed.",
  });

  const valid = checks.every((check) => check.status !== "FAIL");
  return {
    valid,
    title,
    manifest: {
      kind: "LEARNING_MODULE",
      code,
      version,
      title,
      pageCount: pages.length || null,
      editions: editions ? Object.keys(editions) : payload.edition ? [payload.edition] : [],
      linkedLabCode: text(payload.linkedLabCode) || code,
      schemaVersion: text(payload.schemaVersion) || "unknown",
    },
    checks,
  };
}

function validateLabPackage(payload: Record<string, unknown>, expectedCode: string, expectedVersion: string) {
  const checks: ContentValidationResult["report"]["checks"] = [];
  const identity = object(payload.identity);
  const code = text(identity?.code) || text(payload.code);
  const version = text(identity?.version) || text(payload.version);
  const title = text(identity?.title) || text(payload.title);
  const investigations = array(payload.investigations);
  const runtimeProfile = text(payload.runtimeProfile) || text(identity?.runtimeProfile) || "UNSPECIFIED";

  checks.push({
    id: "identity",
    label: "Lab identity",
    status: code && title && version ? "PASS" : "FAIL",
    detail: code && title && version ? `${code} · ${title} · v${version}` : "Code, title and version are required.",
  });
  checks.push({
    id: "code",
    label: "Code matches catalogue",
    status: code === expectedCode ? "PASS" : "FAIL",
    detail: code === expectedCode ? expectedCode : `Package code ${code || "missing"} does not match ${expectedCode}.`,
  });
  checks.push({
    id: "version",
    label: "Version matches draft",
    status: version === expectedVersion ? "PASS" : "FAIL",
    detail: version === expectedVersion ? expectedVersion : `Package version ${version || "missing"} does not match ${expectedVersion}.`,
  });
  const investigationShape = investigations.length > 0 && investigations.every((value, index) => {
    const item = object(value);
    return Number(item?.number) === index + 1 && Boolean(text(item?.title)) && Boolean(text(item?.mission));
  });
  checks.push({
    id: "investigations",
    label: "Investigation sequence",
    status: investigationShape ? "PASS" : "FAIL",
    detail: investigationShape
      ? `${investigations.length} ordered investigations found.`
      : "Investigations must be sequential and each needs a title and mission.",
  });

  const supportedProfile = ["CORE_V1", "HABIT_V1", "UNIVERSAL_V1"].includes(runtimeProfile);
  checks.push({
    id: "runtime-profile",
    label: "Runtime profile",
    status: supportedProfile ? "PASS" : "WARN",
    detail: supportedProfile
      ? `${runtimeProfile} is recognised by the Content Studio contract.`
      : "The Lab can be stored and reviewed, but a runtime adapter must be assigned before activation.",
  });

  const valid = checks.every((check) => check.status !== "FAIL");
  return {
    valid,
    title,
    runtimeProfile,
    manifest: {
      kind: "LAB",
      code,
      version,
      title,
      investigationCount: investigations.length,
      runtimeProfile,
      schemaVersion: text(payload.schemaVersion) || text(identity?.schemaVersion) || "unknown",
    },
    checks,
  };
}

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function validateContentSource(
  kind: ContentKind,
  code: string,
  version: string,
  sourceFormat: ContentSourceFormat,
  bytes: Uint8Array,
): ContentValidationResult {
  const checks: ContentValidationResult["report"]["checks"] = [];
  if (sourceFormat !== "BIS_PACKAGE_JSON") {
    checks.push({
      id: "source",
      label: "Source file stored",
      status: bytes.byteLength > 0 ? "PASS" : "FAIL",
      detail: bytes.byteLength > 0 ? "The source is available for conversion." : "The uploaded file is empty.",
    });
    checks.push({
      id: "conversion",
      label: "BIS package conversion",
      status: "WARN",
      detail: "This source format needs to be converted into a BIS package before it can be activated.",
    });
    const valid = bytes.byteLength > 0;
    return {
      validationStatus: valid ? "VALID" : "INVALID",
      runtimeStatus: valid ? "REQUIRES_ADAPTER" : "BLOCKED",
      report: {
        summary: valid ? "Source stored. Package conversion is the next step." : "The source could not be validated.",
        checks,
        activationReady: false,
      },
      manifest: { kind, code, version, sourceFormat },
    };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = object(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    payload = null;
  }
  if (!payload) {
    return {
      validationStatus: "INVALID",
      runtimeStatus: "BLOCKED",
      report: {
        summary: "The JSON package could not be read.",
        checks: [{ id: "json", label: "Package JSON", status: "FAIL", detail: "Upload a valid JSON object." }],
        activationReady: false,
      },
      manifest: { kind, code, version, sourceFormat },
    };
  }

  const result = kind === "LEARNING_MODULE"
    ? validateLearningPackage(payload, code, version)
    : validateLabPackage(payload, code, version);
  const runtimeReady = result.valid && !result.checks.some((check) => check.id === "runtime-profile" && check.status === "WARN");
  return {
    validationStatus: result.valid ? "VALID" : "INVALID",
    runtimeStatus: result.valid ? (runtimeReady ? "READY" : "REQUIRES_ADAPTER") : "BLOCKED",
    report: {
      summary: result.valid
        ? runtimeReady
          ? "Package validated and ready for controlled activation."
          : "Package validated. A runtime adapter is still required."
        : "Package validation failed.",
      checks: result.checks,
      activationReady: runtimeReady,
    },
    manifest: result.manifest,
  };
}
