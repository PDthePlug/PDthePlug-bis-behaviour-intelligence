import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { SettingsPanel } from "./settings-panel";
import "../canonical-shell.css";
import "../learner-readability.css";
import "./settings.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  description: "Personalise how BIS looks, reads and fits your current life context.",
};

export default async function SettingsPage() {
  await requireUser("/settings");
  return (
    <CanonicalAdaptiveShell>
      <SettingsPanel />
    </CanonicalAdaptiveShell>
  );
}
