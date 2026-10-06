import { requireUser } from "@/lib/supabase/require-user";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";
import { ExperiencePanel } from "./experience-panel";
import "../canonical-shell.css";
import "../settings/settings.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "My experience" };
export default async function Page() { await requireUser("/experience"); return <CanonicalAdaptiveShell><ExperiencePanel /></CanonicalAdaptiveShell>; }
