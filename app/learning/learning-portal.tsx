"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, CircleDashed, FlaskConical, LockKeyhole, ShieldCheck } from "lucide-react";

type Release = { id: string; labCode: string; contentVersion: string; status: string };
type Progress = { labCode: string; contentReleaseId: string; semanticStepId: string; status: string };
type Snapshot = { profile: { displayName: string; deliveryEdition: "school" | "emerging_adult" | "workplace"; deliveryContext: string }; releases: Release[]; progress: Progress[] };

const editionLabels = { school: "School Edition", emerging_adult: "Emerging Adult Edition", workplace: "Workplace Edition" } as const;
const labs = [
  { number: "01", code: "HAB", title: "Habit Lab™", subtitle: "The Habit Investigation Handbook", description: "A complete ten-day programme: workshop learning, the live investigation, seven days of field evidence and final review.", href: "/learning/habit", tone: "teal" },
  { number: "02", code: "DEC", title: "Decision Lab™", subtitle: "The Decision Investigation Handbook", description: "Current production Lab remains available while its full ten-day programme journey is reconciled to the same standard.", href: "/decision", tone: "coral" },
  { number: "03", code: "MON", title: "Money Lab™", subtitle: "The Money Investigation Handbook", description: "Current production Lab remains available while its full ten-day programme journey is reconciled to the same standard.", href: "/money", tone: "gold" },
  { number: "04", code: "IDN", title: "Identity Lab™", subtitle: "The Self-Story Investigation Handbook", description: "The frozen manuscript is preserved. Production conversion follows after the Habit programme standard is proven.", href: "", tone: "slate" },
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
  const habitCompleted = useMemo(() => snapshot?.progress.filter((item) => item.labCode === "HAB" && item.semanticStepId.startsWith("HAB.PROGRAMME.") && item.status === "COMPLETED").length ?? 0, [snapshot]);

  if (error) return <main className="learning-state"><LockKeyhole/><h1>Learning library unavailable</h1><p>{error}</p><Link href="/">Return to BIS</Link></main>;
  if (!snapshot) return <main className="learning-state"><span className="learning-loader"/><h1>Opening Volume 1…</h1><p>Loading your edition and programme record.</p></main>;
  return <main className="library-shell">
    <header className="library-header"><Link href="/" className="library-brand"><span>BIS</span><div><strong>Behaviour Intelligence Series™</strong><small>Applied Commerce®</small></div></Link><div className="library-edition"><ShieldCheck/><span>{editionLabels[snapshot.profile.deliveryEdition]}</span></div></header>
    <section className="library-hero"><div><p className="library-kicker">Volume 1 · Personal Behaviour Intelligence</p><h1>Good to see you, {firstName}.</h1><p>Your handbook, facilitated workshop, live Lab, seven-day experiment and final evidence review belong to one continuous programme journey.</p></div><aside><BookOpen/><strong>One learner profile</strong><p>Your delivery edition is inherited by every handbook. Labs do not reclassify you.</p></aside></section>
    <section className="library-section" aria-labelledby="handbooks-heading"><div className="library-section-heading"><div><p>Core Identity & Behaviour Labs</p><h2 id="handbooks-heading">Your Volume 1 programmes</h2></div><span>{habitCompleted}/13 Habit programme positions reviewed</span></div><div className="library-grid">
      {labs.map((lab) => { const release = snapshot.releases.find((item) => item.labCode === lab.code); const isHabit = lab.code === "HAB"; const unavailable = lab.code === "IDN"; const status = unavailable ? "Conversion held" : isHabit ? (habitCompleted ? "Programme in progress" : "10-day programme ready") : "Current Lab available"; return <article key={lab.code} className={`library-card library-${lab.tone}`}><div className="library-card-top"><span>{lab.number}</span>{unavailable ? <LockKeyhole/> : release || !isHabit ? <CheckCircle2/> : <CircleDashed/>}</div><p className="library-card-status">{status}</p><h3>{lab.title}</h3><h4>{lab.subtitle}</h4><p>{lab.description}</p>{isHabit && <div className="library-progress" aria-label={`${habitCompleted} of 13 programme positions complete`}><i style={{ width: `${Math.round(habitCompleted / 13 * 100)}%` }}/></div>}{unavailable ? <span className="library-disabled">Not yet converted</span> : <Link href={lab.href}>{isHabit ? "Open programme" : "Open current Lab"}<ArrowRight/></Link>}</article>; })}
    </div></section>
    <section className="library-continuity"><FlaskConical/><div><strong>The handbook is the workshop delivery environment.</strong><p>Habit Lab is the first complete programme standard: authored learning stays intact, Phase A remains the executable investigation, and the field experiment stays available beside the workshop material until Day 10.</p></div></section>
  </main>;
}
