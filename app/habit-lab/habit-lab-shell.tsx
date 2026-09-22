import { BisMark } from "@/components/brand/bis-mark";
import { FlaskConical } from "lucide-react";
import { BISApp } from "../bis-app";
import { HabitRouteBridge, type RequestedHabitView } from "../habit-route-bridge";
import { requireUser } from "@/lib/supabase/require-user";
import { FocusedLearnerMenu } from "./focused-learner-menu";

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
    <div className="habit-lab-route">
      <header className="habit-lab-route-header">
        <div className="habit-lab-brand">
          <span><BisMark /></span>
          <div>
            <small>{view === "experiment" ? "Field experiment" : "Day 3 · Live investigation"}</small>
            <strong>{view === "experiment" ? "Habit Lab Experiment" : "Habit Lab Phase A"}</strong>
          </div>
        </div>
        <span className="habit-lab-route-status"><FlaskConical /> {view === "experiment" ? "Experiment" : "Lab"}</span>
      </header>
      <BISApp initialIdentity={{ email: user.email, displayName }} />
      <HabitRouteBridge target={view} hideReturnLink />
      <FocusedLearnerMenu active={view} />
    </div>
  );
}

