import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { RoleRouter } from "./role-router";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireUser("/");
  const params = await searchParams;

  // Preserve former Habit runtime links while the application root once again
  // owns role-based dashboard routing.
  if (params.view === "lab") redirect("/habit-lab");
  if (params.view === "experiment") redirect("/habit-lab/experiment");

  return <RoleRouter />;
}
