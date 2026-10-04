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
import { requestSupabaseClient } from "@/lib/supabase/server";
import { CONTENT_STUDIO_BUCKET, sha256Hex } from "@/lib/content-studio";
import { prepareUniversalLabPresentation } from "@/lib/universal-lab-presentation.mjs";
import type { UniversalLabPackage } from "@/lib/content-compiler";
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

  const metricLabels: Record<string, string> = {};
  const client = requestSupabaseClient();
  const [artifactResult, photoResult] = await Promise.all([client.rpc("bis_portfolio_lab_artifacts"), client.rpc("bis_portfolio_attachment_counts")]);
  if (artifactResult.error || photoResult.error) throw new Error("Your evidence portfolio could not be loaded.");
  const artifactPointers = artifactResult.data;
  const pointers = (artifactPointers ?? []) as Array<{ enrolment_id: string; storage_path: string; artifact_hash: string }>;
  for (let offset = 0; offset < pointers.length; offset += 4) {
    await Promise.all(pointers.slice(offset, offset + 4).map(async (pointer) => {
      const { data } = await client.storage.from(CONTENT_STUDIO_BUCKET).download(pointer.storage_path);
      if (!data || await sha256Hex(new Uint8Array(await data.arrayBuffer())) !== pointer.artifact_hash) return;
      try {
        const definition = prepareUniversalLabPresentation(JSON.parse(await data.text())) as UniversalLabPackage;
        const clean = (label: string) => label.replace(/\b(?:BEI|TEI)[- ]?\d+(?:[- ](?:PRE|POST))?\s*[:·—-]?\s*/gi, "").trim();
        for (const field of definition.computedFields ?? []) metricLabels[`${pointer.enrolment_id}:${field.id}`] = clean(field.label);
        for (const indicator of definition.indicatorRegistry ?? []) {
          metricLabels[`${pointer.enrolment_id}:${definition.identity.code}.${indicator.code.replace("-", "")}`] = clean(indicator.label);
        }
      } catch {
        // Unavailable metadata never becomes an invented behavioural interpretation.
      }
    }));
  }

  return buildEvidencePortfolio({
    enrolments,
    attachments: (photoResult.data ?? []).map((row: { enrolment_id: string; investigation: number; photo_count: number }) => ({ enrolmentId: row.enrolment_id, investigation: row.investigation, photoCount: row.photo_count })),
    metricLabels,
    evidence,
    measurements,
    measurementSources: sources,
    labTitles,
  });

}
