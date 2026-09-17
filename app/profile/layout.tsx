import "../canonical-shell.css";
import "../learner-readability.css";
import "./profile.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
