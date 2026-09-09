import type { Metadata } from "next";
import { CoreLabExperience } from "../core-lab-experience";
import { coreLabsBySlug } from "../../lib/core-labs";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Decision Lab",
  description: "A private seven-day investigation into your own decision-making behaviour.",
};

export default async function DecisionLabPage() {
  await requireUser("/decision");
  return <CoreLabExperience definition={coreLabsBySlug.decision} />;
}
