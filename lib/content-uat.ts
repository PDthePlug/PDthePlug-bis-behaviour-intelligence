import type { ContentKind } from "./content-studio";
import { sha256Hex } from "./content-studio";

export const CONTENT_UAT_CHECKS = [
  {
    id: "authored_content",
    label: "Authored content is correct",
    detail: "Wording, page order, headings, media and examples match the approved source.",
  },
  {
    id: "navigation",
    label: "Navigation behaves correctly",
    detail: "Back, next, programme-map or investigation navigation stays inside the intended experience.",
  },
  {
    id: "inputs_privacy",
    label: "Inputs and privacy language are correct",
    detail: "Learner response fields, pass controls and privacy wording appear in the right places.",
  },
  {
    id: "responsive",
    label: "Desktop and mobile layouts are usable",
    detail: "The experience remains readable and consistent at desktop and mobile widths.",
  },
  {
    id: "handoff_completion",
    label: "Handoffs and completion states are correct",
    detail: "Module-to-Lab handoffs, return paths and completion states behave as intended.",
  },
  {
    id: "learner_language",
    label: "Learner-facing language is clear",
    detail: "No implementation jargon, internal terminology or technical error language appears in the learner experience.",
  },
] as const;

export type ContentUatCheckId = (typeof CONTENT_UAT_CHECKS)[number]["id"];
export type ContentUatChecklist = Partial<Record<ContentUatCheckId, boolean>>;

export function requiredPreviewKeys(kind: ContentKind, availableArtifactKeys?: string[]) {
  if (kind === "LAB") return ["lab:universal"];
  const learningKeys = ["learning:school", "learning:emerging_adult", "learning:workplace"];
  if (!availableArtifactKeys) return learningKeys;
  const available = new Set(availableArtifactKeys);
  return learningKeys.filter((key) => available.has(key));
}

export function normalizeUatChecklist(value: unknown): ContentUatChecklist {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(
    CONTENT_UAT_CHECKS.map((check) => [check.id, source[check.id] === true]),
  ) as ContentUatChecklist;
}

export function checklistComplete(value: ContentUatChecklist) {
  return CONTENT_UAT_CHECKS.every((check) => value[check.id] === true);
}

export function previewCoverageComplete(
  kind: ContentKind,
  previewed: string[],
  availableArtifactKeys?: string[],
) {
  const seen = new Set(previewed);
  const required = requiredPreviewKeys(kind, availableArtifactKeys);
  return required.length > 0 && required.every((key) => seen.has(key));
}

export async function artifactFingerprint(
  artifacts: Array<{ artifactKey: string; artifactHash: string }>,
) {
  const canonical = artifacts
    .map((artifact) => `${artifact.artifactKey}:${artifact.artifactHash}`)
    .sort()
    .join("|");
  return sha256Hex(new TextEncoder().encode(canonical));
}
