import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";
import "../canonical-shell.css";
import "../learner-readability.css";
import "../lab-investigation-frame.css";

export const metadata = { alternates: { canonical: "/money" } };

export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
