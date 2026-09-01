import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  auditEvents,
  companionTurns,
  consentRecords,
  evidenceRecords,
  experimentCheckpoints,
  experimentEvents,
  experimentParameterVersions,
  experiments,
  hypotheses,
  labEnrollments,
  learners,
  measurementSources,
  measurementValues,
  memoryItems,
  notificationPreferences,
  pilotEvents,
  responses,
} from "../../../db/schema";
import {
  baselineItems,
  fieldRegistry,
  LAB_VERSION,
  POLICY_VERSION,
} from "../../../lib/habit-lab";
import { computeHabitMetrics } from "../../../lib/bis-metrics.mjs";

type Identity = { id: string; email: string; displayName: string };

function identityFrom(request: Request): Identity | null {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;

  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  let displayName = email.split("@")[0];
  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      displayName = decodeURIComponent(encodedName);
    } catch {
      // Fall back to the local part of the verified email.
    }
  }
  return { id, email, displayName };
}

function jsonValue(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseValue(value: string | null) {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Your investigation store is being prepared. Please try again shortly.";
  }
  return message;
}

async function audit(
  userId: string,
  action: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, unknown> = {},
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

async function pilotEvent(
  userId: string,
  name: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, unknown> = {},
) {
  await getDb().insert(pilotEvents).values({
    id: crypto.randomUUID(),
    userId,
    name,
    objectType,
    objectId,
    metadata: JSON.stringify(metadata),
  });
}

async function ensureInitialParameterVersion(experiment: typeof experiments.$inferSelect) {
  const db = getDb();
  const [existing] = await db
    .select({ id: experimentParameterVersions.id })
    .from(experimentParameterVersions)
    .where(and(eq(experimentParameterVersions.experimentId, experiment.id), eq(experimentParameterVersions.version, 1)))
    .limit(1);
  if (existing) return;
  await db.insert(experimentParameterVersions).values({
    id: crypto.randomUUID(),
    experimentId: experiment.id,
    userId: experiment.userId,
    version: 1,
    effectiveFrom: `${experiment.startDate}T00:00:00.000Z`,
    targetCondition: experiment.targetCondition,
    alternativeBehaviour: experiment.alternativeBehaviour,
    expectedReward: experiment.expectedReward,
    restartPlan: experiment.restartPlan,
    minimumVersion: experiment.minimumVersion,
    failureSignal: experiment.failureSignal,
    changeReason: "INITIAL_PARAMETERS",
  });
}

const defaultNotificationPreference = {
  enabled: true,
  experimentStarted: true,
  dailyObservation: true,
  dayThreeCheckpoint: true,
  experimentEnding: true,
  reviewReady: true,
  reminderTime: "18:00",
  timezone: "Africa/Johannesburg",
};

function buildReminders(
  experiment: typeof experiments.$inferSelect | undefined,
  events: Array<typeof experimentEvents.$inferSelect>,
  checkpoints: Array<typeof experimentCheckpoints.$inferSelect>,
  preference: typeof defaultNotificationPreference,
) {
  if (!experiment || !preference.enabled) return [];
  const reminders: Array<{ id: string; title: string; detail: string; priority: string }> = [];
  const today = new Date();
  const start = new Date(`${experiment.startDate}T00:00:00.000Z`);
  const end = new Date(`${experiment.plannedEndDate}T00:00:00.000Z`);
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const elapsed = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  const todayNumber = Math.min(totalDays, elapsed);
  const todayRecorded = events.some((event) => event.dayNumber === todayNumber);

  if (experiment.status === "ACTIVE" && events.length === 0 && preference.experimentStarted) {
    reminders.push({ id: "experiment-started", title: "Your experiment is active", detail: "Record what happens when the target condition appears. No opportunity is valid evidence.", priority: "INFO" });
  }
  if (experiment.status === "ACTIVE" && elapsed >= 1 && elapsed <= totalDays && !todayRecorded && preference.dailyObservation) {
    reminders.push({ id: `daily-${todayNumber}`, title: `Day ${todayNumber} observation is ready`, detail: `Your in-app reminder time is ${preference.reminderTime}. Backfill is available if you are recording later.`, priority: "ACTION" });
  }
  if (experiment.status === "ACTIVE" && events.length >= 3 && checkpoints.length === 0 && preference.dayThreeCheckpoint) {
    reminders.push({ id: "day-three", title: "Day 3 checkpoint is ready", detail: "Review what surprised you and keep or adjust the experiment without overwriting version 1.", priority: "ACTION" });
  }
  if (experiment.status === "ACTIVE" && elapsed >= totalDays - 1 && preference.experimentEnding) {
    reminders.push({ id: "ending", title: "Your planned experiment is ending", detail: "Review the evidence, extend the window, or finish with insufficient evidence where appropriate.", priority: "ACTION" });
  }
  if (experiment.status !== "ACTIVE" && preference.reviewReady) {
    reminders.push({ id: "review-ready", title: "Your evidence review is ready", detail: "Continue to Investigation 8 to compare your prediction with what happened.", priority: "INFO" });
  }
  return reminders;
}

async function snapshot(identity: Identity) {
  const db = getDb();
  const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
  const [consent] = await db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, identity.id))
    .orderBy(desc(consentRecords.createdAt))
    .limit(1);
  const [enrolment] = await db
    .select()
    .from(labEnrollments)
    .where(and(eq(labEnrollments.userId, identity.id), eq(labEnrollments.labVersion, LAB_VERSION)))
    .limit(1);
  const responseRows = await db
    .select()
    .from(responses)
    .where(eq(responses.userId, identity.id))
    .orderBy(desc(responses.recordedAt));
  const responseMap: Record<string, { value: unknown; status: string; responseId: string; recordedAt: string }> = {};
  for (const row of responseRows) {
    if (!responseMap[row.semanticFieldId] && row.responseStatus !== "SUPERSEDED") {
      responseMap[row.semanticFieldId] = {
        value: parseValue(row.value),
        status: row.responseStatus,
        responseId: row.id,
        recordedAt: row.recordedAt,
      };
    }
  }
  const [hypothesis] = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.userId, identity.id))
    .orderBy(desc(hypotheses.createdAt))
    .limit(1);
  const [experiment] = await db
    .select()
    .from(experiments)
    .where(eq(experiments.userId, identity.id))
    .orderBy(desc(experiments.createdAt))
    .limit(1);
  const events = experiment
    ? await db
        .select()
        .from(experimentEvents)
        .where(and(eq(experimentEvents.userId, identity.id), eq(experimentEvents.experimentId, experiment.id)))
        .orderBy(experimentEvents.dayNumber)
    : [];
  const checkpoints = experiment
    ? await db
        .select()
        .from(experimentCheckpoints)
        .where(and(eq(experimentCheckpoints.userId, identity.id), eq(experimentCheckpoints.experimentId, experiment.id)))
        .orderBy(experimentCheckpoints.dayNumber)
    : [];
  const parameterVersions = experiment
    ? await db
        .select()
        .from(experimentParameterVersions)
        .where(and(eq(experimentParameterVersions.userId, identity.id), eq(experimentParameterVersions.experimentId, experiment.id)))
        .orderBy(experimentParameterVersions.version)
    : [];
  const measurements = await db
    .select()
    .from(measurementValues)
    .where(eq(measurementValues.userId, identity.id));
  const sourceRows = await db
    .select()
    .from(measurementSources)
    .where(eq(measurementSources.userId, identity.id));
  const [storedNotificationPreference] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, identity.id))
    .limit(1);
  const notificationPreference = storedNotificationPreference ?? {
    userId: identity.id,
    ...defaultNotificationPreference,
    updatedAt: "",
  };
  const memories = await db
    .select()
    .from(memoryItems)
    .where(eq(memoryItems.userId, identity.id))
    .orderBy(desc(memoryItems.createdAt));
  const turns = await db
    .select()
    .from(companionTurns)
    .where(eq(companionTurns.userId, identity.id))
    .orderBy(desc(companionTurns.generatedAt))
    .limit(12);

  return {
    identity,
    profile: profile ?? null,
    consent: consent ?? null,
    enrolment: enrolment ?? null,
    responses: responseMap,
    hypothesis: hypothesis ?? null,
    experiment: experiment
      ? { ...experiment, impactDomains: parseValue(experiment.impactDomains) }
      : null,
    events,
    checkpoints,
    parameterVersions,
    measurements: Object.fromEntries(
      measurements.map((item) => [
        item.code,
        {
          value: parseValue(item.value),
          status: item.status,
          evidenceStrength: item.evidenceStrength,
          formulaVersion: item.formulaVersion,
          calculatedAt: item.calculatedAt,
          sources: sourceRows
            .filter((source) => source.measurementId === item.id)
            .map((source) => ({
              sourceObjectType: source.sourceObjectType,
              sourceObjectId: source.sourceObjectId,
              inputRole: source.inputRole,
              inputValue: parseValue(source.inputValue),
            })),
        },
      ]),
    ),
    notificationPreference,
    reminders: buildReminders(experiment, events, checkpoints, notificationPreference),
    memories,
    companionTurns: turns.reverse(),
  };
}

async function saveResponse(
  identity: Identity,
  payload: {
    semanticFieldId: string;
    value?: unknown;
    responseStatus?: string;
    investigation?: number;
    occurredAt?: string;
  },
) {
  const baselineField = baselineItems.some(([id]) => id === payload.semanticFieldId);
  const definition = fieldRegistry[payload.semanticFieldId as keyof typeof fieldRegistry];
  if (!definition && !baselineField) throw new Error("That evidence field is not registered for Habit Lab 4.5.1.");

  const db = getDb();
  const now = new Date().toISOString();
  const investigation = payload.investigation ?? (definition ? definition.investigation : 0);
  const promptId = definition ? definition.promptId : `HAB.BASE.${payload.semanticFieldId.split(".").at(-1)}`;
  const sensitivity = definition ? definition.sensitivity : "P2";
  const valueType = definition ? definition.type : "CATEGORICAL";
  const responseStatus = payload.responseStatus === "PASS" ? "PASS" : "ANSWERED";

  const [previous] = await db
    .select()
    .from(responses)
    .where(and(eq(responses.userId, identity.id), eq(responses.semanticFieldId, payload.semanticFieldId)))
    .orderBy(desc(responses.recordedAt))
    .limit(1);

  const responseId = crypto.randomUUID();
  if (previous && previous.responseStatus !== "SUPERSEDED") {
    await db.update(responses).set({ responseStatus: "SUPERSEDED" }).where(eq(responses.id, previous.id));
    await db
      .update(evidenceRecords)
      .set({ status: "SUPERSEDED" })
      .where(eq(evidenceRecords.sourceObjectId, previous.id));
  }

  await db.insert(responses).values({
    id: responseId,
    userId: identity.id,
    promptId,
    semanticFieldId: payload.semanticFieldId,
    value: responseStatus === "PASS" ? null : jsonValue(payload.value),
    responseStatus,
    occurredAt: payload.occurredAt ?? now,
    supersedesResponseId: previous?.id ?? null,
  });
  await db.insert(evidenceRecords).values({
    id: crypto.randomUUID(),
    userId: identity.id,
    investigationId: `HAB.I${investigation}`,
    semanticFieldId: payload.semanticFieldId,
    sourceObjectType: "RESPONSE",
    sourceObjectId: responseId,
    provenance: "SR",
    valueType,
    value: responseStatus === "PASS" ? null : jsonValue(payload.value),
    status: responseStatus === "PASS" ? "WITHDRAWN" : "ACTIVE",
    sensitivity,
    occurredAt: payload.occurredAt ?? now,
  });
  await db
    .update(labEnrollments)
    .set({
      currentInvestigation: sql`MAX(${labEnrollments.currentInvestigation}, ${investigation})`,
      updatedAt: now,
    })
    .where(and(eq(labEnrollments.userId, identity.id), eq(labEnrollments.labVersion, LAB_VERSION)));
  await audit(identity.id, previous ? "RESPONSE_CORRECTED" : "RESPONSE_CREATED", "RESPONSE", responseId, {
    semanticFieldId: payload.semanticFieldId,
    responseStatus,
  });
}

async function calculateExperiment(identity: Identity, experimentId: string, predicted: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(experimentEvents)
    .where(and(eq(experimentEvents.userId, identity.id), eq(experimentEvents.experimentId, experimentId)));
  const {
    opportunityCount,
    replacementCount,
    adherence,
    predictionAccuracy,
    evidenceStrength,
  } = computeHabitMetrics(rows, predicted);
  const values = [
    ["HAB.EXPERIMENT.OPPORTUNITY_COUNT", opportunityCount, "VALUE"],
    ["HAB.EXPERIMENT.REPLACEMENT_COUNT", replacementCount, "VALUE"],
    ["HAB.BEI06", adherence, adherence === null ? "NA" : "VALUE"],
    ["HAB.BEI03", predictionAccuracy, predictionAccuracy === null ? "NA" : "VALUE"],
  ] as const;
  for (const [code, value, status] of values) {
    const [existing] = await db
      .select({ id: measurementValues.id })
      .from(measurementValues)
      .where(and(
        eq(measurementValues.userId, identity.id),
        eq(measurementValues.experimentId, experimentId),
        eq(measurementValues.code, code),
      ))
      .limit(1);
    const measurementId = existing?.id ?? crypto.randomUUID();
    await db
      .insert(measurementValues)
      .values({
        id: measurementId,
        userId: identity.id,
        experimentId,
        code,
        value: jsonValue(value),
        status,
        evidenceStrength,
      })
      .onConflictDoUpdate({
        target: [measurementValues.userId, measurementValues.experimentId, measurementValues.code],
        set: { value: jsonValue(value), status, evidenceStrength, calculatedAt: new Date().toISOString() },
      });
    await db.delete(measurementSources).where(eq(measurementSources.measurementId, measurementId));
    const sourceValues = rows.flatMap((row) => {
      const base = {
        measurementId,
        userId: identity.id,
        sourceObjectType: "EXPERIMENT_EVENT",
        sourceObjectId: row.id,
      };
      if (code === "HAB.EXPERIMENT.OPPORTUNITY_COUNT") {
        return [{ ...base, id: crypto.randomUUID(), inputRole: "ELIGIBLE_OPPORTUNITY", inputValue: jsonValue(row.eligibleOpportunity) }];
      }
      if (code === "HAB.EXPERIMENT.REPLACEMENT_COUNT") {
        return [{ ...base, id: crypto.randomUUID(), inputRole: "ALTERNATIVE_USED", inputValue: jsonValue(row.alternativeUsed) }];
      }
      return [
        { ...base, id: crypto.randomUUID(), inputRole: "ELIGIBLE_OPPORTUNITY", inputValue: jsonValue(row.eligibleOpportunity) },
        { ...base, id: crypto.randomUUID(), inputRole: "ALTERNATIVE_USED", inputValue: jsonValue(row.alternativeUsed) },
      ];
    });
    if (code === "HAB.BEI03") {
      sourceValues.push({
        id: crypto.randomUUID(),
        measurementId,
        userId: identity.id,
        sourceObjectType: "EXPERIMENT",
        sourceObjectId: experimentId,
        inputRole: "PREDICTED_ADHERENCE",
        inputValue: jsonValue(predicted),
      });
    }
    if (sourceValues.length > 0) await db.insert(measurementSources).values(sourceValues);
  }
}

export async function GET(request: Request) {
  const identity = identityFrom(request);
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    return Response.json(await snapshot(identity));
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const identity = identityFrom(request);
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const db = getDb();

    if (action === "setup") {
      const ageBand = String(body.ageBand ?? "");
      const mode = body.mode === "FACILITATED" ? "FACILITATED" : "INDEPENDENT";
      if (!ageBand) throw new Error("Choose an age band to continue.");
      if (body.consent !== true) throw new Error("Consent is required to begin this private investigation.");
      const now = new Date().toISOString();
      await db
        .insert(learners)
        .values({
          userId: identity.id,
          email: identity.email,
          displayName: identity.displayName,
          ageBand,
          mode,
        })
        .onConflictDoUpdate({
          target: learners.userId,
          set: { email: identity.email, displayName: identity.displayName, ageBand, mode, updatedAt: now },
        });
      const consentId = crypto.randomUUID();
      await db.insert(consentRecords).values({
        id: consentId,
        userId: identity.id,
        policyVersion: POLICY_VERSION,
        scope: "HABIT_LAB_PRODUCT_AND_LEARNER_REPORT",
        status: "GRANTED",
        grantedAt: now,
      });
      await db
        .insert(labEnrollments)
        .values({ id: crypto.randomUUID(), userId: identity.id })
        .onConflictDoUpdate({
          target: [labEnrollments.userId, labEnrollments.labCode, labEnrollments.labVersion],
          set: { status: "IN_PROGRESS", updatedAt: now },
        });
      await audit(identity.id, "CONSENT_CHANGED", "CONSENT_RECORD", consentId, { status: "GRANTED" });
      await pilotEvent(identity.id, "ONBOARDING_COMPLETED", "CONSENT_RECORD", consentId, { mode, ageBand });
      return Response.json(await snapshot(identity), { status: 201 });
    }

    if (action === "restoreConsent") {
      const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
      if (!profile) throw new Error("Complete setup before restoring the investigation.");
      const now = new Date().toISOString();
      const consentId = crypto.randomUUID();
      await db.insert(consentRecords).values({
        id: consentId,
        userId: identity.id,
        policyVersion: POLICY_VERSION,
        scope: "HABIT_LAB_PRODUCT_AND_LEARNER_REPORT",
        status: "GRANTED",
        grantedAt: now,
        createdAt: now,
      });
      await db.update(learners).set({ status: "ACTIVE", updatedAt: now }).where(eq(learners.userId, identity.id));
      await audit(identity.id, "CONSENT_CHANGED", "CONSENT_RECORD", consentId, { status: "GRANTED", restored: true });
      await pilotEvent(identity.id, "CONSENT_RESTORED", "CONSENT_RECORD", consentId);
      return Response.json(await snapshot(identity));
    }

    const [currentConsent] = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.userId, identity.id))
      .orderBy(desc(consentRecords.createdAt))
      .limit(1);
    if (currentConsent?.status !== "GRANTED") {
      throw new Error("This investigation is paused because product consent is not active.");
    }

    if (action === "saveResponse") {
      await saveResponse(identity, {
        semanticFieldId: String(body.semanticFieldId ?? ""),
        value: body.value,
        responseStatus: String(body.responseStatus ?? "ANSWERED"),
        investigation: Number(body.investigation ?? 0),
        occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : undefined,
      });
      return Response.json(await snapshot(identity));
    }

    if (action === "saveResponses") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0 || items.length > 30) throw new Error("Provide between 1 and 30 evidence responses.");
      for (const item of items) {
        if (!item || typeof item !== "object") throw new Error("One of the evidence responses is invalid.");
        const value = item as Record<string, unknown>;
        await saveResponse(identity, {
          semanticFieldId: String(value.semanticFieldId ?? ""),
          value: value.value,
          responseStatus: String(value.responseStatus ?? "ANSWERED"),
          investigation: Number(value.investigation ?? 0),
          occurredAt: typeof value.occurredAt === "string" ? value.occurredAt : undefined,
        });
      }
      if (items.some((item) => item && typeof item === "object" && Number((item as Record<string, unknown>).investigation ?? 0) === 9)) {
        const [enrolment] = await db
          .select()
          .from(labEnrollments)
          .where(and(eq(labEnrollments.userId, identity.id), eq(labEnrollments.labVersion, LAB_VERSION)))
          .limit(1);
        if (enrolment && enrolment.status !== "COMPLETED") {
          const now = new Date().toISOString();
          await db.update(labEnrollments).set({ status: "COMPLETED", currentInvestigation: 9, completedAt: now, updatedAt: now }).where(eq(labEnrollments.id, enrolment.id));
          await audit(identity.id, "LAB_COMPLETED", "LAB_ENROLLMENT", enrolment.id, { labVersion: LAB_VERSION });
          await pilotEvent(identity.id, "HABIT_LAB_COMPLETED", "LAB_ENROLLMENT", enrolment.id, { labVersion: LAB_VERSION });
        }
      }
      return Response.json(await snapshot(identity));
    }

    if (action === "saveHypothesis") {
      const statement = String(body.statement ?? "").trim();
      const falsification = String(body.falsificationStatement ?? "").trim();
      const confidence = Number(body.learnerConfidence ?? 0);
      if (!statement || !falsification || confidence < 1 || confidence > 10) {
        throw new Error("Your working equation, challenge test and confidence rating are all needed.");
      }
      const [previous] = await db
        .select()
        .from(hypotheses)
        .where(eq(hypotheses.userId, identity.id))
        .orderBy(desc(hypotheses.createdAt))
        .limit(1);
      const id = crypto.randomUUID();
      if (previous) {
        await db.update(hypotheses).set({ status: "SUPERSEDED", supersededBy: id }).where(eq(hypotheses.id, previous.id));
      }
      await db.insert(hypotheses).values({
        id,
        userId: identity.id,
        statement,
        falsificationStatement: falsification,
        learnerConfidence: confidence,
      });
      await saveResponse(identity, { semanticFieldId: "HAB.EQUATION.TEXT", value: statement, investigation: 5 });
      await saveResponse(identity, { semanticFieldId: "HAB.FALSIFICATION.TEXT", value: falsification, investigation: 5 });
      await saveResponse(identity, { semanticFieldId: "HAB.EQUATION.CONFIDENCE_PRE", value: confidence, investigation: 5 });
      await audit(identity.id, previous ? "HYPOTHESIS_REVISED" : "HYPOTHESIS_CREATED", "HYPOTHESIS", id);
      return Response.json(await snapshot(identity), { status: 201 });
    }

    if (action === "startExperiment") {
      const prediction = Number(body.predictedValue ?? -1);
      const required = ["targetPattern", "targetCondition", "alternativeBehaviour", "expectedReward", "restartPlan", "minimumVersion", "failureSignal"];
      for (const key of required) if (!String(body[key] ?? "").trim()) throw new Error("Complete every experiment field before starting.");
      if (prediction < 0 || prediction > 100) throw new Error("Prediction must be between 0% and 100%.");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const startDate = String(body.startDate ?? now.slice(0, 10));
      const plannedEndDate = String(body.plannedEndDate ?? startDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(plannedEndDate)) {
        throw new Error("Choose valid start and end dates.");
      }
      const plannedDays = Math.floor((new Date(`${plannedEndDate}T00:00:00.000Z`).getTime() - new Date(`${startDate}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
      if (plannedDays < 1 || plannedDays > 21) throw new Error("Choose an experiment window between 1 and 21 days.");
      const [activeExperiment] = await db
        .select({ id: experiments.id })
        .from(experiments)
        .where(and(eq(experiments.userId, identity.id), eq(experiments.status, "ACTIVE")))
        .limit(1);
      if (activeExperiment) throw new Error("Finish the active experiment before starting another one.");
      const [activeHypothesis] = await db
        .select()
        .from(hypotheses)
        .where(eq(hypotheses.userId, identity.id))
        .orderBy(desc(hypotheses.createdAt))
        .limit(1);
      await db.insert(experiments).values({
        id,
        userId: identity.id,
        hypothesisId: activeHypothesis?.id ?? null,
        targetPattern: String(body.targetPattern),
        targetCondition: String(body.targetCondition),
        alternativeBehaviour: String(body.alternativeBehaviour),
        expectedReward: String(body.expectedReward),
        witness: String(body.witness ?? "") || null,
        restartPlan: String(body.restartPlan),
        minimumVersion: String(body.minimumVersion),
        failureSignal: String(body.failureSignal),
        impactDomains: jsonValue(Array.isArray(body.impactDomains) ? body.impactDomains : []),
        predictedValue: prediction,
        startDate,
        plannedEndDate,
      });
      await db.insert(experimentParameterVersions).values({
        id: crypto.randomUUID(),
        experimentId: id,
        userId: identity.id,
        version: 1,
        effectiveFrom: `${startDate}T00:00:00.000Z`,
        targetCondition: String(body.targetCondition),
        alternativeBehaviour: String(body.alternativeBehaviour),
        expectedReward: String(body.expectedReward),
        restartPlan: String(body.restartPlan),
        minimumVersion: String(body.minimumVersion),
        failureSignal: String(body.failureSignal),
        changeReason: "EXPERIMENT_STARTED",
      });
      await db
        .update(labEnrollments)
        .set({ status: "EXPERIMENT_ACTIVE", currentInvestigation: 7, experimentStartedAt: now, updatedAt: now })
        .where(and(eq(labEnrollments.userId, identity.id), eq(labEnrollments.labVersion, LAB_VERSION)));
      await audit(identity.id, "EXPERIMENT_STARTED", "EXPERIMENT", id, { prediction });
      await pilotEvent(identity.id, "EXPERIMENT_STARTED", "EXPERIMENT", id, { prediction, plannedDays: 7 });
      return Response.json(await snapshot(identity), { status: 201 });
    }

    if (action === "saveEvent") {
      const experimentId = String(body.experimentId ?? "");
      const dayNumber = Number(body.dayNumber ?? 0);
      if (!experimentId || dayNumber < 1 || dayNumber > 21) throw new Error("Choose a valid experiment day.");
      const [experiment] = await db
        .select()
        .from(experiments)
        .where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id)))
        .limit(1);
      if (!experiment) throw new Error("Experiment not found.");
      if (experiment.status !== "ACTIVE") throw new Error("This experiment is closed. Continue to the evidence review.");
      const start = new Date(`${experiment.startDate}T00:00:00.000Z`);
      const end = new Date(`${experiment.plannedEndDate}T00:00:00.000Z`);
      const plannedDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
      if (dayNumber > plannedDays) throw new Error("That day is outside the current experiment window.");
      const cueOccurred = body.targetConditionOccurred === true;
      const existing = await db
        .select()
        .from(experimentEvents)
        .where(and(eq(experimentEvents.experimentId, experimentId), eq(experimentEvents.dayNumber, dayNumber)))
        .limit(1);
      const eventId = existing[0]?.id ?? crypto.randomUUID();
      const eventDate = new Date(start);
      eventDate.setUTCDate(start.getUTCDate() + dayNumber - 1);
      eventDate.setUTCHours(12, 0, 0, 0);
      const occurredAt = eventDate.toISOString();
      await db
        .insert(experimentEvents)
        .values({
          id: eventId,
          experimentId,
          userId: identity.id,
          dayNumber,
          occurredAt,
          eligibleOpportunity: cueOccurred,
          targetConditionOccurred: cueOccurred,
          alternativeUsed: cueOccurred ? body.alternativeUsed === true : null,
          notes: String(body.notes ?? "") || null,
        })
        .onConflictDoUpdate({
          target: [experimentEvents.experimentId, experimentEvents.dayNumber],
          set: {
            occurredAt,
            eligibleOpportunity: cueOccurred,
            targetConditionOccurred: cueOccurred,
            alternativeUsed: cueOccurred ? body.alternativeUsed === true : null,
            notes: String(body.notes ?? "") || null,
            recordedAt: new Date().toISOString(),
          },
        });
      await db.update(evidenceRecords).set({ status: "SUPERSEDED" }).where(eq(evidenceRecords.sourceObjectId, eventId));
      await db.insert(evidenceRecords).values({
        id: crypto.randomUUID(),
        userId: identity.id,
        investigationId: "HAB.I7",
        semanticFieldId: "HAB.EXPERIMENT.EVENT",
        sourceObjectType: "EXPERIMENT_EVENT",
        sourceObjectId: eventId,
        provenance: "BO",
        valueType: "EVENT",
        value: jsonValue({
          dayNumber,
          targetConditionOccurred: cueOccurred,
          alternativeUsed: cueOccurred ? body.alternativeUsed === true : null,
          notes: String(body.notes ?? "") || null,
        }),
        sensitivity: "P2",
        occurredAt,
      });
      await calculateExperiment(identity, experimentId, experiment.predictedValue);
      await audit(identity.id, "OPPORTUNITY_RECORDED", "EXPERIMENT_EVENT", eventId, { dayNumber, cueOccurred });
      await pilotEvent(identity.id, existing.length ? "EXPERIMENT_EVENT_CORRECTED" : "EXPERIMENT_EVENT_RECORDED", "EXPERIMENT_EVENT", eventId, { dayNumber, cueOccurred });
      return Response.json(await snapshot(identity));
    }

    if (action === "saveCheckpoint") {
      const experimentId = String(body.experimentId ?? "");
      const surprise = String(body.surprise ?? "").trim();
      const observability = String(body.observability ?? "");
      const evidenceSupport = String(body.evidenceSupport ?? "").trim();
      const evidenceChallenge = String(body.evidenceChallenge ?? "").trim();
      const decision = body.decision === "ADJUST" ? "ADJUST" : "KEEP";
      if (!experimentId || !surprise || !evidenceSupport || !evidenceChallenge || !["EASIER", "AS_EXPECTED", "HARDER"].includes(observability)) {
        throw new Error("Complete the checkpoint reflection before saving it.");
      }
      const [experiment] = await db
        .select()
        .from(experiments)
        .where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id)))
        .limit(1);
      if (!experiment || experiment.status !== "ACTIVE") throw new Error("Only an active experiment can be calibrated.");
      await ensureInitialParameterVersion(experiment);
      const eventRows = await db
        .select({ id: experimentEvents.id })
        .from(experimentEvents)
        .where(and(eq(experimentEvents.experimentId, experimentId), eq(experimentEvents.userId, identity.id)));
      if (eventRows.length < 3) throw new Error("Record three experiment days before the checkpoint.");
      const [existingCheckpoint] = await db
        .select({ id: experimentCheckpoints.id })
        .from(experimentCheckpoints)
        .where(and(eq(experimentCheckpoints.experimentId, experimentId), eq(experimentCheckpoints.dayNumber, 3)))
        .limit(1);
      if (existingCheckpoint) throw new Error("The Day 3 checkpoint is already recorded.");

      const adjustedCondition = String(body.targetCondition ?? "").trim() || experiment.targetCondition;
      const adjustedAlternative = String(body.alternativeBehaviour ?? "").trim() || experiment.alternativeBehaviour;
      if (decision === "ADJUST" && adjustedCondition === experiment.targetCondition && adjustedAlternative === experiment.alternativeBehaviour) {
        throw new Error("Change the cue or alternative before saving an adjustment.");
      }
      const checkpointId = crypto.randomUUID();
      const now = new Date().toISOString();
      const adjustmentSummary = decision === "ADJUST"
        ? `Cue: ${adjustedCondition} · Alternative: ${adjustedAlternative}`
        : null;
      await db.insert(experimentCheckpoints).values({
        id: checkpointId,
        experimentId,
        userId: identity.id,
        dayNumber: 3,
        surprise,
        observability,
        evidenceSupport,
        evidenceChallenge,
        decision,
        adjustmentSummary,
      });
      if (decision === "ADJUST") {
        const nextVersion = experiment.parameterVersion + 1;
        await db.insert(experimentParameterVersions).values({
          id: crypto.randomUUID(),
          experimentId,
          userId: identity.id,
          version: nextVersion,
          effectiveFrom: now,
          targetCondition: adjustedCondition,
          alternativeBehaviour: adjustedAlternative,
          expectedReward: experiment.expectedReward,
          restartPlan: experiment.restartPlan,
          minimumVersion: experiment.minimumVersion,
          failureSignal: experiment.failureSignal,
          changeReason: "DAY_3_CHECKPOINT",
        });
        await db.update(experiments).set({
          targetCondition: adjustedCondition,
          alternativeBehaviour: adjustedAlternative,
          parameterVersion: nextVersion,
          updatedAt: now,
        }).where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id)));
      }
      await audit(identity.id, "EXPERIMENT_CHECKPOINT_RECORDED", "EXPERIMENT_CHECKPOINT", checkpointId, { decision, parameterVersion: decision === "ADJUST" ? experiment.parameterVersion + 1 : experiment.parameterVersion });
      await pilotEvent(identity.id, "DAY_3_CHECKPOINT_COMPLETED", "EXPERIMENT_CHECKPOINT", checkpointId, { decision, observability });
      return Response.json(await snapshot(identity), { status: 201 });
    }

    if (action === "completeExperiment") {
      const experimentId = String(body.experimentId ?? "");
      const decision = String(body.decision ?? "");
      if (!["EXTEND", "ADJUST_CUE", "FINISH_INSUFFICIENT", "FINISH"].includes(decision)) {
        throw new Error("Choose how to close or continue the experiment.");
      }
      const [experiment] = await db
        .select()
        .from(experiments)
        .where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id)))
        .limit(1);
      if (!experiment || experiment.status !== "ACTIVE") throw new Error("Only an active experiment can be completed or extended.");
      const eventRows = await db
        .select()
        .from(experimentEvents)
        .where(and(eq(experimentEvents.experimentId, experimentId), eq(experimentEvents.userId, identity.id)));
      const metrics = computeHabitMetrics(eventRows, experiment.predictedValue);
      const now = new Date().toISOString();

      if (decision === "EXTEND" || decision === "ADJUST_CUE") {
        const end = new Date(`${experiment.plannedEndDate}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 3);
        const plannedEndDate = end.toISOString().slice(0, 10);
        const totalDays = Math.floor((end.getTime() - new Date(`${experiment.startDate}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
        if (totalDays > 21) throw new Error("This pilot supports a maximum 21-day experiment window.");
        const update: Partial<typeof experiments.$inferInsert> = { plannedEndDate, updatedAt: now };
        if (decision === "ADJUST_CUE") {
          const targetCondition = String(body.targetCondition ?? "").trim();
          if (!targetCondition || targetCondition === experiment.targetCondition) {
            throw new Error("Name a more observable cue before extending the experiment.");
          }
          await ensureInitialParameterVersion(experiment);
          const nextVersion = experiment.parameterVersion + 1;
          await db.insert(experimentParameterVersions).values({
            id: crypto.randomUUID(),
            experimentId,
            userId: identity.id,
            version: nextVersion,
            effectiveFrom: now,
            targetCondition,
            alternativeBehaviour: experiment.alternativeBehaviour,
            expectedReward: experiment.expectedReward,
            restartPlan: experiment.restartPlan,
            minimumVersion: experiment.minimumVersion,
            failureSignal: experiment.failureSignal,
            changeReason: "INSUFFICIENT_EVIDENCE_CUE_ADJUSTMENT",
          });
          update.targetCondition = targetCondition;
          update.parameterVersion = nextVersion;
        }
        await db.update(experiments).set(update).where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id)));
        await audit(identity.id, "EXPERIMENT_EXTENDED", "EXPERIMENT", experimentId, { decision, plannedEndDate, opportunityCount: metrics.opportunityCount });
        await pilotEvent(identity.id, "EXPERIMENT_EXTENDED", "EXPERIMENT", experimentId, { decision, opportunityCount: metrics.opportunityCount });
        return Response.json(await snapshot(identity));
      }

      if (decision === "FINISH" && metrics.opportunityCount < experiment.minimumEvidenceThreshold) {
        throw new Error("This experiment has limited evidence. Extend it, refine the cue, or finish explicitly with insufficient evidence.");
      }
      if (decision === "FINISH_INSUFFICIENT" && metrics.opportunityCount >= experiment.minimumEvidenceThreshold) {
        throw new Error("The experiment has reached its minimum evidence threshold. Finish and review the evidence normally.");
      }
      const status = decision === "FINISH" ? "COMPLETED" : "COMPLETED_INSUFFICIENT";
      await db.update(experiments).set({ status, actualEndDate: now.slice(0, 10), updatedAt: now }).where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id)));
      await db.update(labEnrollments).set({ status: "EVIDENCE_REVIEW", currentInvestigation: 8, updatedAt: now }).where(and(eq(labEnrollments.userId, identity.id), eq(labEnrollments.labVersion, LAB_VERSION)));
      await calculateExperiment(identity, experimentId, experiment.predictedValue);
      await audit(identity.id, "EXPERIMENT_COMPLETED", "EXPERIMENT", experimentId, { status, opportunityCount: metrics.opportunityCount, evidenceStrength: metrics.evidenceStrength });
      await pilotEvent(identity.id, "EXPERIMENT_COMPLETED", "EXPERIMENT", experimentId, { status, opportunityCount: metrics.opportunityCount, evidenceStrength: metrics.evidenceStrength });
      return Response.json(await snapshot(identity));
    }

    if (action === "updateNotificationPreferences") {
      const reminderTime = String(body.reminderTime ?? "18:00");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) throw new Error("Choose a valid reminder time.");
      const values = {
        userId: identity.id,
        enabled: body.enabled === true,
        experimentStarted: body.experimentStarted === true,
        dailyObservation: body.dailyObservation === true,
        dayThreeCheckpoint: body.dayThreeCheckpoint === true,
        experimentEnding: body.experimentEnding === true,
        reviewReady: body.reviewReady === true,
        reminderTime,
        timezone: "Africa/Johannesburg",
        updatedAt: new Date().toISOString(),
      };
      await db.insert(notificationPreferences).values(values).onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: values,
      });
      await audit(identity.id, "NOTIFICATION_PREFERENCES_UPDATED", "LEARNER", identity.id, { enabled: values.enabled });
      await pilotEvent(identity.id, "NOTIFICATION_PREFERENCES_UPDATED", "LEARNER", identity.id, { enabled: values.enabled });
      return Response.json(await snapshot(identity));
    }

    if (action === "withdrawConsent") {
      const now = new Date().toISOString();
      const consentId = crypto.randomUUID();
      await db.insert(consentRecords).values({
        id: consentId,
        userId: identity.id,
        policyVersion: POLICY_VERSION,
        scope: "HABIT_LAB_PRODUCT_AND_LEARNER_REPORT",
        status: "WITHDRAWN",
        withdrawnAt: now,
        createdAt: now,
      });
      await db.update(learners).set({ status: "PAUSED", updatedAt: now }).where(eq(learners.userId, identity.id));
      await audit(identity.id, "CONSENT_CHANGED", "CONSENT_RECORD", consentId, { status: "WITHDRAWN" });
      await pilotEvent(identity.id, "CONSENT_WITHDRAWN", "CONSENT_RECORD", consentId);
      return Response.json(await snapshot(identity));
    }

    if (action === "remember") {
      const statement = String(body.statement ?? "").trim();
      const sourceId = String(body.sourceId ?? "");
      if (!statement || !sourceId) throw new Error("A source-linked memory is required.");
      const id = crypto.randomUUID();
      await db.insert(memoryItems).values({
        id,
        userId: identity.id,
        memoryType: "CONFIRMED_PATTERN",
        statement,
        sourceType: "HYPOTHESIS",
        sourceId,
        confirmationLevel: "USER_CONFIRMED",
      });
      await audit(identity.id, "MEMORY_CREATED", "MEMORY_ITEM", id);
      return Response.json(await snapshot(identity), { status: 201 });
    }

    if (action === "retireMemory") {
      const memoryId = String(body.memoryId ?? "");
      await db
        .update(memoryItems)
        .set({ status: "RETIRED", retiredAt: new Date().toISOString() })
        .where(and(eq(memoryItems.id, memoryId), eq(memoryItems.userId, identity.id)));
      await audit(identity.id, "MEMORY_RETIRED", "MEMORY_ITEM", memoryId);
      return Response.json(await snapshot(identity));
    }

    if (action === "companion") {
      const message = String(body.message ?? "").trim();
      if (!message) throw new Error("Ask a question about your investigation.");
      const current = await snapshot(identity);
      const lower = message.toLowerCase();
      const cue = current.responses["HAB.CUE.TEXT"]?.value;
      const reward = current.responses["HAB.REWARD.LESS_OBVIOUS"]?.value;
      const evidence = current.responses["HAB.EVIDENCE.INITIAL"]?.value;
      const challenging = current.responses["HAB.EVIDENCE.CHALLENGING"]?.value;
      let reply = "What part of the pattern would be most useful to look at next: the cue, the reward, the cost, or what happened in the experiment?";
      let mode = "CLARIFY";
      let refs: string[] = [];
      if (lower.includes("cue") || lower.includes("trigger")) {
        reply = cue
          ? `You recorded your cue as: “${String(cue)}”. Does that still fit, or has the experiment made it more specific?`
          : "A cue is what tends to happen immediately before the pattern—such as a time, place, person, feeling, event or situation. What do you notice in your own situation?";
        mode = cue ? "EVIDENCE_RETRIEVAL" : "CLARIFY";
        refs = cue ? ["HAB.CUE.TEXT"] : [];
      } else if (lower.includes("less obvious") || lower.includes("reward")) {
        reply = reward
          ? `You described the less-obvious reward as: “${String(reward)}”. That is your report, not a verdict. What evidence would support or challenge it?`
          : "The obvious reward is usually what you can name quickly. A less-obvious reward is something the behaviour may do underneath—such as relief, escape, control or avoiding discomfort. Before more examples, what do you notice in your own situation?";
        mode = reward ? "EVIDENCE_REVIEW" : "CLARIFY";
        refs = reward ? ["HAB.REWARD.LESS_OBVIOUS"] : [];
      } else if (lower.includes("evidence") || lower.includes("record")) {
        reply = evidence
          ? `Your first evidence record says: “${String(evidence)}”. Your experiment currently contains ${current.events.length} recorded day${current.events.length === 1 ? "" : "s"}.`
          : "Your evidence will appear as you investigate. Start with one specific event, object, screenshot, message or record from the last seven days.";
        mode = "EVIDENCE_RETRIEVAL";
        refs = evidence ? ["HAB.EVIDENCE.INITIAL"] : [];
      } else if (lower.includes("challenge") || lower.includes("wrong") || lower.includes("contradiction")) {
        reply = challenging
          ? `You recorded this challenging evidence: “${String(challenging)}”. What exception does it reveal?`
          : current.hypothesis
            ? `Your own challenge test is: “${current.hypothesis.falsificationStatement}”. What have you observed that might make the original equation less convincing?`
            : "A useful explanation needs a way to be challenged. What would you expect to see if your current explanation were incomplete?";
        mode = "HYPOTHESIS_EXAMINATION";
        refs = challenging ? ["HAB.EVIDENCE.CHALLENGING"] : [];
      }
      await db.insert(companionTurns).values([
        { id: crypto.randomUUID(), userId: identity.id, role: "USER", content: message, mode: "USER_MESSAGE" },
        { id: crypto.randomUUID(), userId: identity.id, role: "ASSISTANT", content: reply, mode, evidenceRefs: JSON.stringify(refs) },
      ]);
      return Response.json({ reply, mode, evidenceRefs: refs });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
