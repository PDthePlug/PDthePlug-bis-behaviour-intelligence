export type PrivacyClass = "P0" | "P1" | "P2" | "P3";
export type CartridgeBlockType = "reading" | "story" | "system_lens" | "reflection" | "choice" | "activity" | "evidence_capture" | "hypothesis" | "experiment_setup" | "experiment_day" | "checkpoint" | "calculation" | "profile" | "certificate" | "pause";
export type CartridgeBlock = { id: string; type: CartridgeBlockType; title: string; body: string[]; accessibilityLabel: string; fieldIds: string[]; privacyClass: PrivacyClass };
export type CartridgeSession = { id: string; number: number; title: string; mission: string; phase: "LEARN" | "INVESTIGATE" | "EXPERIMENT" | "REVIEW" | "PROFILE"; duration: string; blocks: CartridgeBlock[] };
export type InvestigationCartridge = { schemaVersion: "1.0"; handbookId: string; labCode: "HAB" | "DEC" | "MON" | "IDN"; slug: "habit" | "decision" | "money" | "identity"; title: string; subtitle: string; contentVersion: string; sourceTrace: { authority: string; sourceVersion: string; notes: string }; editions: Record<"school" | "emerging_adult" | "workplace", { label: string; audience: string; privacySummary: string }>; sessions: CartridgeSession[] };
export const BLOCK_TYPES: readonly CartridgeBlockType[];
export function validateCartridge(input: unknown): InvestigationCartridge;
