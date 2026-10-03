import "./styles.css";
import "../../../../app/brand.css";
import "../../../../app/learning/programme-player.css";
import "../../../../app/habit-lab/focused-runtime.css";
import "../../../../app/responsive-readiness.css";
import "../../../../app/learning/handbook-presentation.css";
import "../../../../app/canonical-shell.css";
import "../../../../app/learner-readability.css";
import "../../../../app/lab-investigation-frame.css";
import "../../../../app/profile/profile.css";
import { CanonicalAdaptiveShell } from "../../../../app/canonical-adaptive-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="antialiased"><CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell></body></html>;
}
