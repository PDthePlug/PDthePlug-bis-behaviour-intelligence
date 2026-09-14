"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

type RequestedView = "lab" | "experiment";

const labels: Record<RequestedView, string> = {
  lab: "My Lab",
  experiment: "Today",
};

function requestedView(): RequestedView | null {
  const value = new URLSearchParams(window.location.search).get("view");
  return value === "lab" || value === "experiment" ? value : null;
}

function safeReturnPath() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  return value?.startsWith("/learning/") ? value : null;
}

export function HabitRouteBridge() {
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    const target = requestedView();
    setReturnTo(safeReturnPath());
    if (!target) return;

    let finished = false;
    const openRequestedView = () => {
      if (finished) return true;
      const expected = labels[target];
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
  }, []);

  if (!returnTo) return null;
  return <Link href={returnTo} className="fixed bottom-5 right-5 z-[140] flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-xs font-semibold text-[#173f35] shadow-xl shadow-black/10"><ArrowLeft className="size-4"/>Return to programme</Link>;
}
