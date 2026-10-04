import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HabitLabShell } from "./habit-lab-shell";
import { optionalSafeReturnPath } from "@/lib/auth-redirect";
import { requireUser } from "@/lib/supabase/require-user";
import { liveUniversalLabHref } from "@/lib/lab-runtime-routing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Habit Lab",
  description: "The focused Day 3 Habit Lab investigation inside your BIS Habit programme.",
};

export default async function HabitLabPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = optionalSafeReturnPath(params.returnTo);
  const next = returnTo ? `/habit-lab?returnTo=${encodeURIComponent(returnTo)}` : "/habit-lab";
  await requireUser(next);
  const universalHref = await liveUniversalLabHref("HAB", { returnTo });
  if (universalHref) redirect(universalHref);
  return <HabitLabShell view="lab" returnTo={returnTo} />;
}
