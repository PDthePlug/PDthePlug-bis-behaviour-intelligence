import { desc, eq } from "@/db/query";
import { getDb, withSupabaseRequest } from "@/db";
import {
  contentLibraryItems,
  evidenceRecords,
  labEnrollments,
  measurementSources,
  measurementValues,
} from "@/db/schema";
import { identityFrom } from "@/lib/bis-access";
import { buildEvidencePortfolio } from "@/lib/evidence-portfolio.mjs";
import { BIS_MODULES } from "@/lib/bis-catalogue";

async function portfolioSnapshot() {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  const db = getDb();
  const [enrolments, evidence, measurements, sources, libraryItems] = await Promise.all([
    db.select().from(labEnrollments).where(eq(labEnrollments.userId, identity.id)).orderBy(desc(labEnrollments.updatedAt)),
    db.select().from(evidenceRecords).where(eq(evidenceRecords.userId, identity.id)).orderBy(desc(evidenceRecords.recordedAt)),
    db.select().from(measurementValues).where(eq(measurementValues.userId, identity.id)).orderBy(desc(measurementValues.calculatedAt)),
    db.select().from(measurementSources).where(eq(measurementSources.userId, identity.id)),
    db.select().from(contentLibraryItems).where(eq(contentLibraryItems.kind, "LAB")),
  ]);

  const labTitles = Object.fromEntries([
    ...BIS_MODULES.map((module) => [module.code, module.title] as const),
    ...libraryItems.map((item) => [item.code, item.title] as const),
  ]);

  const labs = buildEvidencePortfolio({
    enrolments,
    evidence,
    measurements,
    measurementSources: sources,
    labTitles,
  });

  return Response.json({
    identity: { displayName: identity.displayName },
    labs,
    privacy: {
      originalResponsesIncluded: false,
      note: "The portfolio shows evidence structure and derived measures. Private response wording remains in the learner's Lab record.",
    },
  }, { headers: { "cache-control": "private, no-store" } });
}

export async function GET() {
  return withSupabaseRequest(portfolioSnapshot);
}
