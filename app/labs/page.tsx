import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { ModuleLibrary } from "../catalogue/module-library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lab Library · BIS",
  description: "Browse the Behaviour Intelligence Series Lab library.",
};

export default async function LabsLibraryPage() {
  await requireUser("/labs");
  return <ModuleLibrary mode="lab" />;
}
