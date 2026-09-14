import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgrammePlayer } from "../programme-player";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Habit Lab — 10-Day Programme",
  description: "The complete Habit Investigation Handbook, live Habit Lab and seven-day field experiment in one BIS programme journey.",
};

export default async function HandbookPage({ params }: { params: Promise<{ lab: string }> }) {
  const { lab } = await params;
  if (lab !== "habit") notFound();
  return <ProgrammePlayer />;
}
