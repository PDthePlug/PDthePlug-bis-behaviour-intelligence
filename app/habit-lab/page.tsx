import type { Metadata } from "next";
import { HabitLabShell } from "./habit-lab-shell";

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
  return <HabitLabShell view="lab" returnTo={params.returnTo} />;
}
