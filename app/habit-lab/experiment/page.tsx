import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HabitLabShell } from "../habit-lab-shell";
import { optionalSafeReturnPath } from "@/lib/auth-redirect";
import { requireUser } from "@/lib/supabase/require-user";
import { liveUniversalLabHref } from "@/lib/lab-runtime-routing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  alternates: { canonical: "/habit-lab/experiment" },
  title: "Habit Lab Experiment",
  description: "Your seven-day Habit Lab field experiment inside the BIS Habit programme.",
};

export default async function HabitExperimentPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = optionalSafeReturnPath(params.returnTo);
  const next = returnTo ? `/habit-lab/experiment?returnTo=${encodeURIComponent(returnTo)}` : "/habit-lab/experiment";
  await requireUser(next);
  const universalHref = await liveUniversalLabHref("HAB", { returnTo, step: 7 });
  if (universalHref) redirect(universalHref);
  return <HabitLabShell view="experiment" returnTo={returnTo} />;
}
