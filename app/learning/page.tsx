import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  await requireUser("/habit?section=learn");
  redirect("/habit?section=learn");
}
