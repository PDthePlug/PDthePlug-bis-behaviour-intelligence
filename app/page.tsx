import { BISApp } from "./bis-app";
import { HabitRouteBridge } from "./habit-route-bridge";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email.split("@")[0];
  return (
    <>
      <BISApp initialIdentity={{ email: user.email, displayName }} />
      <HabitRouteBridge />
    </>
  );
}
