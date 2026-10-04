import { desc, eq } from "@/db/query";
import { getDb } from "@/db";
import {
  contentLibraryItems,
  evidenceRecords,
  labEnrollments,
  measurementSources,
  measurementValues,
} from "@/db/schema";
import { buildEvidencePortfolio } from "@/lib/evidence-portfolio.mjs";
import { BIS_MODULES } from "@/lib/bis-catalogue";

export async function learnerEvidencePortfolio(userId: string) {
  const db = getDb();
  const [enrolments, evidence, measurements, sources, libraryItems] = await Promise.all([
    db.select({
      id: labEnrollments.id,
      labCode: labEnrollments.labCode,
      labVersion: labEnrollments.labVersion,
      status: labEnrollments.status,
      currentInvestigation: labEnrollments.currentInvestigation,
      startedAt: labEnrollments.startedAt,
      phaseACompletedAt: labEnrollments.phaseACompletedAt,
      experimentStartedAt: labEnrollments.experimentStartedAt,
      completedAt: labEnrollments.completedAt,
      updatedAt: labEnrollments.updatedAt,
    }).from(labEnrollments).where(eq(labEnrollments.userId, userId)).orderBy(desc(labEnrollments.updatedAt)),
    db.select({
      id: evidenceRecords.id,
      sourceObjectType: evidenceRecords.sourceObjectType,
      labCode: evidenceRecords.labCode,
      labVersion: evidenceRecords.labVersion,
      investigationId: evidenceRecords.investigationId,
      sourceObjectId: evidenceRecords.sourceObjectId,
      status: evidenceRecords.status,
      occurredAt: evidenceRecords.occurredAt,
      recordedAt: evidenceRecords.recordedAt,
    }).from(evidenceRecords).where(eq(evidenceRecords.userId, userId)).orderBy(desc(evidenceRecords.recordedAt)),
    db.select({
      id: measurementValues.id,
      experimentId: measurementValues.experimentId,
      enrolmentId: measurementValues.enrolmentId,
      labCode: measurementValues.labCode,
      labVersion: measurementValues.labVersion,
      code: measurementValues.code,
      value: measurementValues.value,
      status: measurementValues.status,
      evidenceStrength: measurementValues.evidenceStrength,
      formulaVersion: measurementValues.formulaVersion,
      calculatedAt: measurementValues.calculatedAt,
    }).from(measurementValues).where(eq(measurementValues.userId, userId)).orderBy(desc(measurementValues.calculatedAt)),
    db.select({
      measurementId: measurementSources.measurementId,
      sourceObjectType: measurementSources.sourceObjectType,
      sourceObjectId: measurementSources.sourceObjectId,
      inputRole: measurementSources.inputRole,
      createdAt: measurementSources.createdAt,
    }).from(measurementSources).where(eq(measurementSources.userId, userId)),
    db.select({
      code: contentLibraryItems.code,
      title: contentLibraryItems.title,
    }).from(contentLibraryItems).where(eq(contentLibraryItems.kind, "LAB")),
  ]);

  const labTitles = Object.fromEntries([
    ...BIS_MODULES.map((module) => [module.code, module.title] as const),
    ...libraryItems.map((item) => [item.code, item.title] as const),
  ]);

  return buildEvidencePortfolio({
    enrolments,
    evidence,
    measurements,
    measurementSources: sources,
    labTitles,
  });

}
