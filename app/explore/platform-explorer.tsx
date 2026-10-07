"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Users, ChartNoAxesCombined } from "lucide-react";
import { BisMark } from "@/components/brand/bis-mark";
import { PlatformContext, type PlatformNavigationGuard } from "@/components/platform-context";
import { createExplorationSession, explorationHref, explorationStorageKey } from "@/lib/experience/exploration-session.mjs";
import { leap9IllustrativeReport } from "@/lib/experience/leap9-report";
import type { SponsorSnapshot } from "../programme-outcomes-view";
type FacilitatorData = Parameters<typeof import("../facilitator-workspace").FacilitatorWorkspace>[0]["data"];
const ProgrammePlayer = dynamic(() => import("../learning/programme-player").then(module => module.ProgrammePlayer));
const UniversalRuntimeLab = dynamic(() => import("../labs/[code]/universal-runtime-lab").then(module => module.UniversalRuntimeLab));
const PortfolioWorkspace = dynamic(() => import("../portfolio/portfolio-workspace").then(module => module.PortfolioWorkspace));
const FacilitatorWorkspace = dynamic(() => import("../facilitator-workspace").then(module => module.FacilitatorWorkspace));
const ProgrammeOutcomesView = dynamic(() => import("../programme-outcomes-view").then(module => module.ProgrammeOutcomesView));

type Content = { lab: unknown; programme: unknown };
type Role = "learner" | "facilitator" | "owner";
const roles = [
  { id: "learner", label: "Learner", icon: BookOpen, action: "Try a Habit Lab", result: "Notice a pattern. Test a different response.", screen: "lab" },
  { id: "facilitator", label: "Facilitator", icon: Users, action: "Support a group", result: "Find who needs a check-in. Plan the next class.", screen: "cohort" },
  { id: "owner", label: "Programme owner", icon: ChartNoAxesCombined, action: "See programme results", result: "Review the evidence. Choose a useful next step.", screen: "overview" },
] as const;
const tabs = {
  learner: [["lab", "Habit Lab"], ["learn", "Learning"], ["portfolio", "Evidence Portfolio"]],
  facilitator: [["cohort", "Group"], ["participants", "Learners"], ["support", "Support"], ["review", "Review"]],
  owner: [["overview", "Overview"], ["learning", "Learning"], ["practice", "Practice"], ["decisions", "Decisions"]],
};

export function PlatformExplorer({ content }: { content: Content }) {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("role");
  const role = roles.some(item => item.id === requested) ? requested as Role : null;
  const requestedScreen = role === "facilitator" ? params.get("section") ?? params.get("screen") : params.get("screen");
  const screen = role && tabs[role].some(([id]) => id === requestedScreen) ? requestedScreen! : role ? tabs[role][0][0] : "";
  const [session, setSession] = useState<ReturnType<typeof createExplorationSession> | null>(null);
  const [revision, setRevision] = useState(0);
  const [inExperiment, setInExperiment] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const navigationGuard = useRef<PlatformNavigationGuard | null>(null);
  const registerNavigationGuard = useCallback((guard: PlatformNavigationGuard | null) => { navigationGuard.current = guard; }, []);

  useEffect(() => {
    let history: unknown = [];
    try { const stored = sessionStorage.getItem(explorationStorageKey); if (stored && stored.length <= 250000) history = JSON.parse(stored); } catch { /* In-memory exploration remains available. */ }
    const timer = setTimeout(() => { const example = createExplorationSession(content, leap9IllustrativeReport, history); setSession(example); setInExperiment(Boolean(example.labSnapshot().enrolment?.experimentStartedAt) && !example.labSnapshot().experimentTiming.reviewReady); }, 0);
    return () => clearTimeout(timer);
  }, [content]);

  useEffect(() => { const frame = requestAnimationFrame(() => title.current?.focus()); return () => cancelAnimationFrame(frame); }, [role, screen]);

  function saved() {
    if (!session) return;
    try {
      if (session.state.actions.length > 200 || JSON.stringify(session.state.actions).length > 250000) { setMessage("Your example continues here. Restart to begin a fresh practice session."); return; }
      sessionStorage.setItem(explorationStorageKey, JSON.stringify(session.state.actions));
      setMessage("Example saved in this tab.");
    } catch { setMessage("Keep exploring. This browser cannot keep example answers after a refresh."); }
  }
  const request = useMemo<typeof fetch>(() => async (input, init) => {
    if (!session || !role) return Response.json({ error: "Choose a view to explore." }, { status: 403 });
    const response = await session.request(role, input, init);
    if (init?.method === "POST" && response.ok) {
      setInExperiment(Boolean(session.labSnapshot().enrolment?.experimentStartedAt) && !session.labSnapshot().experimentTiming.reviewReady);
      try { const stored = JSON.stringify(session.state.actions);
      if (session.state.actions.length <= 200 && stored.length <= 250000) sessionStorage.setItem(explorationStorageKey, stored);
      else setMessage("Your example continues here. Restart to begin a fresh practice session."); } catch { setMessage("Keep exploring. This browser cannot keep example answers after a refresh."); }
    }
    return response;
  }, [session, role]);
  const context = useMemo(() => ({ request, href: explorationHref, example: true, registerNavigationGuard }), [request, registerNavigationGuard]);

  async function navigate(id: Role, target: string) {
    if (navigationGuard.current && !await navigationGuard.current()) return;
    router.push(`/explore?role=${id}&${id === "facilitator" ? "section" : "screen"}=${target}`, { scroll: true });
    setMessage(""); setConfirmReset(false);
    requestAnimationFrame(() => title.current?.focus());
  }
  async function act(body: Record<string, unknown>) {
    if (!session || !role) return false;
    try { session.execute(role, "/api/staff", body); saved(); setRevision(value => value + 1); return true; }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "That example could not be saved."); return false; }
  }
  function reset() {
    navigationGuard.current = null;
    try { sessionStorage.removeItem(explorationStorageKey); } catch { /* Reset also clears memory. */ }
    setSession(createExplorationSession(content, leap9IllustrativeReport)); setRevision(value => value + 1); setInExperiment(false); setConfirmReset(false); setMessage("Example restarted.");
    if (role) navigate(role, tabs[role][0][0]);
  }

  return <div className="bis-explorer">
    <a className="explore-skip" href="#explore-content">Skip to experience</a>
    <header className="explore-topbar"><Link href="/explore" aria-label="BIS exploration home"><BisMark /><strong>BIS</strong></Link><span>Example programme · No account needed</span><Link href="/sign-in">Sign in <ArrowRight size={16} /></Link></header>
    {!role ? <main id="explore-content" className="explore-picker">
      <p className="eyebrow">Explore BIS</p><h1>See what you can do.</h1><p>Choose a view. Try the platform with an example Habit programme.</p>
      <div className="explore-role-grid">{roles.map(item => <button key={item.id} onClick={() => navigate(item.id, item.screen)}><item.icon size={28} /><span>{item.label}</span><h2>{item.action}</h2><p>{item.result}</p><strong>Explore <ArrowRight size={18} /></strong></button>)}</div>
      <p className="explore-example-note">Use fictional examples. Your practice stays in this browser tab.</p>
    </main> : <>
      <section className="explore-toolbar"><div><p className="eyebrow">Explore as</p><label htmlFor="explore-role" className="sr-only">Choose your view</label><select id="explore-role" value={role} onChange={event => navigate(event.target.value as Role, tabs[event.target.value as Role][0][0])}>{roles.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
        <nav aria-label="Explore workspace">{tabs[role].map(([id, label]) => <button key={id} aria-current={screen === id ? "page" : undefined} onClick={() => navigate(role, id)}>{label}</button>)}</nav>
        <button className="explore-reset" onClick={() => setConfirmReset(true)}>Restart example</button>
      </section>
      {confirmReset ? <div className="explore-reset-confirm"><p>Clear all practice answers and start again?</p><button onClick={reset}>Clear and restart</button><button onClick={() => setConfirmReset(false)}>Keep exploring</button></div> : null}
      <div className="explore-note"><p>Fictional programme. Use example answers.</p><details><summary>About this experience</summary><p>These are the BIS learning, Lab, portfolio and programme screens with fictional participants. Practice changes stay in this tab. Programme findings use a separate fixed example of 20 participants.</p><p>Photo uploads, safeguarding referrals and scored assessments need a signed-in programme. The example Lab lets you move to the next practice day; your own programme follows its agreed dates.</p></details></div>
      <h1 className="sr-only" ref={title} tabIndex={-1}>{roles.find(item => item.id === role)?.label} experience</h1>
      {message ? <p className="explore-message" role="status">{message}</p> : null}
      <section id="explore-content" aria-label="BIS workspace" className={`explore-workspace explore-${role}`}>
        {!session ? <p role="status">Opening the example programme…</p> : <PlatformContext.Provider value={context}>
          {role === "learner" && screen === "learn" ? <ProgrammePlayer key={`learn-${revision}`} moduleCode="HAB" initialSection="learn" initialLearnMode="reader" /> : null}
          {role === "learner" && screen === "lab" ? <><UniversalRuntimeLab key={`lab-${revision}`} labCode="HAB" />{inExperiment ? <button className="explore-next-day" onClick={() => { try { session.execute("learner", "/api/universal-lab", { action: "nextExampleDay" }); saved(); const timing = session.labSnapshot().experimentTiming; if (timing.reviewReady) setInExperiment(false); setRevision(value => value + 1); } catch { setMessage("Complete the experiment plan before trying the next practice day."); } }}>Try the next example day <ArrowRight size={16} /></button> : null}</> : null}
          {role === "learner" && screen === "portfolio" ? <PortfolioWorkspace key={`portfolio-${revision}`} /> : null}
          {role === "facilitator" ? <FacilitatorWorkspace data={session.state.facilitator as FacilitatorData} saving={false} act={act} /> : null}
          {role === "owner" ? <ProgrammeOutcomesView data={session.state.sponsor as SponsorSnapshot} section={screen} onSectionChange={target => navigate("owner", target)} act={act} reportHref="/experience/dgmt/report" /> : null}
        </PlatformContext.Provider>}
      </section>
    </>}
  </div>;
}
