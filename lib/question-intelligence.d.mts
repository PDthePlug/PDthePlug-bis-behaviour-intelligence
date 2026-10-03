export type QuestionIntelligenceRegistryRow = {
  id: string;
  versionId: string;
  labCode: string;
  labVersion: string;
  semanticFieldId: string;
  questionFamily: string;
  label: string;
  evidenceClass: "BASELINE" | "PHASE_A" | "OBSERVATION" | "INTERPRETATION" | "TRANSFER";
  answerModel: string;
  sensitivity: string;
  aggregatePolicy: "EXCLUDE" | "STRUCTURED_ONLY";
  status: "CANDIDATE";
};

export function questionIntelligenceRegistry(
  definition: Record<string, unknown>,
  identity: { labCode: string; labVersion: string; versionId: string },
): QuestionIntelligenceRegistryRow[];
