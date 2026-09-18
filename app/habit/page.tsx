import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { ProgrammeEntry } from "./programme-entry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BIS Learning",
  description: "Your BIS learning environment: handbook learning, live Lab and field experiment in one coherent journey.",
};

export default async function HabitProgrammePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; module?: string }>;
}) {
  const user = await requireUser("/habit");
  const params = await searchParams;
  if (params.section === "learn" && params.module !== "HAB") redirect("/learn");
  const initialSection = params.section === "learn" ? "learn" : "today";
  const initialLearnMode = params.section === "learn" ? "reader" : "library";
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email.split("@")[0];

  return (
    <ProgrammeEntry
      initialIdentity={{ email: user.email, displayName }}
      initialSection={initialSection}
      initialLearnMode={initialLearnMode}
    />
  );
}
