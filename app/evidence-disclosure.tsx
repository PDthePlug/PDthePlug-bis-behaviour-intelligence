import type { ReactNode } from "react";
import "./evidence-disclosure.css";

export function EvidenceDisclosure({ title, children, hidden = false }: { title: string; children: ReactNode; hidden?: boolean }) {
  return <details className="evidence-disclosure" hidden={hidden}>
    <summary>{title}</summary>
    <div className="evidence-disclosure-body">{children}</div>
  </details>;
}
