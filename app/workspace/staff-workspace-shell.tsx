"use client";

import { BisMark } from "@/components/brand/bis-mark";

import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  Users,
  ShieldAlert,
  UserRound,
  Eye,
  EyeOff,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { WorkspaceMenu, type WorkspaceDestination } from "@/components/workspace-menu";
import { OperationsView } from "../operations-view";

type Perspective = "facilitator" | "outcomes" | "admin";

type StaffSession = {
  identity: { email: string; displayName: string };
  roles: string[];
};

function canFacilitate(roles: string[]) {
  return roles.includes("FACILITATOR") || roles.includes("SAFEGUARDING_OFFICER");
}

function canViewOutcomes(roles: string[]) {
  return roles.includes("SPONSOR_VIEWER") || roles.includes("PROGRAMME_OWNER") || roles.includes("SYSTEM_ADMIN");
}

function canAdminister(roles: string[]) {
  return roles.includes("SYSTEM_ADMIN");
}

function defaultPerspective(roles: string[]): Perspective {
  if (canFacilitate(roles)) return "facilitator";
  if (roles.includes("SPONSOR_VIEWER") || roles.includes("PROGRAMME_OWNER")) return "outcomes";
  return "admin";
}

export function StaffWorkspaceShell() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/staff", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as StaffSession | null;
        if (!response.ok || typeof payload?.identity?.email !== "string" || typeof payload.identity.displayName !== "string" || !Array.isArray(payload.roles) || !payload.roles.every(role => typeof role === "string")) {
          if (controller.signal.aborted) return;
          setError(
            response.status === 403
              ? "This account does not have access to the programme workspace."
              : "We couldn't open the programme workspace. Please try again.",
          );
          return;
        }
        if (controller.signal.aborted) return;
        const roles = payload.roles ?? [];
        setSession({ identity: payload.identity, roles });
      } catch {
        if (!controller.signal.aborted) {
          setError("We couldn't open the programme workspace. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    if (!session || hidden) return;
    let timeout = window.setTimeout(() => setHidden(true), 120_000);
    const reset = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setHidden(true), 120_000);
    };
    const hideWhenBackgrounded = () => {
      if (document.visibilityState === "hidden") setHidden(true);
    };

    document.addEventListener("visibilitychange", hideWhenBackgrounded);
    for (const event of ["pointerdown", "keydown", "touchstart"] as const) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", hideWhenBackgrounded);
      for (const event of ["pointerdown", "keydown", "touchstart"] as const) {
        window.removeEventListener(event, reset);
      }
    };
  }, [session, hidden]);

  if (loading) {
    return (
      <main className="staff-gate">
        <section className="staff-gate-card">
          <div className="staff-gate-mark" aria-hidden="true"><BisMark /></div>
          <p className="staff-gate-eyebrow">Programme workspace</p>
          <h1>Opening your dashboard…</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="staff-gate">
        <section className="staff-gate-card">
          <div className="staff-gate-mark" aria-hidden="true"><BisMark /></div>
          <p className="staff-gate-eyebrow">Staff access</p>
          <h1>Workspace unavailable</h1>
          <p className="staff-gate-error" role="alert">{error}</p>
          <button className="staff-gate-primary" type="button" onClick={() => { setError(""); setLoading(true); setLoadAttempt(attempt => attempt + 1); }}>Try again</button>
          <Link className="staff-gate-secondary" href="/profile">Back to profile</Link>
        </section>
      </main>
    );
  }

  if (hidden) {
    return (
      <main className="staff-gate">
        <section className="staff-gate-card">
          <div className="staff-gate-mark" aria-hidden="true"><BisMark /></div>
          <p className="staff-gate-eyebrow">Privacy</p>
          <h1>Workspace hidden</h1>
          <button className="staff-gate-primary" type="button" onClick={() => setHidden(false)}>
            <Eye aria-hidden="true" />
            <span>Reveal workspace</span>
          </button>
          <Link className="staff-gate-secondary" href="/profile">Profile</Link>
        </section>
      </main>
    );
  }

  const facilitatorAvailable = canFacilitate(session.roles);
  const outcomesAvailable = canViewOutcomes(session.roles);
  const adminAvailable = canAdminister(session.roles);
  const requestedPerspective = searchParams.get("view") as Perspective | null;
  const perspective =
    requestedPerspective === "facilitator" && facilitatorAvailable
      ? "facilitator"
      : requestedPerspective === "outcomes" && outcomesAvailable
        ? "outcomes"
        : requestedPerspective === "admin" && adminAvailable
          ? "admin"
          : defaultPerspective(session.roles);

  const allowedSections = perspective === "facilitator" ? ["cohort","participants","support","review"] : perspective === "outcomes" ? ["overview","learning","evidence","decisions","reports"] : ["overview","groups","access","assessment"];
  const section = allowedSections.includes(searchParams.get("section") ?? "") ? searchParams.get("section")! : allowedSections[0];
  function changeContext(patch: {section?: string; group?: string}) {
    const params = new URLSearchParams(searchParams.toString()); params.set("view",perspective);
    if(patch.section) params.set("section",patch.section); if(patch.group) params.set("group",patch.group);
    router.push(`${pathname}?${params}`,{scroll:false});
  }
  function destination(view: Perspective, task: string, label: string, detail: string, icon: WorkspaceDestination["icon"]): WorkspaceDestination {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view); params.set("section", task); params.delete("learner");
    if(view !== perspective) params.delete("group");
    return {id:`${view}:${task}`,label,detail,icon,href:`${pathname}?${params}`,active:perspective===view && (section??(view==="facilitator"?"cohort":"overview"))===task};
  }
  const menuGroups = [
    ...(facilitatorAvailable ? [{label:"Facilitator operations",items:[
      destination("facilitator","cohort","Group","Plan the class and see who needs attention",Users),
      destination("facilitator","participants","Learners","Follow each learner’s progress",UserRound),
      destination("facilitator","support","Support","Record follow-up and refer concerns",ShieldAlert),
      destination("facilitator","review","Review","Review shared evidence and give feedback",ClipboardCheck),
    ]}] : []),
    ...(outcomesAvailable ? [{label:"Programme results",items:[
      destination("outcomes","overview","Results overview","Programme coverage and the evidence chain",Activity),
      destination("outcomes","learning","Learning journey","Learning checks and question patterns",BookOpen),
      destination("outcomes","evidence","Evidence & outcomes","Explore accumulated group evidence",ClipboardCheck),
      destination("outcomes","decisions","Programme decisions","Turn group patterns into actions",Settings2),
      destination("outcomes","reports","Reports","Cohort and institutional assessment reports",LayoutDashboard),
    ]}] : []),
    ...(adminAvailable ? [{label:"Administration",items:[
      destination("admin","overview","Operations overview","Programme activity and priorities",LayoutDashboard),
      destination("admin","groups","Groups & enrolment","Create groups and assign learners",Users),
      destination("admin","access","People & access","Give or remove role-based access",UserRound),
      destination("admin","assessment","Assessment governance","Map curriculum evidence and enable authored rubrics",ClipboardCheck),
      {id:"commercial",label:"Commercial workspace",detail:"Partnerships, opportunities and follow-up",href:"/commercial",icon:LayoutDashboard},
      {id:"content",label:"Content Studio",detail:"Prepare, review and publish programme content",href:"/content-studio",icon:BookOpen},
    ]}] : []),
    {label:"Your account",items:[{id:"profile",label:"Profile",detail:"Account and sign out",href:"/profile",icon:UserRound},{id:"learner",label:"Learner experience",detail:"Open the learning workspace",href:"/habit",icon:BookOpen}]},
  ];

  return (
    <div className="staff-workspace-shell">
      <header className="staff-workspace-header">
        <Link className="staff-workspace-brand" href="/workspace" aria-label="BIS staff workspace home">
          <span><BisMark /></span>
          <div><strong>Behaviour Intelligence Series™</strong><small>Programme workspace</small></div>
        </Link>
        <div className="staff-workspace-actions">
          <span className="staff-workspace-identity">{session.identity.email}</span>
          <button type="button" className="staff-workspace-hide" onClick={() => setHidden(true)}>
            <EyeOff aria-hidden="true" /> Hide
          </button>
        </div>
      </header>

      <a className="canonical-skip" href="#staff-task">Skip to current task</a>
      <main id="staff-task" tabIndex={-1} className="staff-workspace-main">
        <OperationsView initialRoles={session.roles} perspective={perspective} section={section} onSectionChange={section=>changeContext({section})} cohortId={searchParams.get("group")??undefined} onCohortChange={group=>changeContext({group})} />
      </main>
      <WorkspaceMenu groups={menuGroups} label="Staff workspace menu" />
    </div>
  );
}
