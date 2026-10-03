import { labCompletionRequirements, labSubmissionDefinition, labStageCompleted } from "../../../lib/lab-progress-compatibility.mjs";
import { requiredLabPromptIds, validateLabSubmission } from "../../../lib/lab-interaction-contract.mjs";
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
  evidenceRecords,
  labEnrollments,
  learners,
  measurementSources,
  measurementValues,
  responses,
} from "../../../db/schema";
import { identityFrom } from "../../../lib/bis-access";
import { requestSupabaseClient } from "../../../lib/supabase/server";
import { CONTENT_STUDIO_BUCKET } from "../../../lib/content-studio";
import type { UniversalLabPackage, UniversalLabPrompt } from "../../../lib/content-compiler";
import { investigationUnlockedAfterSave } from "../../../lib/lab-lifecycle-contract";
import { prepareUniversalLabPresentation } from "../../../lib/universal-lab-presentation.mjs";
import {
  evaluateUniversalComputed,
  experimentCalendarDay,
  universalComputedLeafInputs,
  universalExperimentEvidenceProgress,
} from "../../../lib/universal-lab-v2.mjs";

function decode(value: string | null) {
  if (value === null) return "";
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function todayInZone(timeZone = "Africa/Johannesburg") {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function responseValues(rows: Record<string, { value: unknown }>) {
  return Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, row.value]));
}

function baselinePrompts(definition: UniversalLabPackage) {
  return [
    ...(definition.presentationBaseline?.items ?? []),
    ...(definition.presentationBaseline?.metric ? [definition.presentationBaseline.metric] : []),
  ];
}

function requiredFor(
  definition: UniversalLabPackage,
  investigation: number,
  availableExperimentDay: number,
) {
  return requiredLabPromptIds(definition, investigation, availableExperimentDay);
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
  const definition = prepareUniversalLabPresentation(
    sanitizeRuntimePackage(JSON.parse(await download.data.text())) as UniversalLabPackage,
  ) as UniversalLabPackage;
  if (
    definition.kind !== "LAB"
    || !["UNIVERSAL_V1", "UNIVERSAL_V2"].includes(definition.runtimeProfile)
    || definition.identity.code !== code
  ) {
    throw new Error("The active Lab package does not match this route.");
  }
  return { item, version, activation, definition };
}

function promptRegistry(definition: UniversalLabPackage) {
  const registry = new Map<string, UniversalLabPrompt & { investigation: number }>();
  for (const prompt of baselinePrompts(definition)) {
    registry.set(prompt.id, { ...prompt, investigation: 0 });
  }
  for (const investigation of definition.investigations) {
    for (const prompt of investigation.prompts) registry.set(prompt.id, { ...prompt, investigation: investigation.number });
  }
  return registry;
}

async function syncUniversalComputedMeasurements(
  userId: string,
  enrolment: { id: string },
  definition: UniversalLabPackage,
  labVersion: string,
  responseSnapshot: Record<string, { value: unknown; responseId?: string }>,
) {
  if (definition.runtimeProfile !== "UNIVERSAL_V2") return;
  const db = getDb();
  const computed = evaluateUniversalComputed(definition, responseValues(responseSnapshot));
  const now = new Date().toISOString();
  const computedIds = new Set((definition.computedFields ?? []).map((field) => field.id));

  const leafInputsFor = (semanticFieldId: string) =>
    computedIds.has(semanticFieldId)
      ? universalComputedLeafInputs(definition, semanticFieldId)
      : [semanticFieldId];

  const persistMeasurement = async (
    code: string,
    value: unknown,
    formulaVersion: string,
    semanticInputs: string[],
  ) => {
    const leafInputs = [...new Set(semanticInputs.flatMap(leafInputsFor))];
    const sourceRows = leafInputs.flatMap((semanticFieldId) => {
      const response = responseSnapshot[semanticFieldId];
      if (!response?.responseId) return [];
      return [{
        semanticFieldId,
        responseId: response.responseId,
        value: response.value,
      }];
    });
    const status = value === null || value === undefined ? "NA" : "VALUE";
    const evidenceStrength = status === "NA"
      ? "NONE"
      : sourceRows.length >= 2
        ? "SUFFICIENT_FOR_LAB"
        : "LIMITED";

    const [existing] = await db.select({ id: measurementValues.id }).from(measurementValues).where(and(
      eq(measurementValues.userId, userId),
      eq(measurementValues.enrolmentId, enrolment.id),
      eq(measurementValues.code, code),
    )).limit(1);
    const measurementId = existing?.id ?? crypto.randomUUID();

    await db.insert(measurementValues).values({
      id: measurementId,
      userId,
      experimentId: null,
      enrolmentId: enrolment.id,
      labCode: definition.identity.code,
      labVersion,
      code,
      value: JSON.stringify(value ?? null),
      status,
      evidenceStrength,
      formulaVersion,
      calculatedAt: now,
    }).onConflictDoUpdate({
      target: [measurementValues.userId, measurementValues.enrolmentId, measurementValues.code],
      set: {
        value: JSON.stringify(value ?? null),
        status,
        evidenceStrength,
        labCode: definition.identity.code,
        labVersion,
        formulaVersion,
        calculatedAt: now,
      },
    });

    await db.delete(measurementSources).where(eq(measurementSources.measurementId, measurementId));
    if (sourceRows.length) {
      await db.insert(measurementSources).values(sourceRows.map((source) => ({
        id: crypto.randomUUID(),
        measurementId,
        userId,
        sourceObjectType: "RESPONSE",
        sourceObjectId: source.responseId,
        inputRole: source.semanticFieldId,
        inputValue: JSON.stringify(source.value ?? null),
        createdAt: now,
      })));
    }
  };

  for (const field of definition.computedFields ?? []) {
    await persistMeasurement(
      field.id,
      computed[field.id],
      "universal-lab-v2:computed",
      field.inputs,
    );
  }

  const resolvedValue = (semanticFieldId: string) =>
    Object.prototype.hasOwnProperty.call(computed, semanticFieldId)
      ? computed[semanticFieldId]
      : responseSnapshot[semanticFieldId]?.value;

  for (const indicator of definition.indicatorRegistry ?? []) {
    if (indicator.status === "NOT_COLLECTED") continue;
    const value = indicator.primaryPromptId
      ? resolvedValue(indicator.primaryPromptId)
      : (() => {
          const entries = indicator.promptIds
            .map((promptId) => [promptId, resolvedValue(promptId)] as const)
            .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== "");
          return entries.length ? Object.fromEntries(entries) : null;
        })();
    await persistMeasurement(
      `${definition.identity.code}.${indicator.code.replace("-", "")}`,
      value,
      "universal-lab-v2:bei",
      indicator.promptIds,
    );
  }
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

  const baselineSaves = enrolment && enrolment.currentInvestigation <= 1
    ? await db.select().from(auditEvents).where(and(
        eq(auditEvents.actorId, userId), eq(auditEvents.objectId, enrolment.id),
        eq(auditEvents.action, "UNIVERSAL_LAB_BASELINE_SAVED"),
      )).limit(1) : [];
  const baselineAccepted = Boolean(enrolment && (enrolment.currentInvestigation > 1 || enrolment.status === "COMPLETED" || baselineSaves.length));

  const rows = await db.select().from(responses).where(and(
    eq(responses.userId, userId),
    eq(responses.labCode, code),
    eq(responses.labVersion, runtime.version.version),
  )).orderBy(desc(responses.recordedAt));

  const latest: Record<string, { value: unknown; status: string; recordedAt: string; responseId: string }> = {};
  for (const row of rows) {
    if (row.responseStatus === "SUPERSEDED" || latest[row.semanticFieldId]) continue;
    latest[row.semanticFieldId] = {
      value: decode(row.value),
      status: row.responseStatus,
      recordedAt: String(row.recordedAt ?? ""),
      responseId: row.id,
    };
  }

  const timeZone = profile.timezone || "Africa/Johannesburg";
  const today = todayInZone(timeZone);
  const experimentDays = runtime.definition.runtimeProfile === "UNIVERSAL_V2"
    ? Number(runtime.definition.experiment?.days ?? 0)
    : 0;
  const availableDay = experimentDays
    ? experimentCalendarDay(enrolment?.experimentStartedAt, today, experimentDays, timeZone)
    : 0;
  const computed = runtime.definition.runtimeProfile === "UNIVERSAL_V2"
    ? evaluateUniversalComputed(runtime.definition, responseValues(latest))
    : {};
  const measurementRows = enrolment
    ? await db.select().from(measurementValues).where(and(
        eq(measurementValues.userId, userId),
        eq(measurementValues.enrolmentId, enrolment.id),
      ))
    : [];
  const measurements = Object.fromEntries(measurementRows.map((row) => [
    row.code,
    { ...row, value: decode(row.value) },
  ]));
  const evidenceProgress = experimentDays
    ? universalExperimentEvidenceProgress(runtime.definition, latest, availableDay)
    : {
        experimentStarted: false,
        currentDay: 0,
        totalDays: 0,
        evidenceDaysRecorded: 0,
        todayEvidenceRecorded: false,
      };
  const reviewInvestigation = runtime.definition.runtimeProfile === "UNIVERSAL_V2"
    ? runtime.definition.experiment?.reviewInvestigation ?? 8
    : 8;
  const reviewReady = Boolean(experimentDays && availableDay >= experimentDays);
  const labCompleted = enrolment?.status === "COMPLETED";
  const programmeHandoff = {
    ...evidenceProgress,
    reviewReady,
    reviewInvestigation,
    labCompleted,
    portfolioReady: labCompleted,
    nextAction: labCompleted
      ? "PORTFOLIO"
      : reviewReady
        ? "REVIEW"
        : evidenceProgress.todayEvidenceRecorded
          ? "LEARNING"
          : evidenceProgress.currentDay > 0
            ? "EVIDENCE"
            : "LAB",
  };

  return {
    definition: runtime.definition,
    version: runtime.version.version,
    identity: { id: userId, displayName: profile.displayName },
    deliveryEdition: profile.deliveryEdition,
    enrolment: enrolment ? {
      id: enrolment.id,
      status: enrolment.status,
      currentInvestigation: experimentDays && availableDay > experimentDays
        ? Math.max(enrolment.currentInvestigation, runtime.definition.experiment?.reviewInvestigation ?? 8)
        : enrolment.currentInvestigation,
      phaseACompletedAt: enrolment.phaseACompletedAt,
      experimentStartedAt: enrolment.experimentStartedAt,
      completedAt: enrolment.completedAt,
    } : null,
    progressCompatibility: { baselineAccepted, completedInvestigations: enrolment ? runtime.definition.investigations.filter((stage) => stage.number < enrolment.currentInvestigation).map((stage) => stage.number) : [] },
    responses: latest,
    computed,
    measurements,
    programmeHandoff,
    experimentTiming: experimentDays ? {
      startedAt: enrolment?.experimentStartedAt ?? null,
      availableDay,
      totalDays: experimentDays,
      today,
      reviewReady: availableDay >= experimentDays,
    } : null,
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
        set: { updatedAt: now },
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
      const baselineSave = investigation === 0 && Boolean(runtime.definition.presentationBaseline);
      if (!Number.isInteger(investigation) || investigation < 0 || investigation > 9 || (investigation === 0 && !baselineSave)) {
        throw new Error("Choose a valid investigation.");
      }
      const progress = await snapshot(identity.id, code);
      if (investigation > (progress.enrolment?.currentInvestigation ?? enrolment.currentInvestigation)) throw new Error("Complete the current investigation before moving ahead.");
      if (investigation > 0 && runtime.definition.presentationBaseline && !progress.progressCompatibility.baselineAccepted) {
        validateLabSubmission(runtime.definition, 0, 0, [], progress.responses);
      }
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length > 60 || (!items.length && !labStageCompleted(enrolment, investigation, progress.progressCompatibility.baselineAccepted))) throw new Error("Save between 1 and 60 responses.");
      const availableExperimentDay = runtime.definition.runtimeProfile === "UNIVERSAL_V2" && runtime.definition.experiment
        ? experimentCalendarDay(
            enrolment.experimentStartedAt,
            todayInZone(profile.timezone || "Africa/Johannesburg"),
            runtime.definition.experiment.days,
            profile.timezone || "Africa/Johannesburg",
          )
        : 0;
      if (
        runtime.definition.runtimeProfile === "UNIVERSAL_V2"
        && investigation === runtime.definition.experiment?.investigation
        && availableExperimentDay < 1
      ) {
        throw new Error("The real-world experiment begins after Phase A is complete.");
      }

      if (investigation === runtime.definition.experiment?.investigation
        && availableExperimentDay > runtime.definition.experiment.days) {
        throw new Error("The evidence window has ended. Continue to the evidence review; missed days remain missing.");
      }
      const existing = progress;
      const validatedItems = validateLabSubmission(
        labSubmissionDefinition(runtime.definition, enrolment, investigation, progress.progressCompatibility.baselineAccepted), investigation, availableExperimentDay, items, existing.responses,
      );
      const now = new Date().toISOString();

      for (const item of validatedItems) {
        const { semanticFieldId, prompt, responseStatus, value } = item;
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
        if (previous) {
          await db.update(evidenceRecords)
            .set({ status: "SUPERSEDED" })
            .where(eq(evidenceRecords.sourceObjectId, previous.id));
        }
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
        await db.insert(evidenceRecords).values({
          id: crypto.randomUUID(),
          userId: identity.id,
          labCode: code,
          labVersion: runtime.version.version,
          contentReleaseId: null,
          investigationId: investigation === 0 ? `${code}.BASELINE` : `${code}.I${investigation}`,
          semanticFieldId,
          sourceObjectType: "RESPONSE",
          sourceObjectId: id,
          provenance: "SR",
          valueType: prompt.type ?? "TEXT",
          value: responseStatus === "PASS" ? null : encoded,
          status: responseStatus === "PASS" ? "WITHDRAWN" : "ACTIVE",
          sensitivity: prompt.sensitivity ?? "P2",
          occurredAt: now,
          recordedAt: now,
        });
      }

      const afterResponses = await snapshot(identity.id, code);
      await syncUniversalComputedMeasurements(
        identity.id,
        enrolment,
        runtime.definition,
        runtime.version.version,
        afterResponses.responses,
      );

      let nextInvestigation = investigation === 0 ? 1 : investigationUnlockedAfterSave(investigation);
      const enrolmentUpdate: {
        updatedAt: string;
        currentInvestigation?: number;
        phaseACompletedAt?: string;
        experimentStartedAt?: string;
      } = { updatedAt: now };

      if (
        runtime.definition.runtimeProfile === "UNIVERSAL_V2"
        && runtime.definition.experiment
        && investigation === runtime.definition.experiment.startAfterInvestigation
      ) {
        enrolmentUpdate.phaseACompletedAt = enrolment.phaseACompletedAt ?? now;
        enrolmentUpdate.experimentStartedAt = enrolment.experimentStartedAt ?? now;
        nextInvestigation = runtime.definition.experiment.investigation;
      } else if (
        runtime.definition.runtimeProfile === "UNIVERSAL_V2"
        && runtime.definition.experiment
        && investigation === runtime.definition.experiment.investigation
      ) {
        const afterSave = await snapshot(identity.id, code);
        const timing = afterSave.experimentTiming;
        const todayIds = requiredFor(
          runtime.definition,
          investigation,
          availableExperimentDay,
        );
        const todayRecorded = todayIds.every((id) => Boolean(afterSave.responses[id]));
        nextInvestigation = timing?.reviewReady && todayRecorded
          ? runtime.definition.experiment.reviewInvestigation
          : runtime.definition.experiment.investigation;
      }

      enrolmentUpdate.currentInvestigation = Math.max(enrolment.currentInvestigation, nextInvestigation);
      await db.update(labEnrollments).set(enrolmentUpdate).where(eq(labEnrollments.id, enrolment.id));
      await audit(
        identity.id,
        investigation === 0 ? "UNIVERSAL_LAB_BASELINE_SAVED" : "UNIVERSAL_LAB_INVESTIGATION_SAVED",
        "LAB_ENROLLMENT",
        enrolment.id,
        {
          labCode: code,
          investigation,
          runtimeProfile: runtime.definition.runtimeProfile,
          nextInvestigation,
          presentationVersion: runtime.definition.presentationVersion,
          requiredPromptIds: requiredFor(runtime.definition, investigation, availableExperimentDay),
        },
      );
      return Response.json(await snapshot(identity.id, code));
    }

    if (action === "completeLab") {
      const current = await snapshot(identity.id, code);
      if (
        runtime.definition.runtimeProfile === "UNIVERSAL_V2"
        && runtime.definition.experiment
        && !current.experimentTiming?.reviewReady
      ) {
        throw new Error("Complete the real-world experiment before finishing this Lab.");
      }
      if (enrolment.currentInvestigation < 9) throw new Error("Complete the current investigation before finishing this Lab.");
      const required = labCompletionRequirements(runtime.definition, enrolment, current.progressCompatibility.baselineAccepted);
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
