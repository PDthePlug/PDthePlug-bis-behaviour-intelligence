"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CanonicalAdaptiveShell } from "../../../../app/canonical-adaptive-shell";
export function HarnessShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/explore" || pathname === "/sign-in" || pathname === "/staff-shell" || (pathname === "/experience/leap9" || pathname === "/experience/leap9/v2" || pathname === "/experience/dgmt") || pathname === "/commercial") return children;
  return <CanonicalAdaptiveShell>{children}</CanonicalAdaptiveShell>;
}
