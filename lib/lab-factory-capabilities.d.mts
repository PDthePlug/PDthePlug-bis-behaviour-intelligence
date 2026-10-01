export type LabFactoryCapabilities = {
  baseline: boolean;
  indicatorCodes: string[];
  derivedSignatures: string[];
  experiment: {
    detected: boolean;
    days: number | null;
  };
  repeatableEvidenceTable: boolean;
  profileSummary: boolean;
  certificate: boolean;
  facilitatorGuide: boolean;
  requiresBehaviourRuntimeV2: boolean;
};

export function inspectLabSourceCapabilities(source: unknown): LabFactoryCapabilities;
export function capabilitySummary(capabilities: LabFactoryCapabilities): string[];
