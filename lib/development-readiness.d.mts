export type DevelopmentAssessmentReadiness = {
  learnerReport: boolean;
  practicalUse: boolean;
  transfer: boolean;
};
export function developmentAssessmentReadiness(workspace: unknown, labCode?: string, labVersion?: string): DevelopmentAssessmentReadiness | null;
