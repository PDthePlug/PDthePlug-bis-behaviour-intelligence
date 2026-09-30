import { and, desc, eq, or } from "../../../db/query";
import { getDb, withSupabaseRequest } from "../../../db";
import {
  auditEvents,
  consentRecords,
  contentReleases,
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
  notificationPreferences,
  pilotEvents,
  responses,
} from "../../../db/schema";
import { identityFrom } from "../../../lib/bis-access";
import { getCoreLab, labFieldRegistry, type CoreLabDefinition } from "../../../lib/core-labs";
import {
  actionOwnsInvestigationUnlock,
  investigationUnlockedAfterSave,
} from "../../../lib/lab-lifecycle-contract";
import { POLICY_VERSION } from "../../../lib/habit-lab";

import type { Identity } from "../../../lib/bis-access";

import { ratingShift, isIsoDate } from "../../../lib/evidence-validation.mjs";

const DAY_MS = 86_400_000;

function encode(value: unknown) {
  return JSON.stringify(value ?? null);
}

function decode(value: string | null) {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message.includes("no such table") ? "Your investigation store is being prepared. Please try again shortly." : message;
}

function dateNumber(value: string) {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / DAY_MS);
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

function calendarDay(startDate: string, today: string) {
  return Math.max(0, dateNumber(today) - dateNumber(startDate) + 1);
}

async function audit(identity: Identity, action: string, objectType: string, objectId: string, metadata: Record<string, unknown>) {
  await getDb().insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorId: identity.id,
    action,
    objectType,
    objectId,
    metadata: encode(metadata),
  });
}

async function pilot(identity: Identity, lab: CoreLabDefinition, name: string, objectType: string, objectId: string, metadata: Record<string, unknown> = {}) {
  await getDb().insert(pilotEvents).values({
    id: crypto.randomUUID(),
    userId: identity.id,
    name,
    objectType,
    objectId,
    labVersion: lab.version,
    metadata: encode({ labCode: lab.code, ...metadata }),
  });
}

async function enrolmentFor(userId: string, lab: CoreLabDefinition) {
  const [row] = await getDb()
    .select()
    .from(labEnrollments)
    .where(and(eq(labEnrollments.userId, userId), eq(labEnrollments.labCode, lab.code), eq(labEnrollments.labVersion, lab.version)))
    .limit(1);
  return row;
}

async function consentFor(userId: string) {
  const [row] = await getDb()
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(desc(consentRecords.createdAt))
    .limit(1);
  return row;
}

async function ensureCanWrite(identity: Identity) {
  const [profile] = await getDb().select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
  if (!profile) throw new Error("Complete your BIS profile before opening this Lab.");
  const consent = await consentFor(identity.id);
  if (consent?.status !== "GRANTED") throw new Error("This investigation is paused because product consent is not active.");
  return profile;
}

async function saveResponse(identity: Identity, lab: CoreLabDefinition, item: Record<string, unknown>) {
  const fieldId = String(item.semanticFieldId ?? "");
  const field = labFieldRegistry(lab).get(fieldId);
  if (!field) throw new Error(`That evidence field is not registered for ${lab.shortTitle} ${lab.version}.`);
  const db = getDb();
  const now = new Date().toISOString();
  const responseStatus = item.responseStatus === "PASS" ? "PASS" : "ANSWERED";
  const enrolment = await enrolmentFor(identity.id, lab);
  if (!enrolment) throw new Error(`Open ${lab.shortTitle} before saving evidence.`);
  const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
  const [previous] = await db
    .select()
    .from(responses)
    .where(and(eq(responses.userId, identity.id), eq(responses.labCode, lab.code), eq(responses.semanticFieldId, fieldId), eq(responses.labVersion, lab.version)))
    .orderBy(desc(responses.recordedAt))
    .limit(1);
  const id = crypto.randomUUID();
  if (previous && previous.responseStatus !== "SUPERSEDED") {
    await db.update(responses).set({ responseStatus: "SUPERSEDED" }).where(eq(responses.id, previous.id));
    await db.update(evidenceRecords).set({ status: "SUPERSEDED" }).where(eq(evidenceRecords.sourceObjectId, previous.id));
  }
  await db.insert(responses).values({
    id,
    userId: identity.id,
    promptId: `${lab.prefix}.I${field.investigation}.${fieldId.split(".").slice(1).join("_")}`,
    semanticFieldId: fieldId,
    labCode: lab.code,
    labVersion: lab.version,
    contentReleaseId: enrolment.contentReleaseId ?? null,
    deliveryEdition: profile?.deliveryEdition ?? "school",
    promptVersion: lab.version,
    privacyClass: field.sensitivity ?? "P2",
    provenance: "SR",
    value: responseStatus === "PASS" ? null : encode(item.value),
    responseStatus,
    occurredAt: typeof item.occurredAt === "string" ? item.occurredAt : now,
    supersedesResponseId: previous?.id ?? null,
  });
  await db.insert(evidenceRecords).values({
    id: crypto.randomUUID(),
    userId: identity.id,
    labCode: lab.code,
    labVersion: lab.version,
    contentReleaseId: enrolment.contentReleaseId ?? null,
    investigationId: `${lab.prefix}.I${field.investigation}`,
    semanticFieldId: fieldId,
    sourceObjectType: "RESPONSE",
    sourceObjectId: id,
    provenance: "SR",
    valueType: field.type ?? "TEXT",
    value: responseStatus === "PASS" ? null : encode(item.value),
    status: responseStatus === "PASS" ? "WITHDRAWN" : "ACTIVE",
    sensitivity: field.sensitivity ?? "P2",
    occurredAt: typeof item.occurredAt === "string" ? item.occurredAt : now,
  });
  await audit(identity, previous ? "RESPONSE_CORRECTED" : "RESPONSE_CREATED", "RESPONSE", id, { labCode: lab.code, labVersion: lab.version, semanticFieldId: fieldId });
}

async function calculate(identity: Identity, lab: CoreLabDefinition, experimentId: string, predicted: number) {
  const db = getDb();
  const rows = await db.select().from(experimentEvents).where(and(eq(experimentEvents.userId, identity.id), eq(experimentEvents.experimentId, experimentId)));
  const eligible = rows.filter((row) => row.eligibleOpportunity);
  const completed = eligible.filter((row) => row.alternativeUsed === true);
  const adherence = eligible.length === 0 ? null : Math.round((completed.length / eligible.length) * 100);
  const accuracy = adherence === null ? null : Math.max(0, 100 - Math.abs(predicted - adherence));
  const strength = eligible.length === 0 ? "NONE" : eligible.length < 3 ? "LIMITED" : "SUFFICIENT_FOR_LAB";
  const parsedDetails = rows.map((row) => ({ row, details: decode(row.notes) as Record<string, unknown> | null }));
  const completedDetails = parsedDetails.filter(({ row }) => row.alternativeUsed === true);
  const typedPauses = completedDetails.filter(({ details }) =>
    details?.pauseType === "Full" || details?.pauseType === "Minimum"
  );
  const pauseTypeCoverageComplete = typedPauses.length === completed.length;
  const fullPauses = typedPauses.filter(({ details }) => details?.pauseType === "Full").length;
  const minimumPauses = typedPauses.filter(({ details }) => details?.pauseType === "Minimum").length;
  const extraOptions = lab.code === "DEC"
    ? completedDetails.filter(({ details }) => details?.pauseType === "Full" && details?.extraOption === true).length
    : 0;
  const metrics: Array<readonly [string, number | null, "VALUE" | "NA"]> = [
    [`${lab.prefix}.EXPERIMENT.OPPORTUNITY_COUNT`, eligible.length, "VALUE"],
    [`${lab.prefix}.EXPERIMENT.PAUSE_COUNT`, completed.length, "VALUE"],
    [`${lab.prefix}.BEI06`, adherence, adherence === null ? "NA" : "VALUE"],
    [`${lab.prefix}.BEI03`, accuracy, accuracy === null ? "NA" : "VALUE"],
  ];
  if (lab.code === "DEC") {
    metrics.push([
      `${lab.prefix}.FULL_PAUSE_COUNT`,
      pauseTypeCoverageComplete ? fullPauses : null,
      pauseTypeCoverageComplete ? "VALUE" : "NA",
    ]);
    metrics.push([
      `${lab.prefix}.MINIMUM_PAUSE_COUNT`,
      pauseTypeCoverageComplete ? minimumPauses : null,
      pauseTypeCoverageComplete ? "VALUE" : "NA",
    ]);
    metrics.push([
      `${lab.prefix}.OPTION_EXPANSION_COUNT`,
      pauseTypeCoverageComplete ? extraOptions : null,
      pauseTypeCoverageComplete ? "VALUE" : "NA",
    ]);
    metrics.push([
      `${lab.prefix}.OPTION_EXPANSION_RATE`,
      pauseTypeCoverageComplete && fullPauses > 0 ? Math.round((extraOptions / fullPauses) * 100) : null,
      pauseTypeCoverageComplete && fullPauses > 0 ? "VALUE" : "NA",
    ]);
  } else {
    metrics.push([`${lab.prefix}.FULL_PAUSE_COUNT`, fullPauses, "VALUE"]);
    metrics.push([`${lab.prefix}.MINIMUM_PAUSE_COUNT`, minimumPauses, "VALUE"]);
    const outcomeCodes = [
      ["Bought as originally intended", "OUTCOME_BOUGHT"],
      ["Changed purchase", "OUTCOME_CHANGED"],
      ["Delayed purchase", "OUTCOME_DELAYED"],
      ["Did not purchase", "OUTCOME_NOT_PURCHASED"],
      ["No useful alternative found", "OUTCOME_NO_ALTERNATIVE"],
    ] as const;
    for (const [category, code] of outcomeCodes) {
      metrics.push([`${lab.prefix}.${code}`, parsedDetails.filter(({ row, details }) => row.eligibleOpportunity && details?.outcomeCategory === category).length, "VALUE"]);
    }
  }
  for (const [code, value, status] of metrics) {
    const [existing] = await db.select({ id: measurementValues.id }).from(measurementValues).where(and(
      eq(measurementValues.userId, identity.id),
      eq(measurementValues.experimentId, experimentId),
      eq(measurementValues.code, code),
    )).limit(1);
    const measurementId = existing?.id ?? crypto.randomUUID();
    await db.insert(measurementValues).values({
      id: measurementId,
      userId: identity.id,
      experimentId,
      code,
      value: encode(value),
      status,
      evidenceStrength: strength,
    }).onConflictDoUpdate({
      target: [measurementValues.userId, measurementValues.experimentId, measurementValues.code],
      set: { value: encode(value), status, evidenceStrength: strength, calculatedAt: new Date().toISOString() },
    });
    await db.delete(measurementSources).where(eq(measurementSources.measurementId, measurementId));
    const sources = rows.flatMap((row) => [
      { id: crypto.randomUUID(), measurementId, userId: identity.id, sourceObjectType: "EXPERIMENT_EVENT", sourceObjectId: row.id, inputRole: "ELIGIBLE_OPPORTUNITY", inputValue: encode(row.eligibleOpportunity) },
      { id: crypto.randomUUID(), measurementId, userId: identity.id, sourceObjectType: "EXPERIMENT_EVENT", sourceObjectId: row.id, inputRole: "PAUSE_COMPLETED", inputValue: encode(row.alternativeUsed) },
    ]);
    if (code.endsWith("BEI03")) sources.push({
      id: crypto.randomUUID(), measurementId, userId: identity.id, sourceObjectType: "EXPERIMENT", sourceObjectId: experimentId, inputRole: "PREDICTED_ADHERENCE", inputValue: encode(predicted),
    });
    if (sources.length) await db.insert(measurementSources).values(sources);
  }
}

async function snapshot(identity: Identity, lab: CoreLabDefinition) {
  const db = getDb();
  const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
  const consent = await consentFor(identity.id);
  const enrolment = await enrolmentFor(identity.id, lab);
  const responseRows = (await db.select().from(responses).where(and(eq(responses.userId, identity.id), eq(responses.labCode, lab.code), eq(responses.labVersion, lab.version))).orderBy(responses.recordedAt))
    .filter((row) => row.semanticFieldId.startsWith(`${lab.prefix}.`));
  const currentResponses: Record<string, { value: unknown; status: string; responseId: string; recordedAt: string }> = {};
  for (const row of responseRows) {
    if (row.responseStatus === "SUPERSEDED") continue;
    currentResponses[row.semanticFieldId] = { value: decode(row.value), status: row.responseStatus, responseId: row.id, recordedAt: row.recordedAt };
  }
  const [hypothesis] = await db.select().from(hypotheses).where(and(
    eq(hypotheses.userId, identity.id),
    eq(hypotheses.labCode, lab.code),
    eq(hypotheses.labVersion, lab.version),
    eq(hypotheses.status, "ACTIVE"),
  )).orderBy(desc(hypotheses.createdAt)).limit(1);
  const [experiment] = await db.select().from(experiments).where(and(
    eq(experiments.userId, identity.id),
    eq(experiments.labCode, lab.code),
    eq(experiments.labVersion, lab.version),
  )).orderBy(desc(experiments.createdAt)).limit(1);
  const events = experiment ? await db.select().from(experimentEvents).where(and(eq(experimentEvents.userId, identity.id), eq(experimentEvents.experimentId, experiment.id))).orderBy(experimentEvents.dayNumber) : [];
  const checkpoints = experiment ? await db.select().from(experimentCheckpoints).where(and(eq(experimentCheckpoints.userId, identity.id), eq(experimentCheckpoints.experimentId, experiment.id))).orderBy(experimentCheckpoints.dayNumber) : [];
  const measures = experiment ? await db.select().from(measurementValues).where(and(eq(measurementValues.userId, identity.id), eq(measurementValues.experimentId, experiment.id))) : [];
  const measurements = Object.fromEntries(measures.filter((row) => row.code.startsWith(`${lab.prefix}.`)).map((row) => [row.code, { ...row, value: decode(row.value) }]));
  const [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, identity.id)).limit(1);
  const timeZone = preference?.timezone ?? profile?.timezone ?? "Africa/Johannesburg";
  const serverToday = todayInZone(timeZone);
  const timing = experiment ? {
    calendarDay: calendarDay(experiment.startDate, serverToday),
    totalDays: dateNumber(experiment.plannedEndDate) - dateNumber(experiment.startDate) + 1,
    today: serverToday,
  } : null;
  return {
    lab: { code: lab.code, slug: lab.slug, version: lab.version, title: lab.title },
    identity: { id: identity.id, email: identity.email, displayName: identity.displayName },
    profile: profile ?? null,
    consent: consent ?? null,
    enrolment: enrolment ?? null,
    responses: currentResponses,
    hypothesis: hypothesis ?? null,
    experiment: experiment ? { ...experiment, impactDomains: decode(experiment.impactDomains) } : null,
    events: events.map((row) => ({ ...row, details: decode(row.notes) })),
    checkpoints,
    measurements,
    timing,
    serverToday,
  };
}

function requestedLab(request: Request, body?: Record<string, unknown>) {
  const code = body ? String(body.labCode ?? "") : new URL(request.url).searchParams.get("lab");
  return getCoreLab(code);
}

async function getHandler(request: Request) {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const lab = requestedLab(request);
  if (!lab) return Response.json({ error: "Choose Decision Lab or Money Lab." }, { status: 400 });
  try {
    return Response.json(await snapshot(identity, lab));
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

async function postHandler(request: Request) {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const lab = requestedLab(request, body);
    if (!lab) throw new Error("Choose Decision Lab or Money Lab.");
    const action = String(body.action ?? "");
    const db = getDb();
    await ensureCanWrite(identity);

    if (action === "openLab") {
      if (body.consent !== true) throw new Error(`Confirm the ${lab.shortTitle} privacy notice before opening the Lab.`);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const consentId = crypto.randomUUID();
      const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
      const [release] = profile ? await db.select().from(contentReleases).where(and(
        eq(contentReleases.labCode, lab.code),
        eq(contentReleases.deliveryEdition, profile.deliveryEdition),
        or(eq(contentReleases.status, "PUBLISHED"), eq(contentReleases.status, "CONTROLLED")),
      )).orderBy(desc(contentReleases.createdAt)).limit(1) : [];
      await db.insert(consentRecords).values({
        id: consentId,
        userId: identity.id,
        policyVersion: POLICY_VERSION,
        scope: `${lab.code}_LAB_PRODUCT_AND_LEARNER_REPORT`,
        status: "GRANTED",
        grantedAt: now,
      });
      await db.insert(labEnrollments).values({ id, userId: identity.id, labCode: lab.code, labVersion: lab.version, contentReleaseId: release?.id ?? null }).onConflictDoUpdate({
        target: [labEnrollments.userId, labEnrollments.labCode, labEnrollments.labVersion],
        set: { contentReleaseId: release?.id ?? null, updatedAt: now },
      });
      await audit(identity, "CONSENT_CHANGED", "CONSENT_RECORD", consentId, { status: "GRANTED", labCode: lab.code, labVersion: lab.version });
      await audit(identity, "LAB_OPENED", "LAB_ENROLLMENT", id, { labCode: lab.code, labVersion: lab.version });
      await pilot(identity, lab, `${lab.code}_LAB_OPENED`, "LAB_ENROLLMENT", id);
      return Response.json(await snapshot(identity, lab), { status: 201 });
    }

    const enrolment = await enrolmentFor(identity.id, lab);
    if (!enrolment) throw new Error(`Open ${lab.shortTitle} before adding evidence.`);

    if (action === "saveResponses") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length || items.length > 30) throw new Error("Provide between 1 and 30 evidence responses.");

      // Validate the whole investigation before writing any response. Progress is
      // unlocked only after every response in this save has succeeded.
      const registry = labFieldRegistry(lab);
      const prepared = items.map((item) => {
        if (!item || typeof item !== "object") throw new Error("One evidence response is invalid.");
        const row = item as Record<string, unknown>;
        const semanticFieldId = String(row.semanticFieldId ?? "");
        const field = registry.get(semanticFieldId);
        if (!field) throw new Error(`That evidence field is not registered for ${lab.shortTitle} ${lab.version}.`);
        return { row, field };
      });
      const investigations = new Set(prepared.map(({ field }) => field.investigation));
      if (investigations.size !== 1) throw new Error("Save one investigation at a time.");
      const investigation = prepared[0]?.field.investigation ?? 0;
      const serverCurrent = Math.max(1, Number(enrolment.currentInvestigation ?? 1));
      if (investigation > 0 && investigation > serverCurrent) {
        throw new Error("Complete the current investigation before moving ahead.");
      }

      for (const { row } of prepared) await saveResponse(identity, lab, row);

      if (investigation > 0 && actionOwnsInvestigationUnlock(action, investigation)) {
        const unlocked = investigationUnlockedAfterSave(investigation);
        const now = new Date().toISOString();
        await db.update(labEnrollments).set({
          currentInvestigation: Math.max(serverCurrent, unlocked),
          updatedAt: now,
        }).where(eq(labEnrollments.id, enrolment.id));
        await audit(identity, "LAB_INVESTIGATION_UNLOCKED", "LAB_ENROLLMENT", enrolment.id, {
          labCode: lab.code,
          labVersion: lab.version,
          completedInvestigation: investigation,
          unlockedInvestigation: unlocked,
        });
      }

      const savedIds = new Set(prepared.map(({ row }) => String(row.semanticFieldId ?? "")));
      if ([lab.postMetric.id, lab.preMetric.id, lab.confidencePost, lab.confidencePre].some((id) => savedIds.has(id))) {
        const rows = await db.select().from(responses).where(and(eq(responses.userId, identity.id), eq(responses.labCode, lab.code), eq(responses.labVersion, lab.version))).orderBy(desc(responses.recordedAt));
        const latestValue = (fieldId: string) => {
          const row = rows.find((item) => item.semanticFieldId === fieldId && item.responseStatus === "ANSWERED");
          return decode(row?.value ?? null);
        };
        const [experiment] = await db.select().from(experiments).where(and(eq(experiments.userId, identity.id), eq(experiments.labCode, lab.code), eq(experiments.labVersion, lab.version))).orderBy(desc(experiments.createdAt)).limit(1);
        const derived = [
          [`${lab.prefix}.${lab.code === "DEC" ? "DELIBERATENESS" : "AWARENESS"}_SHIFT`, ratingShift(latestValue(lab.preMetric.id), latestValue(lab.postMetric.id))],
          [`${lab.prefix}.EQUATION_CONFIDENCE_SHIFT`, ratingShift(latestValue(lab.confidencePre), latestValue(lab.confidencePost))],
        ] as const;
        for (const [code, value] of derived) {
          const status = value === null ? "NA" : "VALUE";
          const evidenceStrength = value === null ? "INSUFFICIENT" : "SUFFICIENT_FOR_LAB";
          await db.insert(measurementValues).values({ id: crypto.randomUUID(), userId: identity.id, experimentId: experiment?.id ?? null, code, value: encode(value), status, evidenceStrength }).onConflictDoUpdate({
            target: [measurementValues.userId, measurementValues.experimentId, measurementValues.code],
            set: { value: encode(value), status, evidenceStrength, calculatedAt: new Date().toISOString() },
          });
        }
      }
      return Response.json(await snapshot(identity, lab));
    }

    if (action === "saveHypothesis") {
      const statement = String(body.statement ?? "").trim();
      const falsification = String(body.falsificationStatement ?? "").trim();
      const confidence = Number(body.learnerConfidence ?? 0);
      const passCore = body.passCore === true;
      if (!passCore && (!statement || !falsification || !Number.isInteger(confidence) || confidence < 1 || confidence > 10)) throw new Error("Complete the working equation, falsification test and confidence rating—or choose to pass these questions.");
      const [previous] = await db.select().from(hypotheses).where(and(eq(hypotheses.userId, identity.id), eq(hypotheses.labCode, lab.code), eq(hypotheses.labVersion, lab.version), eq(hypotheses.status, "ACTIVE"))).orderBy(desc(hypotheses.createdAt)).limit(1);
      const id = crypto.randomUUID();
      if (previous) await db.update(hypotheses).set({ status: "SUPERSEDED", supersededBy: id }).where(eq(hypotheses.id, previous.id));
      await db.insert(hypotheses).values({ id, userId: identity.id, labCode: lab.code, labVersion: lab.version, contentReleaseId: enrolment.contentReleaseId ?? null, statement: passCore ? "" : statement, falsificationStatement: passCore ? "" : falsification, learnerConfidence: passCore ? 0 : confidence });
      await saveResponse(identity, lab, { semanticFieldId: `${lab.prefix}.EQUATION.TEXT`, value: statement, responseStatus: passCore ? "PASS" : "ANSWERED" });
      await saveResponse(identity, lab, { semanticFieldId: `${lab.prefix}.FALSIFICATION.TEXT`, value: falsification, responseStatus: passCore ? "PASS" : "ANSWERED" });
      await saveResponse(identity, lab, { semanticFieldId: lab.confidencePre, value: confidence, responseStatus: passCore ? "PASS" : "ANSWERED" });
      const unlocked = investigationUnlockedAfterSave(5);
      const now = new Date().toISOString();
      await db.update(labEnrollments).set({
        currentInvestigation: Math.max(Math.max(1, Number(enrolment.currentInvestigation ?? 1)), unlocked),
        updatedAt: now,
      }).where(eq(labEnrollments.id, enrolment.id));
      await audit(identity, "LAB_INVESTIGATION_UNLOCKED", "LAB_ENROLLMENT", enrolment.id, {
        labCode: lab.code,
        labVersion: lab.version,
        completedInvestigation: 5,
        unlockedInvestigation: unlocked,
      });
      await audit(identity, previous ? "HYPOTHESIS_REVISED" : "HYPOTHESIS_CREATED", "HYPOTHESIS", id, { labCode: lab.code, labVersion: lab.version });
      return Response.json(await snapshot(identity, lab), { status: 201 });
    }

    if (action === "startExperiment") {
      const required = ["targetPattern", "targetCondition", "pause", "minimumPause", "restartPlan", "failureSignal"];
      for (const key of required) if (!String(body[key] ?? "").trim()) throw new Error("Complete every experiment contract field before starting.");
      const predicted = Number(body.predictedValue ?? -1);
      if (!Number.isFinite(predicted) || predicted < 0 || predicted > 100) throw new Error("Prediction must be between 0% and 100%.");
      const startDate = String(body.startDate ?? todayInZone());
      if (!isIsoDate(startDate)) throw new Error("Choose a valid start date.");
      const plannedEnd = new Date(`${startDate}T00:00:00.000Z`);
      plannedEnd.setUTCDate(plannedEnd.getUTCDate() + 6);
      const plannedEndDate = plannedEnd.toISOString().slice(0, 10);
      const [active] = await db.select({ id: experiments.id }).from(experiments).where(and(eq(experiments.userId, identity.id), eq(experiments.labCode, lab.code), eq(experiments.status, "ACTIVE"))).limit(1);
      if (active) throw new Error(`Finish the active ${lab.shortTitle} experiment before starting another one.`);
      const [hypothesis] = await db.select().from(hypotheses).where(and(eq(hypotheses.userId, identity.id), eq(hypotheses.labCode, lab.code), eq(hypotheses.status, "ACTIVE"))).orderBy(desc(hypotheses.createdAt)).limit(1);
      if (!hypothesis) throw new Error("Write your working equation before starting the experiment.");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const [profile] = await db.select().from(learners).where(eq(learners.userId, identity.id)).limit(1);
      await db.insert(experiments).values({
        id,
        userId: identity.id,
        labCode: lab.code,
        labVersion: lab.version,
        contentReleaseId: enrolment.contentReleaseId ?? null,
        deliveryEdition: profile?.deliveryEdition ?? "school",
        experimentProtocol: lab.code === "DEC" ? "DECISION_PAUSE" : "SPENDING_PAUSE",
        protocolVersion: "1",
        hypothesisId: hypothesis.id,
        targetPattern: String(body.targetPattern),
        targetCondition: String(body.targetCondition),
        alternativeBehaviour: String(body.pause),
        expectedReward: String(body.expectedValue ?? "What changes when I pause"),
        witness: String(body.witness ?? "") || null,
        restartPlan: String(body.restartPlan),
        minimumVersion: String(body.minimumPause),
        failureSignal: String(body.failureSignal),
        impactDomains: encode(Array.isArray(body.impactDomains) ? body.impactDomains : []),
        predictedValue: predicted,
        startDate,
        plannedEndDate,
      });
      const selectedDomains = Array.isArray(body.impactDomains) ? body.impactDomains : [];
      await db.insert(measurementValues).values({
        id: crypto.randomUUID(),
        userId: identity.id,
        experimentId: id,
        code: `${lab.prefix}.BEI05`,
        value: encode({ domains: selectedDomains, count: selectedDomains.length, total: 6 }),
        status: "VALUE",
        evidenceStrength: "DESCRIPTIVE",
      });
      await db.insert(experimentParameterVersions).values({
        id: crypto.randomUUID(), experimentId: id, userId: identity.id, version: 1, effectiveFrom: `${startDate}T00:00:00.000Z`,
        targetCondition: String(body.targetCondition), alternativeBehaviour: String(body.pause), expectedReward: String(body.expectedValue ?? "What changes when I pause"),
        restartPlan: String(body.restartPlan), minimumVersion: String(body.minimumPause), failureSignal: String(body.failureSignal), changeReason: "EXPERIMENT_STARTED",
      });
      await db.update(labEnrollments).set({ status: "EXPERIMENT_ACTIVE", currentInvestigation: 7, phaseACompletedAt: now, experimentStartedAt: now, updatedAt: now }).where(eq(labEnrollments.id, enrolment.id));
      await audit(identity, "EXPERIMENT_STARTED", "EXPERIMENT", id, { labCode: lab.code, labVersion: lab.version, predicted, plannedDays: 7 });
      await pilot(identity, lab, "EXPERIMENT_STARTED", "EXPERIMENT", id, { predicted, plannedDays: 7 });
      return Response.json(await snapshot(identity, lab), { status: 201 });
    }

    if (action === "saveEvent") {
      const experimentId = String(body.experimentId ?? "");
      const dayNumber = Number(body.dayNumber ?? 0);
      const [experiment] = await db.select().from(experiments).where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id), eq(experiments.labCode, lab.code), eq(experiments.labVersion, lab.version))).limit(1);
      if (!experiment || experiment.status !== "ACTIVE") throw new Error("The active experiment could not be found.");
      const [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, identity.id)).limit(1);
      const today = todayInZone(preference?.timezone ?? "Africa/Johannesburg");
      const unlocked = Math.min(7, calendarDay(experiment.startDate, today));
      if (dayNumber < 1 || dayNumber > 7 || dayNumber > unlocked) throw new Error("That day has not been experienced yet. Future experiment days stay locked.");
      const opportunity = body.opportunity === true;
      const pauseCompleted = opportunity ? body.pauseCompleted === true : false;
      const details = body.details && typeof body.details === "object" ? body.details as Record<string, unknown> : {};
      if (opportunity) {
        for (const [key] of lab.experiment.eventFields) if (!String(details[key] ?? "").trim()) throw new Error("Complete the details for this experienced opportunity.");
      }
      const occurredDate = new Date(`${experiment.startDate}T12:00:00.000Z`);
      occurredDate.setUTCDate(occurredDate.getUTCDate() + dayNumber - 1);
      const [existing] = await db.select().from(experimentEvents).where(and(eq(experimentEvents.experimentId, experimentId), eq(experimentEvents.dayNumber, dayNumber))).limit(1);
      const id = existing?.id ?? crypto.randomUUID();
      await db.insert(experimentEvents).values({
        id, experimentId, userId: identity.id, dayNumber, occurredAt: occurredDate.toISOString(), eligibleOpportunity: opportunity,
        targetConditionOccurred: opportunity, alternativeUsed: pauseCompleted, notes: opportunity ? encode(details) : encode({ noOpportunity: true }),
      }).onConflictDoUpdate({
        target: [experimentEvents.experimentId, experimentEvents.dayNumber],
        set: { occurredAt: occurredDate.toISOString(), eligibleOpportunity: opportunity, targetConditionOccurred: opportunity, alternativeUsed: pauseCompleted, notes: opportunity ? encode(details) : encode({ noOpportunity: true }), recordedAt: new Date().toISOString() },
      });
      await db.update(evidenceRecords).set({ status: "SUPERSEDED" }).where(eq(evidenceRecords.sourceObjectId, id));
      await db.insert(evidenceRecords).values({
        id: crypto.randomUUID(), userId: identity.id, labCode: lab.code, labVersion: lab.version, contentReleaseId: experiment.contentReleaseId ?? null, investigationId: `${lab.prefix}.I7`, semanticFieldId: `${lab.prefix}.EXPERIMENT.DAY.${dayNumber}`,
        sourceObjectType: "EXPERIMENT_EVENT", sourceObjectId: id, provenance: "OBS", valueType: "STRUCTURED", value: encode({ opportunity, pauseCompleted, details }), sensitivity: "P3", occurredAt: occurredDate.toISOString(),
      });
      await calculate(identity, lab, experimentId, experiment.predictedValue);
      await audit(identity, existing ? "EXPERIMENT_EVENT_CORRECTED" : "EXPERIMENT_EVENT_RECORDED", "EXPERIMENT_EVENT", id, { labCode: lab.code, dayNumber, opportunity, pauseCompleted });
      return Response.json(await snapshot(identity, lab));
    }

    if (action === "saveCheckpoint") {
      const experimentId = String(body.experimentId ?? "");
      const [experiment] = await db.select().from(experiments).where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id), eq(experiments.labCode, lab.code), eq(experiments.labVersion, lab.version))).limit(1);
      if (!experiment || experiment.status !== "ACTIVE") throw new Error("The active experiment could not be found.");
      const [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, identity.id)).limit(1);
      if (calendarDay(experiment.startDate, todayInZone(preference?.timezone ?? "Africa/Johannesburg")) < 3) throw new Error("The Day 3 checkpoint opens after three calendar days have been experienced.");
      const surprise = String(body.surprise ?? "").trim();
      const observability = String(body.observability ?? "").trim();
      const evidenceSupport = String(body.evidenceSupport ?? "").trim();
      const evidenceChallenge = String(body.evidenceChallenge ?? "").trim();
      if (!surprise || !observability || !evidenceSupport || !evidenceChallenge) throw new Error("Complete the Day 3 calibration before saving.");
      const [existing] = await db.select({ id: experimentCheckpoints.id }).from(experimentCheckpoints).where(and(eq(experimentCheckpoints.experimentId, experimentId), eq(experimentCheckpoints.dayNumber, 3))).limit(1);
      if (existing) throw new Error("The Day 3 checkpoint is already recorded. Earlier evidence remains versioned.");
      const decision = body.adjust === true ? "ADJUST" : "KEEP";
      const targetCondition = String(body.targetCondition ?? "").trim() || experiment.targetCondition;
      const pause = String(body.pause ?? "").trim() || experiment.alternativeBehaviour;
      if (decision === "ADJUST" && targetCondition === experiment.targetCondition && pause === experiment.alternativeBehaviour) throw new Error("Name the target-condition or Pause adjustment.");
      const id = crypto.randomUUID();
      await db.insert(experimentCheckpoints).values({ id, experimentId, userId: identity.id, dayNumber: 3, surprise, observability, evidenceSupport, evidenceChallenge, decision, adjustmentSummary: decision === "ADJUST" ? encode({ targetCondition, pause }) : null });
      if (decision === "ADJUST") {
        const version = experiment.parameterVersion + 1;
        await db.insert(experimentParameterVersions).values({
          id: crypto.randomUUID(), experimentId, userId: identity.id, version, effectiveFrom: new Date().toISOString(), targetCondition, alternativeBehaviour: pause,
          expectedReward: experiment.expectedReward, restartPlan: experiment.restartPlan, minimumVersion: experiment.minimumVersion, failureSignal: experiment.failureSignal, changeReason: "DAY_3_CALIBRATION",
        });
        await db.update(experiments).set({ targetCondition, alternativeBehaviour: pause, parameterVersion: version, updatedAt: new Date().toISOString() }).where(eq(experiments.id, experimentId));
      }
      await audit(identity, "EXPERIMENT_CHECKPOINT_RECORDED", "EXPERIMENT_CHECKPOINT", id, { labCode: lab.code, decision });
      return Response.json(await snapshot(identity, lab));
    }

    if (action === "completeExperiment") {
      const experimentId = String(body.experimentId ?? "");
      const [experiment] = await db.select().from(experiments).where(and(eq(experiments.id, experimentId), eq(experiments.userId, identity.id), eq(experiments.labCode, lab.code), eq(experiments.labVersion, lab.version))).limit(1);
      if (!experiment || experiment.status !== "ACTIVE") throw new Error("The active experiment could not be found.");
      const [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, identity.id)).limit(1);
      if (calendarDay(experiment.startDate, todayInZone(preference?.timezone ?? "Africa/Johannesburg")) < 7) throw new Error("The evidence review opens only after all seven calendar days have been experienced.");
      const eventRows = await db.select().from(experimentEvents).where(and(eq(experimentEvents.userId, identity.id), eq(experimentEvents.experimentId, experimentId)));
      if (eventRows.length < 7) throw new Error("Record an opportunity or no opportunity for every experienced day before closing the experiment.");
      const now = new Date().toISOString();
      await db.update(experiments).set({ status: "COMPLETED", actualEndDate: now.slice(0, 10), updatedAt: now }).where(eq(experiments.id, experimentId));
      await db.update(labEnrollments).set({ status: "IN_PROGRESS", currentInvestigation: 8, updatedAt: now }).where(eq(labEnrollments.id, enrolment.id));
      await calculate(identity, lab, experimentId, experiment.predictedValue);
      await audit(identity, "EXPERIMENT_COMPLETED", "EXPERIMENT", experimentId, { labCode: lab.code, days: 7 });
      await pilot(identity, lab, "EXPERIMENT_COMPLETED", "EXPERIMENT", experimentId, { days: 7 });
      return Response.json(await snapshot(identity, lab));
    }

    if (action === "completeLab") {
      const finalIds = new Set(lab.sections[9].map((field) => field.id));
      const finalRows = await db.select().from(responses).where(and(eq(responses.userId, identity.id), eq(responses.labCode, lab.code), eq(responses.labVersion, lab.version)));
      const completedFields = new Set(finalRows.filter((row) => ["ANSWERED", "PASS"].includes(row.responseStatus) && finalIds.has(row.semanticFieldId)).map((row) => row.semanticFieldId));
      if (completedFields.size !== finalIds.size) throw new Error("Complete or pass every Behaviour Profile reflection before finishing the Lab.");
      const now = new Date().toISOString();
      await db.update(labEnrollments).set({ status: "COMPLETED", currentInvestigation: 9, completedAt: now, updatedAt: now }).where(eq(labEnrollments.id, enrolment.id));
      await audit(identity, "LAB_COMPLETED", "LAB_ENROLLMENT", enrolment.id, { labCode: lab.code, labVersion: lab.version });
      await pilot(identity, lab, `${lab.code}_LAB_COMPLETED`, "LAB_ENROLLMENT", enrolment.id);
      return Response.json(await snapshot(identity, lab));
    }

    throw new Error("That Lab action is not supported.");
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function GET(request: Request) {
  return withSupabaseRequest(() => getHandler(request));
}

export async function POST(request: Request) {
  return withSupabaseRequest(() => postHandler(request));
}
