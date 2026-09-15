import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { ProgrammeEntry } from "./programme-entry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Habit Programme",
  description: "Your complete BIS Habit programme: authored learning, live Habit Lab, seven-day experiment and evidence review.",
};

export default async function HabitProgrammePage() {
  const user = await requireUser("/habit");
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email.split("@")[0];

  return <ProgrammeEntry initialIdentity={{ email: user.email, displayName }} />;
}
