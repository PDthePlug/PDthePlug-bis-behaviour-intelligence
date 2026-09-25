import { and, eq, or } from "../db/query";
import { getDb } from "../db";
import { learners, roleAssignments } from "../db/schema";
import { requestSupabaseClient } from "./supabase/server";

export const STAFF_ROLES = [
  "SYSTEM_ADMIN",
  "FACILITATOR",
  "SAFEGUARDING_OFFICER",
  "SPONSOR_VIEWER",
  "PROGRAMME_OWNER",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type Identity = { id: string; authUserId: string; email: string; displayName: string };

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

export async function identityFrom(): Promise<Identity | null> {
  const supabase = requestSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  const email = user?.email ? normalizeEmail(user.email) : null;
  if (error || !user || !email) return null;

  const { data: profile, error: profileError } = await supabase
    .from("learners")
    .select("user_id,display_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  return {
    id: profile?.user_id ?? user.id,
    authUserId: user.id,
    email,
    displayName: profile?.display_name ?? metadataName ?? email.split("@")[0],
  };
}

async function bootstrapInitialAdmin() {
  const supabase = requestSupabaseClient();
  const { error } = await supabase.rpc("bootstrap_initial_admin");
  if (error) throw new Error(error.message);
}

export async function getRoles(identity: Identity, bootstrap = true) {
  const db = getDb();
  if (bootstrap) await bootstrapInitialAdmin();

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
