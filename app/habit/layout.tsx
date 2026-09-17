import "../canonical-shell.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";

export default function HabitLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
