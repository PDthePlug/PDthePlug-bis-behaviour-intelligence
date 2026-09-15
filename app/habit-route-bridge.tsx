"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";

export type RequestedHabitView = "lab" | "experiment";

const labels: Record<RequestedHabitView, string> = {
  lab: "My Lab",
  experiment: "Today",
};

function requestedView(): RequestedHabitView | null {
  const value = new URLSearchParams(window.location.search).get("view");
  return value === "lab" || value === "experiment" ? value : null;
}

function safeReturnPath() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

const subscribeToLocation = () => () => undefined;

export function HabitRouteBridge({
  target,
  returnTo,
  hideReturnLink = false,
}: {
  target?: RequestedHabitView;
  returnTo?: string;
  hideReturnLink?: boolean;
}) {
  const queryTarget = useSyncExternalStore(subscribeToLocation, requestedView, () => null);
  const queryReturn = useSyncExternalStore(subscribeToLocation, safeReturnPath, () => null);
  const resolvedTarget = target ?? queryTarget;
  const resolvedReturn = returnTo ?? queryReturn;

  useEffect(() => {
    if (!resolvedTarget) return;

    let finished = false;
    const openRequestedView = () => {
      if (finished) return true;
      const expected = labels[resolvedTarget];
      const button = [...document.querySelectorAll<HTMLButtonElement>(".sidebar-nav button")]
        .find((candidate) => candidate.textContent?.replace(/\s+/g, " ").trim().startsWith(expected));
      if (!button) return false;
      finished = true;
      button.click();
      return true;
    };

    if (openRequestedView()) return;
    const observer = new MutationObserver(() => {
      if (openRequestedView()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [resolvedTarget]);

  if (hideReturnLink || !resolvedReturn) return null;
  return <Link href={resolvedReturn} className="fixed bottom-5 right-5 z-[140] flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-xs font-semibold text-[#173f35] shadow-xl shadow-black/10"><ArrowLeft className="size-4"/>Return to programme</Link>;
}
