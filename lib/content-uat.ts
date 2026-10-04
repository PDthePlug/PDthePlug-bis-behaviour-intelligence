import type { ContentKind } from "./content-studio";
import { sha256Hex } from "./content-studio";

export const CONTENT_UAT_CHECKS = [
  {
    id: "authored_content",
    label: "The content looks right",
    detail: "Check wording, order, headings, examples, table relationships and media against your source.",
  },
  {
    id: "navigation",
    label: "Moving through it feels right",
    detail: "Check Back, Next, the programme map and investigation navigation.",
  },
  {
    id: "inputs_privacy",
    label: "Questions and privacy wording are right",
    detail: "Check each question, its response group, calculated evidence and privacy wording.",
  },
  {
    id: "responsive",
    label: "It works on phone and desktop",
    detail: "Check that nothing is cramped, cut off or confusing on either view.",
  },
  {
    id: "handoff_completion",
    label: "The journey connects properly",
    detail: "Check links between learning, the Lab, completion and return paths.",
  },
  {
    id: "learner_language",
    label: "The language is clear",
    detail: "Check that a learner can understand every instruction without technical or internal wording.",
  },
] as const;

export type ContentUatCheckId = (typeof CONTENT_UAT_CHECKS)[number]["id"] | "editorial_review";
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
    [...CONTENT_UAT_CHECKS.map((check) => [check.id, source[check.id] === true]),
      ["editorial_review", source.editorial_review === true]],
  ) as ContentUatChecklist;
}

export function checklistComplete(value: ContentUatChecklist) {
  return CONTENT_UAT_CHECKS.every((check) => value[check.id] === true);
}

export function editorialReviewComplete(
  report: { editorialStatus?: string | null; editorialWarnings?: string[] },
  checklist: ContentUatChecklist,
  notes: string,
) {
  if (report.editorialStatus === "PASS" || !report.editorialStatus) return true;
  return report.editorialStatus === "REVIEW"
    && checklist.editorial_review === true && notes.trim().length >= 20;
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
