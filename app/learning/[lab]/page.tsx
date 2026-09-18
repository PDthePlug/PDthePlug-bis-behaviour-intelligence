import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export default async function LegacyProgrammePage({ params }: { params: Promise<{ lab: string }> }) {
  const { lab } = await params;
  if (lab !== "habit") notFound();
  await requireUser("/learn");
  redirect("/learn");
}
