import "../canonical-shell.css";
import "./habit-lab-route.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";

export default function HabitLabLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
