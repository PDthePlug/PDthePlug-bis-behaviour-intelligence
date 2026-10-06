import { eq } from "@/db/query";
import { getDb, withSupabaseRequest } from "@/db";
import { learners } from "@/db/schema";
import { getRoles, identityFrom } from "@/lib/bis-access";

const DELIVERY_EDITIONS = new Set(["school", "emerging_adult", "workplace"]);
const APPEARANCES = new Set(["system", "light", "warm", "dark"]);
const ACCENTS = new Set(["bis", "blue", "amber", "sage"]);
const TEXT_SIZES = new Set(["small", "standard", "large", "extra_large"]);
const READING_WIDTHS = new Set(["narrow", "standard", "wide"]);

async function readProfile(identity: NonNullable<Awaited<ReturnType<typeof identityFrom>>>) {
  const [profile, roles] = await Promise.all([
    getDb()
      .select({
        displayName: learners.displayName,
        ageBand: learners.ageBand,
        mode: learners.mode,
        deliveryEdition: learners.deliveryEdition,
        appearancePreference: learners.appearancePreference,
        accentPreference: learners.accentPreference,
        textSizePreference: learners.textSizePreference,
        readingWidthPreference: learners.readingWidthPreference,
      })
      .from(learners)
      .where(eq(learners.userId, identity.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getRoles(identity),
  ]);

  return {
    identity: {
      email: identity.email,
      displayName: identity.displayName,
    },
    roles,
    profile,
  };
}

async function profileSnapshot() {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  return Response.json(await readProfile(identity), {
    headers: {
      "cache-control": "private, no-store",
    },
  });
}

async function updateProfile(request: Request) {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Profile settings could not be read." }, { status: 400 });
  }

  const update: Partial<typeof learners.$inferInsert> = {};
  if (body.deliveryEdition !== undefined) {
    if (typeof body.deliveryEdition !== "string" || !DELIVERY_EDITIONS.has(body.deliveryEdition)) {
      return Response.json({ error: "Choose a valid BIS experience." }, { status: 400 });
    }
    update.deliveryEdition = body.deliveryEdition;
  }
  if (body.appearance !== undefined) {
    if (typeof body.appearance !== "string" || !APPEARANCES.has(body.appearance)) {
      return Response.json({ error: "Choose a valid appearance." }, { status: 400 });
    }
    update.appearancePreference = body.appearance;
  }
  if (body.accent !== undefined) {
    if (typeof body.accent !== "string" || !ACCENTS.has(body.accent)) {
      return Response.json({ error: "Choose a valid accent." }, { status: 400 });
    }
    update.accentPreference = body.accent;
  }
  if (body.textSize !== undefined) {
    if (typeof body.textSize !== "string" || !TEXT_SIZES.has(body.textSize)) {
      return Response.json({ error: "Choose a valid text size." }, { status: 400 });
    }
    update.textSizePreference = body.textSize;
  }
  if (body.readingWidth !== undefined) {
    if (typeof body.readingWidth !== "string" || !READING_WIDTHS.has(body.readingWidth)) {
      return Response.json({ error: "Choose a valid reading width." }, { status: 400 });
    }
    update.readingWidthPreference = body.readingWidth;
  }

  if (!Object.keys(update).length) {
    return Response.json({ error: "No profile changes were provided." }, { status: 400 });
  }

  update.updatedAt = new Date().toISOString();
  await getDb().update(learners).set(update).where(eq(learners.userId, identity.id));

  return Response.json(await readProfile(identity), {
    headers: {
      "cache-control": "private, no-store",
    },
  });
}

export async function GET() {
  return withSupabaseRequest(profileSnapshot);
}

export async function PATCH(request: Request) {
  return withSupabaseRequest(() => updateProfile(request));
}
