"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, CircleDashed, FlaskConical, LockKeyhole, ShieldCheck } from "lucide-react";

type Release = { id: string; labCode: string; contentVersion: string; status: string };
type Progress = { labCode: string; contentReleaseId: string; semanticStepId: string; status: string };
type Snapshot = { profile: { displayName: string; deliveryEdition: "school" | "emerging_adult" | "workplace"; deliveryContext: string }; releases: Release[]; progress: Progress[] };

const editionLabels = { school: "School Edition", emerging_adult: "Emerging Adult Edition", workplace: "Workplace Edition" } as const;
const labs = [
  { number: "01", code: "HAB", title: "Habit Lab™", subtitle: "The Habit Investigation Handbook", description: "See the loop, test a replacement routine and turn seven days into behavioural evidence.", href: "/learning/habit", tone: "teal" },
  { number: "02", code: "DEC", title: "Decision Lab™", subtitle: "The Decision Investigation Handbook", description: "Pause inside a meaningful choice, examine what matters and look for workable options.", href: "/decision", tone: "coral" },
  { number: "03", code: "MON", title: "Money Lab™", subtitle: "The Spending Investigation Handbook", description: "Notice what happens before spending and test what a purchase is being asked to provide.", href: "/money", tone: "gold" },
  { number: "04", code: "IDN", title: "Identity Lab™", subtitle: "The Self-Story Investigation Handbook", description: "Reserved for the frozen Identity specification. No substitute content will be invented.", href: "", tone: "slate" },
] as const;

export function LearningPortal() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/learning", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(data.error || "The learning library could not be opened.");
      setSnapshot(data);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The learning library could not be opened."); });
    return () => controller.abort();
  }, []);
  const firstName = snapshot?.profile.displayName?.split(" ")[0] || "Investigator";
  const habitCompleted = useMemo(() => snapshot?.progress.filter((item) => item.labCode === "HAB" && item.status === "COMPLETED").length ?? 0, [snapshot]);

  if (error) return <main className="learning-state"><LockKeyhole/><h1>Learning library unavailable</h1><p>{error}</p><Link href="/">Return to BIS</Link></main>;
  if (!snapshot) return <main className="learning-state"><span className="learning-loader"/><h1>Opening Volume 1…</h1><p>Loading your edition and investigation record.</p></main>;
  return <main className="library-shell">
    <header className="library-header"><Link href="/" className="library-brand"><span>BIS</span><div><strong>Behaviour Intelligence Series™</strong><small>Applied Commerce®</small></div></Link><div className="library-edition"><ShieldCheck/><span>{editionLabels[snapshot.profile.deliveryEdition]}</span></div></header>
    <section className="library-hero"><div><p className="library-kicker">Volume 1 · Personal Behaviour Intelligence</p><h1>Good to see you, {firstName}.</h1><p>Choose an investigation. The handbook, experiment, evidence and profile now belong to one learning journey.</p></div><aside><BookOpen/><strong>One learner profile</strong><p>Your edition is assigned once and inherited by every handbook.</p></aside></section>
    <section className="library-section" aria-labelledby="handbooks-heading"><div className="library-section-heading"><div><p>Core Identity & Behaviour Labs</p><h2 id="handbooks-heading">Your investigation library</h2></div><span>{habitCompleted}/9 Habit investigations reviewed</span></div><div className="library-grid">
      {labs.map((lab) => { const release = snapshot.releases.find((item) => item.labCode === lab.code); const isHabit = lab.code === "HAB"; const unavailable = lab.code === "IDN"; const status = unavailable ? "Specification required" : isHabit ? (habitCompleted ? "In progress" : "Ready to begin") : "Current Lab available"; return <article key={lab.code} className={`library-card library-${lab.tone}`}><div className="library-card-top"><span>{lab.number}</span>{unavailable ? <LockKeyhole/> : release || !isHabit ? <CheckCircle2/> : <CircleDashed/>}</div><p className="library-card-status">{status}</p><h3>{lab.title}</h3><h4>{lab.subtitle}</h4><p>{lab.description}</p>{isHabit && <div className="library-progress" aria-label={`${habitCompleted} of 9 investigations complete`}><i style={{ width: `${Math.round(habitCompleted / 9 * 100)}%` }}/></div>}{unavailable ? <span className="library-disabled">Not yet available</span> : <Link href={lab.href}>{isHabit ? "Open handbook" : "Open current Lab"}<ArrowRight/></Link>}</article>; })}
    </div></section>
    <section className="library-continuity"><FlaskConical/><div><strong>The software is the handbook in executable form.</strong><p>Phase 1 introduces the shared player and stable content contract. Existing Decision and Money runtimes remain the safe production path until their manuscripts are reconciled into cartridges.</p></div></section>
  </main>;
}
