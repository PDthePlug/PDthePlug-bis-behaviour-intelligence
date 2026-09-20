import type { Metadata } from "next";
import { HabitLabShell } from "../habit-lab-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  alternates: { canonical: "/habit-lab/experiment" },
  title: "Habit Lab Experiment",
  description: "Your seven-day Habit Lab field experiment inside the BIS Habit programme.",
};

export default function HabitExperimentPage() {
  return <HabitLabShell view="experiment" />;
}
