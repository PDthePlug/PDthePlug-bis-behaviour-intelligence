import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { StaffWorkspaceShell } from "./staff-workspace-shell";
import "./staff-workspace-hardening.css";
import "../programme-outcomes-view.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BIS Programme Workspace",
  description: "BIS programme delivery, organisation outcomes and administration."
};

export const metadata = { alternates: { canonical: "/workspace" } };

export default async function WorkspacePage() {
  await requireUser("/workspace");
  return <StaffWorkspaceShell />;
}
