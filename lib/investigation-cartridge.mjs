import { z } from "zod";

export const BLOCK_TYPES = [
  "reading", "story", "system_lens", "reflection", "choice", "activity",
  "evidence_capture", "hypothesis", "experiment_setup", "experiment_day",
  "checkpoint", "calculation", "profile", "certificate", "pause",
];

const semanticId = z.string().regex(/^[A-Z]{3}\.[A-Z0-9][A-Z0-9._-]{1,119}$/);
const fieldId = z.string().regex(/^[A-Z]{3}\.[A-Z0-9][A-Z0-9._-]{1,119}$/);
const privacyClass = z.enum(["P0", "P1", "P2", "P3"]);
const baseBlock = z.object({
  id: semanticId,
  type: z.enum(BLOCK_TYPES),
  title: z.string().min(1),
  body: z.array(z.string().min(1)).default([]),
  accessibilityLabel: z.string().min(3),
  fieldIds: z.array(fieldId).default([]),
  privacyClass: privacyClass.default("P0"),
}).strict();

const session = z.object({
  id: semanticId,
  number: z.number().int().min(1).max(99),
  title: z.string().min(1),
  mission: z.string().min(1),
  phase: z.enum(["LEARN", "INVESTIGATE", "EXPERIMENT", "REVIEW", "PROFILE"]),
  duration: z.string().min(1),
  blocks: z.array(baseBlock).min(1),
}).strict();

export const cartridgeSchema = z.object({
  schemaVersion: z.literal("1.0"),
  handbookId: z.string().min(1),
  labCode: z.enum(["HAB", "DEC", "MON", "IDN"]),
  slug: z.enum(["habit", "decision", "money", "identity"]),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  contentVersion: z.string().min(1),
  sourceTrace: z.object({
    authority: z.string().min(1),
    sourceVersion: z.string().min(1),
    notes: z.string().min(1),
  }).strict(),
  editions: z.record(z.enum(["school", "emerging_adult", "workplace"]), z.object({
    label: z.string().min(1),
    audience: z.string().min(1),
    privacySummary: z.string().min(1),
  }).strict()),
  sessions: z.array(session).min(1),
}).strict();

export function validateCartridge(input) {
  const cartridge = cartridgeSchema.parse(input);
  const ids = new Set();
  const fields = new Set();
  const prefix = `${cartridge.labCode}.`;

  for (const item of cartridge.sessions) {
    for (const candidate of [item.id, ...item.blocks.map((block) => block.id)]) {
      if (!candidate.startsWith(prefix)) throw new Error(`Semantic ID ${candidate} is outside ${cartridge.labCode}.`);
      if (ids.has(candidate)) throw new Error(`Duplicate semantic ID: ${candidate}`);
      ids.add(candidate);
    }
    for (const block of item.blocks) {
      if (block.privacyClass !== "P0" && block.fieldIds.length === 0) {
        throw new Error(`Stateful block ${block.id} requires at least one stable field ID.`);
      }
      for (const candidate of block.fieldIds) {
        if (!candidate.startsWith(prefix)) throw new Error(`Field ID ${candidate} is outside ${cartridge.labCode}.`);
        if (/\.(?:0|[1-9]\d*)$/.test(candidate)) throw new Error(`Positional field ID is forbidden: ${candidate}`);
        fields.add(candidate);
      }
    }
  }

  return cartridge;
}
