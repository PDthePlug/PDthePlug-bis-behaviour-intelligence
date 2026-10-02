import "../../canonical-shell.css";
import "../../learner-readability.css";
import "../../lab-investigation-frame.css";

/*
 * /labs already owns the canonical BIS shell.
 * Nesting another CanonicalAdaptiveShell here duplicates the top bar and menu.
 */
export default function DynamicLabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
