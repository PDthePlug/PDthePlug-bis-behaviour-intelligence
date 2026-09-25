"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

type AccessSnapshot = {
  roles?: string[];
  profile?: { deliveryEdition?: string } | null;
  error?: string;
};

const STAFF_ROLES = new Set(["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER", "SPONSOR_VIEWER", "PROGRAMME_OWNER"]);

export function RoleRouter() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/bis", {
          cache: "no-store",
          signal: controller.signal,
        });
        const snapshot = (await response.json()) as AccessSnapshot;
        if (!response.ok) {
          throw new Error(snapshot.error || "Your BIS access profile could not be loaded.");
        }
        if (controller.signal.aborted) return;
        const staff = (snapshot.roles ?? []).some((role) => STAFF_ROLES.has(role));
        router.replace(staff ? "/workspace" : "/habit");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Your BIS access profile could not be loaded.");
        }
      }
    })();
    return () => controller.abort();
  }, [router]);

  if (error) {
    return (
      <main className="learning-state">
        <ShieldCheck />
        <h1>BIS could not resolve your dashboard.</h1>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }

  return (
    <main className="learning-state">
      <span className="learning-loader" />
      <h1>Opening BIS…</h1>
      <p>Resolving your role and learner profile.</p>
    </main>
  );
}
