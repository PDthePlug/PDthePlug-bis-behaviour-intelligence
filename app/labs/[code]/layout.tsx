import { CanonicalAdaptiveShell } from "../../canonical-adaptive-shell";
import "../../canonical-shell.css";
import "../../learner-readability.css";
import "../../lab-investigation-frame.css";

export default function DynamicLabLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
