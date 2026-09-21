import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { ProgrammeEntry } from "@/app/habit/programme-entry";

export const dynamic = "force-dynamic";
export default async function HandbookPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (code === "hab") redirect("/habit?section=learn&module=HAB");
  if (!["dec", "mon", "idn", "att"].includes(code)) notFound();
  const user = await requireUser(`/handbooks/${code}`);
  return <ProgrammeEntry moduleCode={code.toUpperCase() as "DEC" | "MON" | "IDN" | "ATT"} initialSection="learn" initialLearnMode="reader" initialIdentity={{ email: user.email, displayName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : user.email.split("@")[0] }} />;
}
