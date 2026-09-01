import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  auditEvents,
  cohortMembers,
  experimentEvents,
  experiments,
  facilitatorNotes,
  labAssignments,
  labEnrollments,
  learners,
  pilotCohorts,
  pilotEvents,
  roleAssignments,
  safeguardingCases,
} from "../../../db/schema";
import {
  AccessError,
  getRoles,
  hasRole,
  identityFrom,
  normalizeEmail,
  requireAnyRole,
  requireRole,
  STAFF_ROLES,
} from "../../../lib/bis-access";
import type { Identity, StaffRole } from "../../../lib/bis-access";
import { LAB_VERSION } from "../../../lib/habit-lab";

const SUPPORTED_LAB_VERSIONS = [LAB_VERSION] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "The restricted operation could not be completed." },
    { status: 400 },
  );
}

async function staffAudit(
  identity: Identity,
  action: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, unknown> = {},
) {
  const db = getDb();
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorId: identity.id,
    actorType: "STAFF",
    action,
    objectType,
    objectId,
    metadata: JSON.stringify(metadata),
  });
  await db.insert(pilotEvents).values({
    id: crypto.randomUUID(),
    userId: identity.id,
    name: action,
    labVersion: LAB_VERSION,
    objectType,
    objectId,
    metadata: JSON.stringify(metadata),
  });
}

async function assignedCohort(identity: Identity, cohortId: string) {
  const [cohort] = await getDb()
    .select()
    .from(pilotCohorts)
    .where(and(
      eq(pilotCohorts.id, cohortId),
      eq(pilotCohorts.facilitatorEmail, identity.email),
      eq(pilotCohorts.status, "ACTIVE"),
    ))
    .limit(1);
  if (!cohort) throw new AccessError("This cohort is not assigned to your facilitator account.");
  return cohort;
}

async function learnerByEmail(email: string) {
  const [learner] = await getDb()
    .select()
    .from(learners)
    .where(eq(learners.email, normalizeEmail(email)))
    .limit(1);
  if (!learner) throw new Error("That learner must sign in and complete setup before being assigned.");
  return learner;
}

async function assignLab(identity: Identity, learner: typeof learners.$inferSelect, labVersion: string) {
  if (!SUPPORTED_LAB_VERSIONS.includes(labVersion as typeof LAB_VERSION)) {
    throw new Error("Only a canonical supported Habit Lab version can be assigned.");
  }
  const db = getDb();
  const now = new Date().toISOString();
  const [existingEnrolment] = await db
    .select()
    .from(labEnrollments)
    .where(and(eq(labEnrollments.userId, learner.userId), eq(labEnrollments.labCode, "HAB")))
    .orderBy(desc(labEnrollments.updatedAt))
    .limit(1);
  await db
    .update(labAssignments)
    .set({ status: "REVOKED", revokedAt: now })
    .where(and(
      eq(labAssignments.learnerUserId, learner.userId),
      eq(labAssignments.labCode, "HAB"),
      eq(labAssignments.status, "ACTIVE"),
    ));
  await db
    .insert(labAssignments)
    .values({
      id: crypto.randomUUID(),
      learnerUserId: learner.userId,
      learnerEmail: normalizeEmail(learner.email),
      labCode: "HAB",
      labVersion,
      assignedBy: identity.id,
    })
    .onConflictDoUpdate({
      target: [labAssignments.learnerUserId, labAssignments.labCode, labAssignments.labVersion],
      set: { status: "ACTIVE", assignedBy: identity.id, assignedAt: now, revokedAt: null },
    });
  await db
    .insert(labEnrollments)
    .values({
      id: crypto.randomUUID(),
      userId: learner.userId,
      labCode: "HAB",
      labVersion,
      status: existingEnrolment?.status ?? "IN_PROGRESS",
      currentInvestigation: existingEnrolment?.currentInvestigation ?? 0,
      startedAt: existingEnrolment?.startedAt ?? now,
      phaseACompletedAt: existingEnrolment?.phaseACompletedAt ?? null,
      experimentStartedAt: existingEnrolment?.experimentStartedAt ?? null,
      completedAt: existingEnrolment?.completedAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [labEnrollments.userId, labEnrollments.labCode, labEnrollments.labVersion],
      set: { updatedAt: now },
    });
}

async function progressRows(userIds: string[]) {
  if (userIds.length === 0) return [];
  const db = getDb();
  const learnerRows = await db
    .select({
      userId: learners.userId,
      email: learners.email,
      displayName: learners.displayName,
      mode: learners.mode,
      status: learners.status,
    })
    .from(learners)
    .where(inArray(learners.userId, userIds));
  const enrolments = await db
    .select({
      id: labEnrollments.id,
      userId: labEnrollments.userId,
      labVersion: labEnrollments.labVersion,
      status: labEnrollments.status,
      currentInvestigation: labEnrollments.currentInvestigation,
      startedAt: labEnrollments.startedAt,
      updatedAt: labEnrollments.updatedAt,
      completedAt: labEnrollments.completedAt,
    })
    .from(labEnrollments)
    .where(inArray(labEnrollments.userId, userIds))
    .orderBy(desc(labEnrollments.updatedAt));
  const experimentRows = await db
    .select({
      id: experiments.id,
      userId: experiments.userId,
      status: experiments.status,
      startDate: experiments.startDate,
      plannedEndDate: experiments.plannedEndDate,
      actualEndDate: experiments.actualEndDate,
      minimumEvidenceThreshold: experiments.minimumEvidenceThreshold,
    })
    .from(experiments)
    .where(inArray(experiments.userId, userIds))
    .orderBy(desc(experiments.createdAt));
  const eventRows = await db
    .select({
      userId: experimentEvents.userId,
      experimentId: experimentEvents.experimentId,
      eligibleOpportunity: experimentEvents.eligibleOpportunity,
      recordedAt: experimentEvents.recordedAt,
    })
    .from(experimentEvents)
    .where(inArray(experimentEvents.userId, userIds));

  return learnerRows.map((learner) => {
    const enrolment = enrolments.find((item) => item.userId === learner.userId);
    const experiment = experimentRows.find((item) => item.userId === learner.userId);
    const events = experiment ? eventRows.filter((event) => event.experimentId === experiment.id) : [];
    const opportunityCount = events.filter((event) => event.eligibleOpportunity).length;
    const lastEventAt = events.map((event) => event.recordedAt).sort().at(-1);
    return {
      ...learner,
      enrolment: enrolment ?? null,
      experiment: experiment ? {
        status: experiment.status,
        startDate: experiment.startDate,
        plannedEndDate: experiment.plannedEndDate,
        actualEndDate: experiment.actualEndDate,
        minimumEvidenceThreshold: experiment.minimumEvidenceThreshold,
        recordedDays: events.length,
        opportunityCount,
      } : null,
      lastActivityAt: lastEventAt ?? enrolment?.updatedAt ?? null,
    };
  });
}

async function adminSnapshot() {
  const db = getDb();
  const learnerRows = await db.select({ userId: learners.userId }).from(learners);
  const progress = await progressRows(learnerRows.map((item) => item.userId));
  const assignments = await db
    .select({
      id: roleAssignments.id,
      principalEmail: roleAssignments.principalEmail,
      role: roleAssignments.role,
      scopeType: roleAssignments.scopeType,
      scopeId: roleAssignments.scopeId,
      status: roleAssignments.status,
      assignedAt: roleAssignments.assignedAt,
      revokedAt: roleAssignments.revokedAt,
    })
    .from(roleAssignments)
    .orderBy(asc(roleAssignments.principalEmail), asc(roleAssignments.role));
  const cohorts = await db.select().from(pilotCohorts).orderBy(desc(pilotCohorts.createdAt));
  const members = await db
    .select({ cohortId: cohortMembers.cohortId, status: cohortMembers.status })
    .from(cohortMembers);
  const labRows = await db.select().from(labAssignments).orderBy(desc(labAssignments.assignedAt));
  const [openCases] = await db
    .select({ value: count() })
    .from(safeguardingCases)
    .where(sql`${safeguardingCases.status} != 'RESOLVED'`);
  const opportunityBands = { none: 0, one: 0, two: 0, threePlus: 0 };
  for (const learner of progress) {
    const opportunities = learner.experiment?.opportunityCount ?? 0;
    if (opportunities === 0) opportunityBands.none += 1;
    else if (opportunities === 1) opportunityBands.one += 1;
    else if (opportunities === 2) opportunityBands.two += 1;
    else opportunityBands.threePlus += 1;
  }
  return {
    metrics: {
      learners: progress.length,
      completed: progress.filter((item) => item.enrolment?.status === "COMPLETED").length,
      experimentActive: progress.filter((item) => item.experiment?.status === "ACTIVE").length,
      openSafeguardingCases: Number(openCases?.value ?? 0),
      opportunityBands,
    },
    learners: progress,
    roleAssignments: assignments,
    cohorts: cohorts.map((cohort) => ({
      ...cohort,
      memberCount: members.filter((member) => member.cohortId === cohort.id && member.status === "ACTIVE").length,
    })),
    labAssignments: labRows,
    supportedLabVersions: SUPPORTED_LAB_VERSIONS,
  };
}

async function facilitatorSnapshot(identity: Identity) {
  const db = getDb();
  const cohorts = await db
    .select()
    .from(pilotCohorts)
    .where(and(
      eq(pilotCohorts.facilitatorEmail, identity.email),
      eq(pilotCohorts.status, "ACTIVE"),
    ))
    .orderBy(asc(pilotCohorts.name));
  const cohortIds = cohorts.map((cohort) => cohort.id);
  if (cohortIds.length === 0) return { cohorts: [], learners: [], notes: [], referrals: [] };
  const members = await db
    .select()
    .from(cohortMembers)
    .where(and(inArray(cohortMembers.cohortId, cohortIds), eq(cohortMembers.status, "ACTIVE")));
  const progress = await progressRows([...new Set(members.map((member) => member.learnerUserId))]);
  const notes = await db
    .select()
    .from(facilitatorNotes)
    .where(inArray(facilitatorNotes.cohortId, cohortIds))
    .orderBy(desc(facilitatorNotes.createdAt));
  const referrals = await db
    .select({
      id: safeguardingCases.id,
      learnerUserId: safeguardingCases.learnerUserId,
      cohortId: safeguardingCases.cohortId,
      category: safeguardingCases.category,
      status: safeguardingCases.status,
      severity: safeguardingCases.severity,
      openedAt: safeguardingCases.openedAt,
      acknowledgedAt: safeguardingCases.acknowledgedAt,
      resolvedAt: safeguardingCases.resolvedAt,
    })
    .from(safeguardingCases)
    .where(eq(safeguardingCases.openedBy, identity.id))
    .orderBy(desc(safeguardingCases.openedAt));
  return {
    cohorts: cohorts.map((cohort) => ({
      ...cohort,
      memberIds: members.filter((member) => member.cohortId === cohort.id).map((member) => member.learnerUserId),
    })),
    learners: progress,
    notes,
    referrals,
  };
}

async function safeguardingSnapshot() {
  const db = getDb();
  const cases = await db.select().from(safeguardingCases).orderBy(desc(safeguardingCases.openedAt));
  const userIds = [...new Set(cases.map((item) => item.learnerUserId))];
  const learnerRows = userIds.length
    ? await db
        .select({ userId: learners.userId, displayName: learners.displayName, email: learners.email })
        .from(learners)
        .where(inArray(learners.userId, userIds))
    : [];
  return {
    cases: cases.map((item) => ({
      ...item,
      learner: learnerRows.find((learner) => learner.userId === item.learnerUserId) ?? {
        userId: item.learnerUserId,
        displayName: "Learner",
        email: item.learnerEmail,
      },
    })),
  };
}

async function staffSnapshot(identity: Identity, roles: string[]) {
  return {
    identity,
    roles,
    privacyBoundary: {
      facilitatorCanSee: ["learner identity", "lab progress", "experiment completion counts", "staff-authored support notes"],
      facilitatorCannotSee: ["learner answers", "hypothesis wording", "experiment notes", "Companion conversations", "memory items"],
      safeguardingAccess: "Case details require the explicit SAFEGUARDING_OFFICER role.",
    },
    admin: hasRole(roles, "SYSTEM_ADMIN") ? await adminSnapshot() : null,
    facilitator: hasRole(roles, "FACILITATOR") ? await facilitatorSnapshot(identity) : null,
    safeguarding: hasRole(roles, "SAFEGUARDING_OFFICER") ? await safeguardingSnapshot() : null,
  };
}

export async function GET(request: Request) {
  const identity = identityFrom(request);
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const roles = await getRoles(identity);
    requireAnyRole(roles, [...STAFF_ROLES]);
    return Response.json(await staffSnapshot(identity, roles));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const identity = identityFrom(request);
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const db = getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const roles = await getRoles(identity);
    requireAnyRole(roles, [...STAFF_ROLES]);

    if (action === "assignRole") {
      requireRole(roles, "SYSTEM_ADMIN");
      const principalEmail = normalizeEmail(String(body.email ?? ""));
      const role = String(body.role ?? "") as StaffRole;
      if (!EMAIL_PATTERN.test(principalEmail)) throw new Error("Enter a valid staff email address.");
      if (!STAFF_ROLES.includes(role)) throw new Error("Choose a supported staff role.");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .insert(roleAssignments)
        .values({ id, principalEmail, role, scopeType: "GLOBAL", scopeId: "GLOBAL", assignedBy: identity.id })
        .onConflictDoUpdate({
          target: [roleAssignments.principalEmail, roleAssignments.role, roleAssignments.scopeType, roleAssignments.scopeId],
          set: { status: "ACTIVE", assignedBy: identity.id, assignedAt: now, revokedAt: null },
        });
      const [assignment] = await db
        .select({ id: roleAssignments.id })
        .from(roleAssignments)
        .where(and(eq(roleAssignments.principalEmail, principalEmail), eq(roleAssignments.role, role)))
        .limit(1);
      await staffAudit(identity, "STAFF_ROLE_ASSIGNED", "ROLE_ASSIGNMENT", assignment?.id ?? id, { role, principalEmail });
      return Response.json(await staffSnapshot(identity, await getRoles(identity)), { status: 201 });
    }

    if (action === "revokeRole") {
      requireRole(roles, "SYSTEM_ADMIN");
      const assignmentId = String(body.assignmentId ?? "");
      const [assignment] = await db
        .select()
        .from(roleAssignments)
        .where(eq(roleAssignments.id, assignmentId))
        .limit(1);
      if (!assignment || assignment.status !== "ACTIVE") throw new Error("That active role assignment was not found.");
      if (assignment.role === "SYSTEM_ADMIN") {
        const [admins] = await db
          .select({ value: count() })
          .from(roleAssignments)
          .where(and(eq(roleAssignments.role, "SYSTEM_ADMIN"), eq(roleAssignments.status, "ACTIVE")));
        if (Number(admins?.value ?? 0) <= 1) throw new Error("The final system administrator cannot be revoked.");
      }
      const now = new Date().toISOString();
      await db.update(roleAssignments).set({ status: "REVOKED", revokedAt: now }).where(eq(roleAssignments.id, assignmentId));
      await staffAudit(identity, "STAFF_ROLE_REVOKED", "ROLE_ASSIGNMENT", assignmentId, { role: assignment.role, principalEmail: assignment.principalEmail });
      return Response.json(await staffSnapshot(identity, await getRoles(identity)));
    }

    if (action === "createCohort") {
      requireRole(roles, "SYSTEM_ADMIN");
      const name = String(body.name ?? "").trim();
      const facilitatorEmail = normalizeEmail(String(body.facilitatorEmail ?? ""));
      const labVersion = String(body.labVersion ?? LAB_VERSION);
      if (name.length < 3 || name.length > 100) throw new Error("Use a cohort name between 3 and 100 characters.");
      if (!EMAIL_PATTERN.test(facilitatorEmail)) throw new Error("Enter a valid facilitator email.");
      if (!SUPPORTED_LAB_VERSIONS.includes(labVersion as typeof LAB_VERSION)) throw new Error("Choose a supported canonical lab version.");
      const [facilitatorRole] = await db
        .select({ id: roleAssignments.id })
        .from(roleAssignments)
        .where(and(
          eq(roleAssignments.principalEmail, facilitatorEmail),
          eq(roleAssignments.role, "FACILITATOR"),
          eq(roleAssignments.status, "ACTIVE"),
        ))
        .limit(1);
      if (!facilitatorRole) throw new Error("Assign the facilitator role to this email before creating the cohort.");
      const id = crypto.randomUUID();
      await db.insert(pilotCohorts).values({
        id,
        name,
        labVersion,
        facilitatorEmail,
        startsOn: String(body.startsOn ?? "") || null,
        endsOn: String(body.endsOn ?? "") || null,
        createdBy: identity.id,
      });
      await staffAudit(identity, "PILOT_COHORT_CREATED", "PILOT_COHORT", id, { labVersion, facilitatorEmail });
      return Response.json(await staffSnapshot(identity, roles), { status: 201 });
    }

    if (action === "addCohortMember") {
      requireRole(roles, "SYSTEM_ADMIN");
      const cohortId = String(body.cohortId ?? "");
      const [cohort] = await db.select().from(pilotCohorts).where(eq(pilotCohorts.id, cohortId)).limit(1);
      if (!cohort || cohort.status !== "ACTIVE") throw new Error("Choose an active pilot cohort.");
      const learner = await learnerByEmail(String(body.learnerEmail ?? ""));
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .insert(cohortMembers)
        .values({
          id,
          cohortId,
          learnerUserId: learner.userId,
          learnerEmail: normalizeEmail(learner.email),
          addedBy: identity.id,
        })
        .onConflictDoUpdate({
          target: [cohortMembers.cohortId, cohortMembers.learnerUserId],
          set: { status: "ACTIVE", addedBy: identity.id, joinedAt: now, removedAt: null },
        });
      await assignLab(identity, learner, cohort.labVersion);
      await staffAudit(identity, "COHORT_MEMBER_ADDED", "PILOT_COHORT", cohortId, { learnerUserId: learner.userId, labVersion: cohort.labVersion });
      return Response.json(await staffSnapshot(identity, roles), { status: 201 });
    }

    if (action === "assignLabVersion") {
      requireRole(roles, "SYSTEM_ADMIN");
      const learner = await learnerByEmail(String(body.learnerEmail ?? ""));
      const labVersion = String(body.labVersion ?? "");
      await assignLab(identity, learner, labVersion);
      await staffAudit(identity, "LAB_VERSION_ASSIGNED", "LEARNER", learner.userId, { labCode: "HAB", labVersion });
      return Response.json(await staffSnapshot(identity, roles));
    }

    if (action === "addFacilitatorNote") {
      requireRole(roles, "FACILITATOR");
      const cohortId = String(body.cohortId ?? "");
      const learnerUserId = String(body.learnerUserId ?? "");
      const category = String(body.category ?? "GENERAL");
      const content = String(body.content ?? "").trim();
      if (!["CHECK_IN", "ATTENDANCE", "EXPERIMENT_SUPPORT", "GENERAL"].includes(category)) throw new Error("Choose a supported note category.");
      if (!content || content.length > 1000) throw new Error("Use a support note between 1 and 1,000 characters.");
      await assignedCohort(identity, cohortId);
      const [member] = await db
        .select({ id: cohortMembers.id })
        .from(cohortMembers)
        .where(and(
          eq(cohortMembers.cohortId, cohortId),
          eq(cohortMembers.learnerUserId, learnerUserId),
          eq(cohortMembers.status, "ACTIVE"),
        ))
        .limit(1);
      if (!member) throw new Error("Choose an active learner in your assigned cohort.");
      const id = crypto.randomUUID();
      await db.insert(facilitatorNotes).values({
        id,
        cohortId,
        learnerUserId,
        authorId: identity.id,
        authorEmail: identity.email,
        category,
        content,
      });
      await staffAudit(identity, "FACILITATOR_NOTE_CREATED", "FACILITATOR_NOTE", id, { cohortId, learnerUserId, category });
      return Response.json(await staffSnapshot(identity, roles), { status: 201 });
    }

    if (action === "openSafeguardingCase") {
      requireRole(roles, "FACILITATOR");
      const cohortId = String(body.cohortId ?? "");
      const learnerUserId = String(body.learnerUserId ?? "");
      const category = String(body.category ?? "");
      const summary = String(body.summary ?? "").trim();
      if (!["WELLBEING_CONCERN", "DISCLOSURE", "IMMEDIATE_SAFETY", "OTHER"].includes(category)) throw new Error("Choose a safeguarding referral category.");
      if (!summary || summary.length > 1200) throw new Error("Use a factual referral summary between 1 and 1,200 characters.");
      await assignedCohort(identity, cohortId);
      const [member] = await db
        .select({ learnerEmail: cohortMembers.learnerEmail })
        .from(cohortMembers)
        .where(and(
          eq(cohortMembers.cohortId, cohortId),
          eq(cohortMembers.learnerUserId, learnerUserId),
          eq(cohortMembers.status, "ACTIVE"),
        ))
        .limit(1);
      if (!member) throw new Error("Choose an active learner in your assigned cohort.");
      const id = crypto.randomUUID();
      await db.insert(safeguardingCases).values({
        id,
        learnerUserId,
        learnerEmail: member.learnerEmail,
        cohortId,
        sourceType: "FACILITATOR_OBSERVATION",
        category,
        summary,
        openedBy: identity.id,
        openedByEmail: identity.email,
      });
      await staffAudit(identity, "SAFEGUARDING_CASE_OPENED", "SAFEGUARDING_CASE", id, { cohortId, learnerUserId, category });
      return Response.json(await staffSnapshot(identity, roles), { status: 201 });
    }

    if (action === "acknowledgeSafeguardingCase") {
      requireRole(roles, "SAFEGUARDING_OFFICER");
      const caseId = String(body.caseId ?? "");
      const severity = String(body.severity ?? "");
      if (!["LOW", "MODERATE", "HIGH", "IMMEDIATE"].includes(severity)) throw new Error("Choose a triage level.");
      const [caseRow] = await db.select({ id: safeguardingCases.id, status: safeguardingCases.status }).from(safeguardingCases).where(eq(safeguardingCases.id, caseId)).limit(1);
      if (!caseRow || caseRow.status === "RESOLVED") throw new Error("Choose an unresolved safeguarding case.");
      const now = new Date().toISOString();
      await db.update(safeguardingCases).set({
        status: "ACKNOWLEDGED",
        severity,
        assignedToEmail: identity.email,
        acknowledgedAt: now,
        acknowledgedBy: identity.id,
      }).where(eq(safeguardingCases.id, caseId));
      await staffAudit(identity, "SAFEGUARDING_CASE_ACKNOWLEDGED", "SAFEGUARDING_CASE", caseId, { severity });
      return Response.json(await staffSnapshot(identity, roles));
    }

    if (action === "resolveSafeguardingCase") {
      requireRole(roles, "SAFEGUARDING_OFFICER");
      const caseId = String(body.caseId ?? "");
      const resolutionNote = String(body.resolutionNote ?? "").trim();
      if (!resolutionNote || resolutionNote.length > 1200) throw new Error("Record a concise resolution note of up to 1,200 characters.");
      const [caseRow] = await db.select({ id: safeguardingCases.id, status: safeguardingCases.status }).from(safeguardingCases).where(eq(safeguardingCases.id, caseId)).limit(1);
      if (!caseRow || caseRow.status === "RESOLVED") throw new Error("Choose an unresolved safeguarding case.");
      const now = new Date().toISOString();
      await db.update(safeguardingCases).set({
        status: "RESOLVED",
        resolvedAt: now,
        resolvedBy: identity.id,
        resolutionNote,
      }).where(eq(safeguardingCases.id, caseId));
      await staffAudit(identity, "SAFEGUARDING_CASE_RESOLVED", "SAFEGUARDING_CASE", caseId);
      return Response.json(await staffSnapshot(identity, roles));
    }

    return Response.json({ error: "Unknown restricted operation." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
