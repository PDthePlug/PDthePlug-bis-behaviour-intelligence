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
        const response = await fetch("/api/profile", {
          cache: "no-store",
          signal: controller.signal,
        });
        const snapshot = (await response.json()) as AccessSnapshot;
        if (!response.ok) {
          throw new Error("We couldn't open your BIS workspace. Please try again.");
        }
        if (controller.signal.aborted) return;
        const staff = (snapshot.roles ?? []).some((role) => STAFF_ROLES.has(role));
        router.replace(staff ? "/workspace" : "/habit");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "We couldn't open your BIS workspace. Please try again.");
        }
      }
    })();
    return () => controller.abort();
  }, [router]);

  if (error) {
    return (
      <main className="learning-state">
        <ShieldCheck />
        <h1>We couldn&apos;t open your BIS workspace.</h1>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }

  return (
    <main className="learning-state">
      <span className="learning-loader" />
      <h1>Opening BIS…</h1>
      <p>Getting your learning and programme access ready.</p>
    </main>
  );
}
