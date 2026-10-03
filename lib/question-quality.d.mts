export type QuestionQualityAudit = {
  totalPrompts: number;
  learnerInputs: number;
  derivedFields: number;
  reusedInputs: number;
  duplicateGroups: Array<{
    fingerprint: string;
    promptIds: string[];
    investigations: number[];
    count: number;
  }>;
  denseInvestigations: Array<{
    investigation: number;
    learnerInputs: number;
  }>;
  reviewItems: string[];
  principle: string;
};

export function auditLabQuestionQuality(definition: Record<string, unknown>): QuestionQualityAudit;
