import type { Metadata } from "next";
import "../../canonical-shell.css";
import "../../learner-readability.css";
import { CanonicalAdaptiveShell } from "../../canonical-adaptive-shell";
export const metadata: Metadata = { title: "Learning handbook", robots: { index: false, follow: false } };
export default function HandbookLayout({ children }: { children: React.ReactNode }) {
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
