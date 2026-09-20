import { MultiLabAdaptiveShell } from "../multi-lab-adaptive-shell";
import "../multi-lab-shell.css";
import "../multi-lab-flow-cleanup.css";

export const metadata = { alternates: { canonical: "/money" } };

export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return <MultiLabAdaptiveShell lab="money">{children}</MultiLabAdaptiveShell>;
}
