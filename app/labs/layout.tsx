import "../canonical-shell.css";
import "../learner-readability.css";
import "../catalogue/catalogue.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";

export const metadata = { alternates: { canonical: "/labs" } };

export default function LabsLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
