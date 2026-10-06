import type { UniversalLabPackage } from "./content-compiler";
export type LearnerCalculationContext = { id: string; label: string; calculation: string; meaning: string; sources: Array<{ id: string; label: string }> };
export function learnerCalculationContexts(definition: UniversalLabPackage): LearnerCalculationContext[];
