import { and, asc, eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { learners, roleAssignments } from "../db/schema";

export const STAFF_ROLES = [
  "SYSTEM_ADMIN",
  "FACILITATOR",
  "SAFEGUARDING_OFFICER",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type Identity = { id: string; email: string; displayName: string };

export class AccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function identityFrom(request: Request): Identity | null {
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
      // Fall back to the verified email local-part.
    }
  }
  return { id, email: normalizeEmail(email), displayName };
}

async function bootstrapInitialAdmin(identity: Identity) {
  const db = getDb();
  const [activeAdmin] = await db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.role, "SYSTEM_ADMIN"), eq(roleAssignments.status, "ACTIVE")))
    .limit(1);
  if (activeAdmin) return;

  const [firstLearner] = await db
    .select({ userId: learners.userId, email: learners.email })
    .from(learners)
    .orderBy(asc(learners.createdAt))
    .limit(1);
  if (!firstLearner) return;
  if (firstLearner.userId !== identity.id && normalizeEmail(firstLearner.email) !== identity.email) return;

  await db
    .insert(roleAssignments)
    .values({
      id: crypto.randomUUID(),
      principalEmail: identity.email,
      userId: identity.id,
      role: "SYSTEM_ADMIN",
      assignedBy: identity.id,
    })
    .onConflictDoUpdate({
      target: [
        roleAssignments.principalEmail,
        roleAssignments.role,
        roleAssignments.scopeType,
        roleAssignments.scopeId,
      ],
      set: { userId: identity.id, status: "ACTIVE", revokedAt: null },
    });
}

export async function getRoles(identity: Identity, bootstrap = true) {
  const db = getDb();
  if (bootstrap) await bootstrapInitialAdmin(identity);

  await db
    .update(roleAssignments)
    .set({ userId: identity.id })
    .where(and(
      eq(roleAssignments.principalEmail, identity.email),
      eq(roleAssignments.status, "ACTIVE"),
    ));

  const assignments = await db
    .select({ role: roleAssignments.role })
    .from(roleAssignments)
    .where(and(
      eq(roleAssignments.status, "ACTIVE"),
      or(
        eq(roleAssignments.userId, identity.id),
        eq(roleAssignments.principalEmail, identity.email),
      ),
    ));
  const [profile] = await db
    .select({ userId: learners.userId })
    .from(learners)
    .where(eq(learners.userId, identity.id))
    .limit(1);
  const roles = new Set(assignments.map((assignment) => assignment.role));
  if (profile) roles.add("LEARNER");
  return [...roles];
}

export function hasRole(roles: string[], role: StaffRole) {
  return roles.includes(role);
}

export function requireRole(roles: string[], role: StaffRole) {
  if (!hasRole(roles, role)) {
    throw new AccessError("You do not have access to this restricted operation.");
  }
}

export function requireAnyRole(roles: string[], allowed: StaffRole[]) {
  if (!allowed.some((role) => hasRole(roles, role))) {
    throw new AccessError("You do not have access to the operations workspace.");
  }
}
