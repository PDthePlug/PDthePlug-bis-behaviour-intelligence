import type { UniversalLabPackage, UniversalLabPrompt } from "./content-compiler";
export function availableLabPrompts(definition: UniversalLabPackage, investigationNumber: number, day?: number, preview?: boolean): UniversalLabPrompt[];
export function requiredLabPromptIds(definition: UniversalLabPackage, investigationNumber: number, day?: number): string[];
export function validateLabSubmission(definition: UniversalLabPackage, investigationNumber: number, day: number, items: unknown[], existing?: Record<string, { value: unknown; status?: string }>): Array<{ semanticFieldId: string; prompt: UniversalLabPrompt; responseStatus: "PASS" | "ANSWERED"; value: unknown }>;
