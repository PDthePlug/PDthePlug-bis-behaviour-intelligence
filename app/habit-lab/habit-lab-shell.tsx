import { BISApp } from "../bis-app";
import { HabitRouteBridge, type RequestedHabitView } from "../habit-route-bridge";
import { requireUser } from "@/lib/supabase/require-user";

export async function HabitLabShell({ view }: { view: RequestedHabitView }) {
  const next = view === "experiment" ? "/habit-lab/experiment" : "/habit-lab";
  const user = await requireUser(next);
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email.split("@")[0];

  return (
    <div className="habit-lab-route universal-habit-route">
      <BISApp initialIdentity={{ email: user.email, displayName }} />
      <HabitRouteBridge target={view} hideReturnLink />
    </div>
  );
}

