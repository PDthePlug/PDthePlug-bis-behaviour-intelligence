import { and, desc, eq, or } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  auditEvents,
  contentReleases,
  handbookProgress,
  learners,
} from "../../../db/schema";
import { identityFrom } from "../../../lib/bis-access";
import {
  isDeliveryEdition,
  type LabCode,
} from "../../../lib/learning-foundation";

const STEP_ID = /^[A-Z]{3}\.[A-Z0-9][A-Z0-9._-]{2,119}$/;
const LAB_CODES = new Set<LabCode>(["HAB", "DEC", "MON", "IDN"]);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
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
      const id = crypto.randomUUID();
      await db.insert(handbookProgress).values({
        id,
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
      await audit(identity.id, "HANDBOOK_PROGRESS_SAVED", "CONTENT_RELEASE", contentReleaseId, {
        labCode,
        semanticStepId,
        status,
      });
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
