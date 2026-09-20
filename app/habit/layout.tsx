import "../canonical-shell.css";
import "../learner-readability.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";

export const metadata = { alternates: { canonical: "/habit" } };

export default function HabitLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
