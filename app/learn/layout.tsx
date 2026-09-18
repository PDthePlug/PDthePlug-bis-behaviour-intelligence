import "../canonical-shell.css";
import "../learner-readability.css";
import "../catalogue/catalogue.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
