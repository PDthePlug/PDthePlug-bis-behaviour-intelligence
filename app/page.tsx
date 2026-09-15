import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireUser("/habit");
  const params = await searchParams;

  // Preserve compatibility with the former root-owned Habit runtime links while
  // moving the actual Lab behind its own focused route.
  if (params.view === "lab") redirect("/habit-lab");
  if (params.view === "experiment") redirect("/habit-lab/experiment");

  redirect("/habit");
}
