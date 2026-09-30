import { validPromptResponse } from "../../../lib/evidence-validation.mjs";
import { sanitizeRuntimePackage } from "../../../lib/content-html.mjs";
import { and, desc, eq } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  auditEvents,
  consentRecords,
  contentLibraryItems,
  contentLibraryVersions,
  contentRuntimeActivations,
  contentRuntimeArtifacts,
  labEnrollments,
  learners,
  responses,
} from "../../../db/schema";
import { identityFrom } from "../../../lib/bis-access";
import { requestSupabaseClient } from "../../../lib/supabase/server";
import { CONTENT_STUDIO_BUCKET } from "../../../lib/content-studio";
import type { UniversalLabPackage, UniversalLabPrompt } from "../../../lib/content-compiler";
import { investigationUnlockedAfterSave } from "../../../lib/lab-lifecycle-contract";

function decode(value: string | null) {
  if (value === null) return "";
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function audit(actorId: string, action: string, objectType: string, objectId: string, metadata: Record<string, unknown>) {
  await getDb().insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorId,
    actorType: "LEARNER",
    action,
    objectType,
    objectId,
    metadata: JSON.stringify(metadata),
  });
}

async function activeLab(code: string) {
  const db = getDb();
  const [item] = await db.select().from(contentLibraryItems).where(and(
    eq(contentLibraryItems.kind, "LAB"),
    eq(contentLibraryItems.code, code),
    eq(contentLibraryItems.status, "ACTIVE"),
  )).limit(1);
  if (!item) throw new Error("This Lab is not active.");
  const [activation] = await db.select().from(contentRuntimeActivations).where(and(
    eq(contentRuntimeActivations.itemId, item.id),
    eq(contentRuntimeActivations.status, "ACTIVE"),
  )).limit(1);
  if (!activation || activation.runtimeMode !== "DYNAMIC") throw new Error("This Lab uses a dedicated BIS runtime.");
  const [version] = await db.select().from(contentLibraryVersions).where(eq(contentLibraryVersions.id, activation.versionId)).limit(1);
  if (!version || version.runtimeStatus !== "LIVE") throw new Error("The active Lab version is unavailable.");
  const [artifact] = await db.select().from(contentRuntimeArtifacts).where(and(
    eq(contentRuntimeArtifacts.versionId, version.id),
    eq(contentRuntimeArtifacts.artifactKey, "lab:universal"),
  )).limit(1);
  if (!artifact) throw new Error("The compiled Lab package is missing.");
  const download = await requestSupabaseClient().storage.from(CONTENT_STUDIO_BUCKET).download(artifact.storagePath);
  if (download.error || !download.data) throw new Error("The Lab package could not be loaded.");
  const definition = sanitizeRuntimePackage(JSON.parse(await download.data.text())) as UniversalLabPackage;
  if (definition.kind !== "LAB" || definition.runtimeProfile !== "UNIVERSAL_V1" || definition.identity.code !== code) {
    throw new Error("The active Lab package does not match this route.");
  }
  return { item, version, activation, definition };
}

function promptRegistry(definition: UniversalLabPackage) {
  const registry = new Map<string, UniversalLabPrompt & { investigation: number }>();
  for (const investigation of definition.investigations) {
    for (const prompt of investigation.prompts) registry.set(prompt.id, { ...prompt, investigation: investigation.number });
  }
  return registry;
}

async function snapshot(userId: string, code: string) {
  const db = getDb();
  const runtime = await activeLab(code);
  const [profile] = await db.select().from(learners).where(eq(learners.userId, userId)).limit(1);
  if (!profile) throw new Error("Complete learner setup before opening this Lab.");

  const [enrolment] = await db.select().from(labEnrollments).where(and(
    eq(labEnrollments.userId, userId),
    eq(labEnrollments.labCode, code),
    eq(labEnrollments.labVersion, runtime.version.version),
  )).limit(1);

  const rows = await db.select().from(responses).where(and(
    eq(responses.userId, userId),
    eq(responses.labCode, code),
    eq(responses.labVersion, runtime.version.version),
  )).orderBy(desc(responses.recordedAt));

  const latest: Record<string, { value: unknown; status: string; recordedAt: string }> = {};
  for (const row of rows) {
    if (row.responseStatus === "SUPERSEDED" || latest[row.semanticFieldId]) continue;
    latest[row.semanticFieldId] = {
      value: decode(row.value),
      status: row.responseStatus,
      recordedAt: String(row.recordedAt ?? ""),
    };
  }

  return {
    definition: runtime.definition,
    version: runtime.version.version,
    identity: { id: userId, displayName: profile.displayName },
    enrolment: enrolment ? {
      id: enrolment.id,
      status: enrolment.status,
      currentInvestigation: enrolment.currentInvestigation,
      completedAt: enrolment.completedAt,
    } : null,
    responses: latest,
  };
}

async function getHandler(request: Request) {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const code = String(new URL(request.url).searchParams.get("lab") ?? "").toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(code)) return Response.json({ error: "Choose a valid Lab code." }, { status: 400 });
  try {
    return Response.json(await snapshot(identity.id, code), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The Lab could not be opened." }, { status: 400 });
  }
}

async function postHandler(request: Request) {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const code = String(body.labCode ?? "").toUpperCase();
    const action = String(body.action ?? "");
    const runtime = await activeLab(code);
    const db = getDb();
    const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
    if (!profile) throw new Error("Complete learner setup before opening this Lab.");

    const [consent] = await db.select().from(consentRecords).where(eq(consentRecords.userId, identity.id)).orderBy(desc(consentRecords.createdAt)).limit(1);
    if (consent?.status !== "GRANTED") throw new Error("This investigation is paused because product consent is not active.");

    if (action === "openLab") {
      if (body.consent !== true) throw new Error("Acknowledge the private evidence notice before opening the Lab.");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.insert(labEnrollments).values({
        id,
        userId: identity.id,
        labCode: code,
        labVersion: runtime.version.version,
        status: "IN_PROGRESS",
        currentInvestigation: 1,
        startedAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [labEnrollments.userId, labEnrollments.labCode, labEnrollments.labVersion],
        set: { status: "IN_PROGRESS", updatedAt: now },
      });
      await audit(identity.id, "UNIVERSAL_LAB_OPENED", "LAB_ENROLLMENT", id, { labCode: code, labVersion: runtime.version.version });
      return Response.json(await snapshot(identity.id, code));
    }

    const [enrolment] = await db.select().from(labEnrollments).where(and(
      eq(labEnrollments.userId, identity.id),
      eq(labEnrollments.labCode, code),
      eq(labEnrollments.labVersion, runtime.version.version),
    )).limit(1);
    if (!enrolment) throw new Error("Open the Lab before saving evidence.");

    if (action === "saveInvestigation") {
      const investigation = Number(body.investigation);
      if (!Number.isInteger(investigation) || investigation < 1 || investigation > 9) throw new Error("Choose a valid investigation.");
      if (investigation > enrolment.currentInvestigation) throw new Error("Complete the current investigation before moving ahead.");
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length || items.length > 60) throw new Error("Save between 1 and 60 responses.");
      const registry = promptRegistry(runtime.definition);
      const allowed = new Map([...registry].filter(([, prompt]) => prompt.investigation === investigation));
      const ids = new Set<string>();
      for (const raw of items) {
        const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const id = String(item.semanticFieldId ?? "");
        const prompt = allowed.get(id);
        if (!prompt || ids.has(id) || !validPromptResponse(prompt, item.value, String(item.responseStatus ?? "ANSWERED"))) throw new Error("Check the responses in this investigation before saving.");
        ids.add(id);
      }
      if ([...allowed.values()].some((prompt) => prompt.required !== false && !ids.has(prompt.id))) throw new Error("Answer or pass each required question before continuing.");
      const now = new Date().toISOString();

      for (const raw of items) {
        const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const semanticFieldId = String(item.semanticFieldId ?? "");
        const prompt = allowed.get(semanticFieldId);
        if (!prompt) throw new Error(`Unexpected field ${semanticFieldId || "missing"} in Investigation ${investigation}.`);
        const responseStatus = item.responseStatus === "PASS" ? "PASS" : "ANSWERED";
        const value = responseStatus === "PASS" ? "" : item.value;
        const encoded = JSON.stringify(value ?? "");
        if (encoded.length > 20_000) throw new Error(`${prompt.label}: response is too long.`);

        const existing = await db.select().from(responses).where(and(
          eq(responses.userId, identity.id),
          eq(responses.labCode, code),
          eq(responses.labVersion, runtime.version.version),
          eq(responses.semanticFieldId, semanticFieldId),
        )).orderBy(desc(responses.recordedAt));
        const previous = existing.find((row) => row.responseStatus !== "SUPERSEDED");
        if (previous && previous.value === encoded && previous.responseStatus === responseStatus) continue;

        const id = crypto.randomUUID();
        await db.insert(responses).values({
          id,
          userId: identity.id,
          promptId: `UNIVERSAL:${investigation}:${semanticFieldId}`,
          semanticFieldId,
          labCode: code,
          labVersion: runtime.version.version,
          contentReleaseId: null,
          deliveryEdition: profile.deliveryEdition,
          promptVersion: runtime.version.version,
          privacyClass: prompt.sensitivity ?? "P2",
          provenance: "SR",
          value: encoded,
          responseStatus,
          occurredAt: now,
          recordedAt: now,
          supersedesResponseId: previous?.id ?? null,
        });
        if (previous) await db.update(responses).set({ responseStatus: "SUPERSEDED" }).where(eq(responses.id, previous.id));
      }

      await db.update(labEnrollments).set({
        currentInvestigation: Math.max(enrolment.currentInvestigation, investigationUnlockedAfterSave(investigation)),
        updatedAt: now,
      }).where(eq(labEnrollments.id, enrolment.id));
      await audit(identity.id, "UNIVERSAL_LAB_INVESTIGATION_SAVED", "LAB_ENROLLMENT", enrolment.id, { labCode: code, investigation });
      return Response.json(await snapshot(identity.id, code));
    }

    if (action === "completeLab") {
      const current = await snapshot(identity.id, code);
      const required = runtime.definition.investigations.flatMap((investigation) =>
        investigation.prompts.filter((prompt) => prompt.required !== false).map((prompt) => prompt.id),
      );
      const registry = promptRegistry(runtime.definition);
      const missing = required.filter((id) => {
        const response = current.responses[id];
        return !response || !validPromptResponse(registry.get(id)!, response.value, response.status);
      });
      if (missing.length) throw new Error(`Complete the remaining required questions before finishing this Lab (${missing.length} remaining).`);
      const now = new Date().toISOString();
      await db.update(labEnrollments).set({
        status: "COMPLETED",
        currentInvestigation: 9,
        completedAt: now,
        updatedAt: now,
      }).where(eq(labEnrollments.id, enrolment.id));
      await audit(identity.id, "UNIVERSAL_LAB_COMPLETED", "LAB_ENROLLMENT", enrolment.id, { labCode: code, labVersion: runtime.version.version });
      return Response.json(await snapshot(identity.id, code));
    }

    throw new Error("That Lab action is not supported.");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The Lab action could not be completed." }, { status: 400 });
  }
}

export async function GET(request: Request) {
  return withSupabaseRequest(() => getHandler(request));
}

export async function POST(request: Request) {
  return withSupabaseRequest(() => postHandler(request));
}
