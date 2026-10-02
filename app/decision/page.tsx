import type { Metadata } from "next";
import { CoreLabExperience } from "../core-lab-experience";
import { coreLabsBySlug } from "../../lib/core-labs";
import { optionalSafeReturnPath } from "@/lib/auth-redirect";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Decision Lab",
  description: "A private seven-day investigation into your own decision-making behaviour.",
};

export default async function DecisionLabPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = optionalSafeReturnPath(params.returnTo);
  const next = returnTo ? `/decision?returnTo=${encodeURIComponent(returnTo)}` : "/decision";
  await requireUser(next);
  return <CoreLabExperience definition={coreLabsBySlug.decision} />;
}
