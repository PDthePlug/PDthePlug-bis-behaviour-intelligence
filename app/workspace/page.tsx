import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { StaffWorkspaceShell } from "./staff-workspace-shell";
import "./staff-workspace-hardening.css";
import "../programme-outcomes-view.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BIS Staff Workspace",
  description: "Role-scoped BIS facilitator and audit workspace.",
};

export default async function WorkspacePage() {
  await requireUser("/workspace");
  return <StaffWorkspaceShell />;
}
