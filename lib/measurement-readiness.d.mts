export type MeasurementReadiness = {
  modelVersion: string; labCode: string | null; labVersion: string | null;
  status: 'BLOCKED' | 'REVIEW' | 'SUPPORTED'; calculationCount: number; projectionCount: number;
  calculations: Array<{ id: string; label: string; operation: string; kind: string; sourceFieldIds: string[]; status: string }>;
  indicators: Array<{ code: string; label: string; status: string; sourceFieldIds: string[]; calculationId: string | null }>;
  issues: Array<{ code: string; indicatorCode?: string; message: string }>;
  boundary: string;
};
export function auditMeasurementReadiness(definition?: Record<string, unknown>): MeasurementReadiness;
