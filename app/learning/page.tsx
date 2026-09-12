import { LearningPortal } from "./learning-portal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BIS Learning Portal | Behaviour Intelligence",
  description: "Classification-based learning dashboards for the Behaviour Intelligence Series.",
};

export default function LearningPage() {
  return <LearningPortal />;
}
