import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { ProfileDashboard } from "./profile-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile · BIS",
  description: "Your BIS identity, experience, personal settings and account access.",
};

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email.split("@")[0];

  return <ProfileDashboard initialIdentity={{ email: user.email, displayName }} />;
}
