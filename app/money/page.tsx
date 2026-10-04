import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoreLabExperience } from "../core-lab-experience";
import { coreLabsBySlug } from "../../lib/core-labs";
import { optionalSafeReturnPath } from "@/lib/auth-redirect";
import { requireUser } from "@/lib/supabase/require-user";
import { liveUniversalLabHref } from "@/lib/lab-runtime-routing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Money Lab",
  description: "A private seven-day investigation into your own spending behaviour.",
};

export default async function MoneyLabPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = optionalSafeReturnPath(params.returnTo);
  const next = returnTo ? `/money?returnTo=${encodeURIComponent(returnTo)}` : "/money";
  await requireUser(next);
  const universalHref = await liveUniversalLabHref("MON", { returnTo });
  if (universalHref) redirect(universalHref);
  return <CoreLabExperience definition={coreLabsBySlug.money} />;
}
