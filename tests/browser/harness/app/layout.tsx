import "./styles.css";
import "../../../../app/brand.css";
import "../../../../app/learning/programme-player.css";
import "../../../../app/habit-lab/focused-runtime.css";
import "../../../../app/responsive-readiness.css";
import "../../../../app/learning/handbook-presentation.css";
import "../../../../app/canonical-shell.css";
import "../../../../app/learner-readability.css";
import "../../../../app/lab-investigation-frame.css";
import "../../../../app/learner-document-system.css";
import "../../../../app/profile/profile.css";
import { HarnessShell } from "./harness-shell";
import "../../../../app/evidence-engine.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="antialiased"><HarnessShell>{children}</HarnessShell></body></html>;
}
