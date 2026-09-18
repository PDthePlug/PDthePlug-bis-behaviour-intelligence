import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { ModuleLibrary } from "../catalogue/module-library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learning Library · BIS",
  description: "Browse the Behaviour Intelligence Series handbook library.",
};

export default async function LearnLibraryPage() {
  await requireUser("/learn");
  return <ModuleLibrary mode="learning" />;
}
