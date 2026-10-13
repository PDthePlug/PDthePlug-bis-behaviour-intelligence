export const EVIDENCE_STAGES = Object.freeze([
  "NOT_YET_EVIDENCED",
  "NOTICE",
  "EXPLAIN",
  "APPLY",
  "TEST_AND_REVISE",
  "TRANSFER",
]);

export const AGENT_TYPES = Object.freeze([
  "RESPONSE_INTERPRETATION",
  "EVIDENCE_CLASSIFICATION",
  "LONGITUDINAL_SYNTHESIS",
  "QUALITY_CONTRADICTION",
  "PROGRAMME_INSIGHT",
]);

const STAGE_RANK = new Map(EVIDENCE_STAGES.map((stage, index) => [stage, index]));
const REPORTABLE_SENSITIVITY = new Set(["P0", "P1", "P2"]);

export function evidenceAiEnabled(env = process.env) {
  return String(env.BIS_EVIDENCE_AI_ENABLED ?? "").toLowerCase() === "true";
}

export function evidenceAiMinConfidence(env = process.env) {
  const configured = Number(env.BIS_EVIDENCE_AI_MIN_CONFIDENCE ?? 0.8);
  if (!Number.isFinite(configured)) return 0.8;
  return Math.min(0.99, Math.max(0.5, configured));
}

export function sensitivityMayReachModel(sensitivity) {
  return REPORTABLE_SENSITIVITY.has(String(sensitivity ?? ""));
}

export function minimiseLearnerText(value, maxLength = 6000) {
  const source = String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  const redacted = source
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL_REDACTED]")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[URL_REDACTED]")
    .replace(/(?<!\w)\+?\d(?:[\s().-]*\d){7,14}(?!\w)/g, "[PHONE_REDACTED]")
    .replace(/\b(?:student|learner|user|account|id)\s*[:#-]?\s*[A-Z0-9_-]{6,}\b/gi, "[IDENTIFIER_REDACTED]");

  return redacted.slice(0, Math.max(0, maxLength));
}

export function modelAssistedQuestionEligible(registry) {
  if (!registry || typeof registry !== "object") return false;
  return (
    registry.status === "ACTIVE" &&
    registry.aggregate_policy === "MODEL_ASSISTED" &&
    registry.answer_model === "TEXT" &&
    registry.sensitivity !== "P3"
  );
}

export function clampEvidenceStage(stage, ceiling) {
  const requestedRank = STAGE_RANK.get(stage);
  const ceilingRank = STAGE_RANK.get(ceiling);
  if (requestedRank == null || ceilingRank == null) return "NOT_YET_EVIDENCED";
  return requestedRank <= ceilingRank ? stage : ceiling;
}

export function humanReviewRequired({
  confidence,
  contradiction = false,
  uncertainty = false,
  modelError = false,
  sensitivity = "P2",
  minConfidence = evidenceAiMinConfidence(),
} = {}) {
  const numericConfidence = Number(confidence);
  return (
    modelError ||
    contradiction ||
    uncertainty ||
    sensitivity === "P3" ||
    !Number.isFinite(numericConfidence) ||
    numericConfidence < minConfidence
  );
}

export function normaliseConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.min(1, Math.max(0, numeric)) * 1000) / 1000;
}

export function stableEvidenceFingerprint(parts) {
  // Non-cryptographic canonical fingerprint for idempotent orchestration keys.
  // The database remains the authority for uniqueness; raw learner text is never stored in the ledger.
  const canonical = JSON.stringify(parts, Object.keys(parts ?? {}).sort());
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ei_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function programmeInsightInputIsAggregateOnly(value) {
  if (!value || typeof value !== "object") return false;
  const forbiddenKeys = new Set([
    "answer",
    "answers",
    "response",
    "responses",
    "rawText",
    "raw_text",
    "learnerName",
    "learner_name",
    "learnerUserId",
    "learner_user_id",
    "email",
    "phone",
  ]);

  const visit = (node) => {
    if (Array.isArray(node)) return node.every(visit);
    if (!node || typeof node !== "object") return true;
    return Object.entries(node).every(([key, child]) => !forbiddenKeys.has(key) && visit(child));
  };

  return visit(value);
}

export function safeEvidenceSummary(summary, maxLength = 500) {
  return minimiseLearnerText(summary, maxLength)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}
