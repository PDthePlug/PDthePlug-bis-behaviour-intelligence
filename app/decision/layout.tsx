import { MultiLabAdaptiveShell } from "../multi-lab-adaptive-shell";
import "../multi-lab-shell.css";

export default function DecisionLayout({ children }: { children: React.ReactNode }) {
  return <MultiLabAdaptiveShell lab="decision">{children}</MultiLabAdaptiveShell>;
}
