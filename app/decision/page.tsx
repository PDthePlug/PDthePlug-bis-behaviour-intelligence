import type { Metadata } from "next";
import { CoreLabExperience } from "../core-lab-experience";
import { coreLabsBySlug } from "../../lib/core-labs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Decision Lab",
  description: "A private seven-day investigation into your own decision-making behaviour.",
};

export default function DecisionLabPage() {
  return <CoreLabExperience definition={coreLabsBySlug.decision} />;
}

