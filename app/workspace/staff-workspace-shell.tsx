"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  Eye,
  EyeOff,
  LayoutDashboard,
  LockKeyhole,
  Settings2,
} from "lucide-react";
import { OperationsView } from "../operations-view";

type Perspective = "facilitator" | "outcomes" | "admin";

type StaffSession = {
  identity: { email: string; displayName: string };
  roles: string[];
};

function canFacilitate(roles: string[]) {
  return roles.includes("FACILITATOR");
}

function canViewOutcomes(roles: string[]) {
  return roles.includes("SPONSOR_VIEWER") || roles.includes("SYSTEM_ADMIN");
}

function canAdminister(roles: string[]) {
  return roles.includes("SYSTEM_ADMIN");
}

function defaultPerspective(roles: string[]): Perspective {
  if (canFacilitate(roles)) return "facilitator";
  if (roles.includes("SPONSOR_VIEWER")) return "outcomes";
  return "admin";
}

export function StaffWorkspaceShell() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [perspective, setPerspective] = useState<Perspective>("facilitator");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/staff", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as StaffSession & { error?: string };
        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? "This account does not have a BIS staff role."
              : payload.error || "The staff workspace could not be opened.",
          );
        }
        if (controller.signal.aborted) return;
        const roles = payload.roles ?? [];
        setSession({ identity: payload.identity, roles });
        setPerspective(defaultPerspective(roles));
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "The staff workspace could not be opened.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

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
          <div className="staff-gate-mark" aria-hidden="true">BIS</div>
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
          <div className="staff-gate-mark" aria-hidden="true">BIS</div>
          <p className="staff-gate-eyebrow">Staff access</p>
          <h1>Workspace unavailable</h1>
          <p className="staff-gate-error" role="alert">{error}</p>
          <Link className="staff-gate-secondary" href="/profile">Back to profile</Link>
        </section>
      </main>
    );
  }

  if (hidden) {
    return (
      <main className="staff-gate">
        <section className="staff-gate-card">
          <div className="staff-gate-mark" aria-hidden="true">BIS</div>
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

  return (
    <div className="staff-workspace-shell">
      <header className="staff-workspace-header">
        <Link className="staff-workspace-brand" href="/workspace" aria-label="BIS staff workspace home">
          <span>BIS</span>
          <div><strong>Behaviour Intelligence Series™</strong><small>Programme workspace</small></div>
        </Link>
        <div className="staff-workspace-actions">
          <span className="staff-workspace-identity">{session.identity.email}</span>
          <Link className="staff-workspace-learner-link" href="/profile">Profile</Link>
          <Link className="staff-workspace-learner-link" href="/habit">Learner experience</Link>
          <button type="button" className="staff-workspace-hide" onClick={() => setHidden(true)}>
            <EyeOff aria-hidden="true" /> Hide
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
            <span><strong>Facilitator</strong></span>
          </button>
        ) : null}
        {outcomesAvailable ? (
          <button
            type="button"
            className={perspective === "outcomes" ? "active" : ""}
            onClick={() => setPerspective("outcomes")}
            aria-current={perspective === "outcomes" ? "page" : undefined}
          >
            <Activity aria-hidden="true" />
            <span><strong>Programme Outcomes</strong></span>
          </button>
        ) : null}
        {adminAvailable ? (
          <button
            type="button"
            className={perspective === "admin" ? "active" : ""}
            onClick={() => setPerspective("admin")}
            aria-current={perspective === "admin" ? "page" : undefined}
          >
            <Settings2 aria-hidden="true" />
            <span><strong>BIS Administrator</strong></span>
          </button>
        ) : null}
      </nav>

      <main className="staff-workspace-main">
        <OperationsView initialRoles={session.roles} perspective={perspective} />
      </main>
    </div>
  );
}
