"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EyeOff,
  LayoutDashboard,
  LockKeyhole,
  Search,
  ShieldCheck,
} from "lucide-react";
import { OperationsView } from "../operations-view";

type Perspective = "facilitator" | "audit";

type StaffSession = {
  identity: { email: string; displayName: string };
  roles: string[];
};

function canFacilitate(roles: string[]) {
  return roles.includes("FACILITATOR") || roles.includes("SAFEGUARDING_OFFICER");
}

function canAudit(roles: string[]) {
  return roles.includes("SYSTEM_ADMIN");
}

export function StaffWorkspaceShell() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [perspective, setPerspective] = useState<Perspective>("facilitator");

  useEffect(() => {
    if (!visible) return;
    let timeout = window.setTimeout(() => setVisible(false), 120_000);
    const reset = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setVisible(false), 120_000);
    };
    const hideWhenBackgrounded = () => {
      if (document.visibilityState === "hidden") setVisible(false);
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
  }, [visible]);

  async function openWorkspace() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/staff", { cache: "no-store" });
      const payload = (await response.json()) as StaffSession & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Your staff workspace could not be opened.");
      }

      const roles = payload.roles ?? [];
      if (!canFacilitate(roles) && !canAudit(roles)) {
        throw new Error("Your account does not currently have a BIS staff role.");
      }

      setSession({ identity: payload.identity, roles });
      setPerspective(canFacilitate(roles) ? "facilitator" : "audit");
      setVisible(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your staff workspace could not be opened.");
    } finally {
      setLoading(false);
    }
  }

  if (!visible || !session) {
    return (
      <main className="staff-gate">
        <section className="staff-gate-card" aria-labelledby="staff-gate-title">
          <div className="staff-gate-mark" aria-hidden="true">BIS</div>
          <p className="staff-gate-eyebrow">Restricted staff workspace</p>
          <h1 id="staff-gate-title">Facilitator and Audit Workspace</h1>
          <p className="staff-gate-copy">
            Open this workspace only when you are ready to review programme operations. Learner private wording is not shown here.
          </p>
          <div className="staff-gate-privacy">
            <ShieldCheck aria-hidden="true" />
            <p><strong>Privacy first.</strong> The workspace hides automatically after two minutes of inactivity or when this tab is backgrounded.</p>
          </div>
          {error ? <p className="staff-gate-error" role="alert">{error}</p> : null}
          <button className="staff-gate-primary" type="button" onClick={() => void openWorkspace()} disabled={loading}>
            <LockKeyhole aria-hidden="true" />
            <span>{loading ? "Opening workspace…" : "Open staff workspace"}</span>
          </button>
          <Link className="staff-gate-secondary" href="/habit">Open learner experience instead</Link>
        </section>
      </main>
    );
  }

  const facilitatorAvailable = canFacilitate(session.roles);
  const auditAvailable = canAudit(session.roles);

  return (
    <div className="staff-workspace-shell">
      <header className="staff-workspace-header">
        <Link className="staff-workspace-brand" href="/workspace" aria-label="BIS staff workspace home">
          <span>BIS</span>
          <div><strong>Behaviour Intelligence Series™</strong><small>Staff workspace</small></div>
        </Link>
        <div className="staff-workspace-actions">
          <span className="staff-workspace-identity">{session.identity.email}</span>
          <Link className="staff-workspace-learner-link" href="/habit">Learner experience</Link>
          <button type="button" className="staff-workspace-hide" onClick={() => setVisible(false)}>
            <EyeOff aria-hidden="true" /> Hide workspace
          </button>
        </div>
      </header>

      <nav className="staff-workspace-switcher" aria-label="Staff workspace views">
        {facilitatorAvailable ? (
          <button
            type="button"
            className={perspective === "facilitator" ? "active" : ""}
            onClick={() => setPerspective("facilitator")}
            aria-current={perspective === "facilitator" ? "page" : undefined}
          >
            <LayoutDashboard aria-hidden="true" />
            <span><strong>Facilitator View</strong><small>Cohorts, learner summaries and support</small></span>
          </button>
        ) : null}
        {auditAvailable ? (
          <button
            type="button"
            className={perspective === "audit" ? "active" : ""}
            onClick={() => setPerspective("audit")}
            aria-current={perspective === "audit" ? "page" : undefined}
          >
            <Search aria-hidden="true" />
            <span><strong>Audit View</strong><small>Evidence, formulas and provenance</small></span>
          </button>
        ) : null}
      </nav>

      <main className="staff-workspace-main">
        <OperationsView initialRoles={session.roles} perspective={perspective} />
      </main>
    </div>
  );
}
