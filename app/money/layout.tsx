import { MultiLabAdaptiveShell } from "../multi-lab-adaptive-shell";
import "../multi-lab-shell.css";

export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return <MultiLabAdaptiveShell lab="money">{children}</MultiLabAdaptiveShell>;
}
