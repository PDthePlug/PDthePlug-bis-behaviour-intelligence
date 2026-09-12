import type { Metadata } from "next";
import { CoreLabExperience } from "../core-lab-experience";
import { coreLabsBySlug } from "../../lib/core-labs";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Money Lab",
  description: "A private seven-day investigation into your own spending behaviour.",
};

export default async function MoneyLabPage() {
  await requireUser("/money");
  return <CoreLabExperience definition={coreLabsBySlug.money} />;
}
