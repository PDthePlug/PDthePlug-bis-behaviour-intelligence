import { and, desc, eq, or } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  auditEvents,
  contentReleases,
  handbookProgress,
  learners,
  responses,
} from "../../../db/schema";
import { identityFrom } from "../../../lib/bis-access";
import { isDeliveryEdition, type LabCode } from "../../../lib/learning-foundation";

const STEP_ID = /^[A-Z]{3}\.[A-Z0-9][A-Z0-9._-]{1,119}$/;
const WORKBOOK_FIELD_ID = /^HAB\.WB\.[A-Z0-9._-]{3,160}$/;
const LAB_CODES = new Set<LabCode>(["HAB", "DEC", "MON", "IDN"]);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

function encode(value: unknown) {
  return JSON.stringify(value ?? null);
}

function decode(value: string | null) {
  if (value === null) return "";
  try {
    const parsed = JSON.parse(value);
    return parsed === null || parsed === undefined ? "" : String(parsed);
  } catch {
    return value;
  }
}

async function audit(
  userId: string,
  action: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, unknown>,
) {
  await getDb().insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorId: userId,
    action,
    objectType,
    objectId,
    metadata: JSON.stringify(metadata),
  });
}

async function learningSnapshot(userId: string) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(learners)
    .where(eq(learners.userId, userId))
    .limit(1);
  if (!profile) throw new Error("Complete learner setup before opening the learning library.");

  const releases = await db
    .select()
    .from(contentReleases)
    .where(and(
      eq(contentReleases.deliveryEdition, profile.deliveryEdition),
      or(eq(contentReleases.status, "PUBLISHED"), eq(contentReleases.status, "CONTROLLED")),
    ))
    .orderBy(contentReleases.labCode, desc(contentReleases.createdAt));

  const progress = await db
    .select()
    .from(handbookProgress)
    .where(eq(handbookProgress.userId, userId))
    .orderBy(desc(handbookProgress.lastSeenAt));

  const responseRows = await db
    .select()
    .from(responses)
    .where(and(eq(responses.userId, userId), eq(responses.labCode, "HAB")))
    .orderBy(desc(responses.recordedAt));
  const workbookResponses: Record<string, {
    value: string;
    semanticStepId: string;
    sourceFieldKey: string;
    updatedAt: string;
  }> = {};
  for (const row of responseRows) {
    if (row.provenance !== "LR" || row.responseStatus === "SUPERSEDED" || !row.semanticFieldId.startsWith("HAB.WB.")) continue;
    if (workbookResponses[row.semanticFieldId]) continue;
    const promptParts = row.promptId.split(":");
    workbookResponses[row.semanticFieldId] = {
      value: decode(row.value),
      semanticStepId: promptParts[1] ?? "",
      sourceFieldKey: promptParts[2] ?? row.promptId,
      updatedAt: row.recordedAt,
    };
  }

  return {
    profile: {
      displayName: profile.displayName,
      deliveryEdition: profile.deliveryEdition,
      deliveryContext: profile.deliveryContext,
      language: profile.language,
      timezone: profile.timezone,
    },
    releases,
    progress,
    workbookResponses,
  };
}

async function getHandler() {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    return Response.json(await learningSnapshot(identity.id));
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

async function postHandler(request: Request) {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const db = getDb();

    if (action === "setDeliveryEdition") {
      const edition = body.deliveryEdition;
      if (!isDeliveryEdition(edition)) throw new Error("Choose School, Emerging Adult, or Workplace edition.");
      await db.update(learners).set({
        deliveryEdition: edition,
        updatedAt: new Date().toISOString(),
      }).where(eq(learners.userId, identity.id));
      await audit(identity.id, "DELIVERY_EDITION_CHANGED", "LEARNER", identity.id, { deliveryEdition: edition });
      return Response.json(await learningSnapshot(identity.id));
    }

    if (action === "saveProgress") {
      const labCode = String(body.labCode ?? "") as LabCode;
      const contentReleaseId = String(body.contentReleaseId ?? "");
      const semanticStepId = String(body.semanticStepId ?? "").trim().toUpperCase();
      const status = body.status === "COMPLETED" ? "COMPLETED" : "STARTED";
      if (!LAB_CODES.has(labCode)) throw new Error("Choose a valid BIS Lab.");
      if (!contentReleaseId) throw new Error("A content release is required for progress.");
      if (!STEP_ID.test(semanticStepId) || !semanticStepId.startsWith(`${labCode}.`)) {
        throw new Error("Progress must use a stable semantic step ID in the selected Lab namespace.");
      }

      const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
      const [release] = await db.select().from(contentReleases).where(and(
        eq(contentReleases.id, contentReleaseId),
        eq(contentReleases.labCode, labCode),
        eq(contentReleases.deliveryEdition, profile?.deliveryEdition ?? "school"),
      )).limit(1);
      if (!profile || !release || release.status === "RETIRED") {
        throw new Error("That curriculum release is not available for this learner edition.");
      }

      const now = new Date().toISOString();
      await db.insert(handbookProgress).values({
        id: crypto.randomUUID(),
        userId: identity.id,
        labCode,
        deliveryEdition: profile.deliveryEdition,
        contentReleaseId,
        semanticStepId,
        status,
        syncState: "SYNCED",
        completedAt: status === "COMPLETED" ? now : null,
      }).onConflictDoUpdate({
        target: [handbookProgress.userId, handbookProgress.contentReleaseId, handbookProgress.semanticStepId],
        set: {
          status,
          syncState: "SYNCED",
          lastSeenAt: now,
          completedAt: status === "COMPLETED" ? now : null,
          updatedAt: now,
        },
      });
      await audit(identity.id, "HANDBOOK_PROGRESS_SAVED", "CONTENT_RELEASE", contentReleaseId, { labCode, semanticStepId, status });
      return Response.json(await learningSnapshot(identity.id));
    }

    if (action === "saveWorkbookResponses") {
      const labCode = String(body.labCode ?? "") as LabCode;
      const contentReleaseId = String(body.contentReleaseId ?? "");
      const items = Array.isArray(body.items) ? body.items : [];
      if (labCode !== "HAB") throw new Error("Habit Lab is the current programme-player production standard.");
      if (!contentReleaseId) throw new Error("A content release is required before saving workbook responses.");
      if (items.length < 1 || items.length > 60) throw new Error("Save between 1 and 60 workbook responses at a time.");

      const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
      const [release] = await db.select().from(contentReleases).where(and(
        eq(contentReleases.id, contentReleaseId),
        eq(contentReleases.labCode, "HAB"),
        eq(contentReleases.deliveryEdition, profile?.deliveryEdition ?? "school"),
      )).limit(1);
      if (!profile || !release || release.status === "RETIRED") throw new Error("That handbook release is not available for this learner edition.");

      for (const raw of items) {
        if (!raw || typeof raw !== "object") throw new Error("One workbook response is invalid.");
        const item = raw as Record<string, unknown>;
        const semanticFieldId = String(item.semanticFieldId ?? "").trim().toUpperCase();
        const semanticStepId = String(item.semanticStepId ?? "").trim().toUpperCase();
        const sourceFieldKey = String(item.sourceFieldKey ?? "").trim();
        const value = String(item.value ?? "");
        if (!WORKBOOK_FIELD_ID.test(semanticFieldId)) throw new Error("Workbook responses must use the HAB.WB semantic namespace.");
        if (!STEP_ID.test(semanticStepId) || !semanticStepId.startsWith("HAB.PROGRAMME.")) throw new Error("Workbook responses must belong to a Habit programme page.");
        if (!sourceFieldKey || sourceFieldKey.length > 120) throw new Error("Workbook source field identity is missing.");
        if (value.length > 20_000) throw new Error("Keep each workbook response under 20,000 characters.");

        const [previous] = await db.select().from(responses).where(and(
          eq(responses.userId, identity.id),
          eq(responses.contentReleaseId, contentReleaseId),
          eq(responses.semanticFieldId, semanticFieldId),
        )).orderBy(desc(responses.recordedAt)).limit(1);
        const responseId = crypto.randomUUID();
        if (previous && previous.responseStatus !== "SUPERSEDED") {
          await db.update(responses).set({ responseStatus: "SUPERSEDED" }).where(eq(responses.id, previous.id));
        }
        await db.insert(responses).values({
          id: responseId,
          userId: identity.id,
          promptId: `LEARNING:${semanticStepId}:${sourceFieldKey}`,
          semanticFieldId,
          labCode: "HAB",
          labVersion: "HANDBOOK-1.4",
          contentReleaseId,
          deliveryEdition: profile.deliveryEdition,
          promptVersion: release.contentVersion,
          privacyClass: "P3",
          provenance: "LR",
          value: encode(value),
          responseStatus: "ANSWERED",
          occurredAt: new Date().toISOString(),
          supersedesResponseId: previous?.id ?? null,
        });
        await audit(identity.id, previous ? "HANDBOOK_RESPONSE_CORRECTED" : "HANDBOOK_RESPONSE_CREATED", "LEARNING_RESPONSE", responseId, {
          labCode: "HAB",
          semanticFieldId,
          semanticStepId,
          contentReleaseId,
          provenance: "LR",
          privacyClass: "P3",
        });
      }
      return Response.json(await learningSnapshot(identity.id));
    }

    throw new Error("That learning action is not supported.");
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function GET() {
  return withSupabaseRequest(() => getHandler());
}

export async function POST(request: Request) {
  return withSupabaseRequest(() => postHandler(request));
}
