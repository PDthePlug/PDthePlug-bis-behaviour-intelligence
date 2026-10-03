import { eq } from "@/db/query";
import { getDb, withSupabaseRequest } from "@/db";
import { learners } from "@/db/schema";
import { getRoles, identityFrom } from "@/lib/bis-access";

async function profileSnapshot() {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  const [profile, roles] = await Promise.all([
    getDb()
      .select({
        displayName: learners.displayName,
        ageBand: learners.ageBand,
        mode: learners.mode,
        deliveryEdition: learners.deliveryEdition,
      })
      .from(learners)
      .where(eq(learners.userId, identity.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getRoles(identity),
  ]);

  return Response.json({
    identity: {
      email: identity.email,
      displayName: identity.displayName,
    },
    roles,
    profile,
  }, {
    headers: {
      "cache-control": "private, no-store",
    },
  });
}

export async function GET() {
  return withSupabaseRequest(profileSnapshot);
}
