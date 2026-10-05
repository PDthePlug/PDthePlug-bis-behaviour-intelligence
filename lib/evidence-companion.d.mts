import type { PortfolioIntelligence } from "./evidence-portfolio.mjs";
export function evidenceCompanion(message: string, context?: {
  responses?: Record<string, { value: unknown; status: string; responseId: string }>;
  events?: unknown[];
  intelligence?: PortfolioIntelligence | null;
}): { reply: string; mode: string; evidenceRefs: string[]; interpretation: { modelVersion: string; classificationStatus: string; confidence: null } };
