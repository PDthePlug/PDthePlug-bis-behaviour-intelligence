import { MultiLabAdaptiveShell } from "../multi-lab-adaptive-shell";
import "../multi-lab-shell.css";
import "../multi-lab-flow-cleanup.css";

export const metadata = { alternates: { canonical: "/decision" } };

export default function DecisionLayout({ children }: { children: React.ReactNode }) {
  return <MultiLabAdaptiveShell lab="decision">{children}</MultiLabAdaptiveShell>;
}
