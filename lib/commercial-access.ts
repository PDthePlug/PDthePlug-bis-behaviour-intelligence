import { AccessError, getRoles, identityFrom } from "./bis-access";
import type { Identity } from "./bis-access";

export const COMMERCIAL_ROLES = [
  "COMMERCIAL_ADMIN",
  "COMMERCIAL_LEAD",
  "COMMERCIAL_RESEARCH",
  "COMMERCIAL_READ_ONLY",
] as const;

export type CommercialRole = (typeof COMMERCIAL_ROLES)[number];

export function hasCommercialAccess(roles: string[]) {
  return roles.includes("SYSTEM_ADMIN") || COMMERCIAL_ROLES.some((role) => roles.includes(role));
}

export function canWriteCommercial(roles: string[]) {
  return (
    roles.includes("SYSTEM_ADMIN") ||
    roles.includes("COMMERCIAL_ADMIN") ||
    roles.includes("COMMERCIAL_LEAD") ||
    roles.includes("COMMERCIAL_RESEARCH")
  );
}

export function canAdminCommercial(roles: string[]) {
  return roles.includes("SYSTEM_ADMIN") || roles.includes("COMMERCIAL_ADMIN");
}

export async function requireCommercialIdentity(): Promise<{ identity: Identity; roles: string[] }> {
  const identity = await identityFrom();
  if (!identity) throw new AccessError("Sign in is required.", 401);
  const roles = await getRoles(identity);
  if (!hasCommercialAccess(roles)) {
    throw new AccessError("You do not have access to the BIS Commercial Workspace.", 403);
  }
  return { identity, roles };
}
