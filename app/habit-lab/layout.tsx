import "../canonical-shell.css";
import "../learner-readability.css";
import "./habit-lab-route.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";

export const metadata = { alternates: { canonical: "/habit-lab" } };

export default function HabitLabLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
