import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestigationPlayer } from "../investigation-player";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Habit Investigation Handbook", description: "Learn, investigate, experiment and review Habit Lab as one continuous journey." };
export default async function HandbookPage({ params }: { params: Promise<{ lab: string }> }) { const { lab } = await params; if (lab !== "habit") notFound(); return <InvestigationPlayer />; }
