import type { Metadata } from "next";
import { BISApp } from "../bis-app";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BIS Workspace",
  description: "Role-scoped BIS learner, facilitator and audit workspace.",
};

export default async function WorkspacePage() {
  const user = await requireUser("/workspace");
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email.split("@")[0];

  return <BISApp initialIdentity={{ email: user.email, displayName }} />;
}
