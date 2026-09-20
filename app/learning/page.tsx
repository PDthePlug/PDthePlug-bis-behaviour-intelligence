import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export const metadata = { alternates: { canonical: "/learning" } };

export default async function LearningPage() {
  await requireUser("/learn");
  redirect("/learn");
}
