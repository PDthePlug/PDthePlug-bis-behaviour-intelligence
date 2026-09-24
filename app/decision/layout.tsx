import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";
import "../canonical-shell.css";
import "../learner-readability.css";
import "../lab-investigation-frame.css";

export const metadata = { alternates: { canonical: "/decision" } };

export default function DecisionLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
