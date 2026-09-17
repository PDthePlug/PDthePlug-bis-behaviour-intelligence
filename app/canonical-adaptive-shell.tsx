"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CalendarDays, ChevronRight, FlaskConical, House, LifeBuoy, Menu, ShieldCheck, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

type ShellStage = "today" | "learn" | "lab" | "experiment";

type Guidance = {
  label: string;
  meaning: string;
  now: string;
  next: string;
};

const guidance: Record<ShellStage, Guidance> = {
  today: {
    label: "Today",
    meaning: "Your current BIS programme position and the task that matters now.",
    now: "Continue the highlighted task.",
    next: "BIS keeps your place as you move into learning, the Lab or your field experiment.",
  },
  learn: {
    label: "Learn",
    meaning: "Your handbooks, programme map and learning responses.",
    now: "Continue from your current programme position.",
    next: "When a live investigation is required, BIS hands you into the Lab without duplicating evidence.",
  },
  lab: {
    label: "Lab",
    meaning: "Your focused Habit Lab investigation workspace.",
    now: "Complete the current investigation step using only what you can observe or recall honestly.",
    next: "Your recorded Lab inputs prepare the field experiment and remain separate from workbook responses.",
  },
  experiment: {
    label: "Experiment",
    meaning: "Your real-world evidence window for the Habit investigation.",
    now: "Record only evidence from a day you have actually experienced.",
    next: "When the evidence window closes, BIS moves you into review without rewriting earlier observations.",
  },
};

function resolveStage(pathname: string, section: string | null): ShellStage {
  if (pathname.startsWith("/habit-lab/experiment")) return "experiment";
  if (pathname.startsWith("/habit-lab")) return "lab";
  if (section === "learn") return "learn";
  return "today";
}

export function CanonicalAdaptiveShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stage = resolveStage(pathname, searchParams.get("section"));
  const guide = guidance[stage];
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const menuItems = useMemo(
    () => [
      { id: "today" as const, label: "Today", detail: "What needs your attention now", href: "/habit", icon: House },
      { id: "learn" as const, label: "Learn", detail: "Handbooks, programme map and workbook", href: "/habit?section=learn", icon: BookOpen },
      { id: "lab" as const, label: "Lab", detail: "Habit Lab Phase A and investigation record", href: "/habit-lab", icon: FlaskConical },
      { id: "experiment" as const, label: "Experiment", detail: "Seven-day field evidence", href: "/habit-lab/experiment", icon: CalendarDays },
    ],
    [],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(".canonical-menu");
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, [menuOpen]);

  return (
    <div className="canonical-shell" data-stage={stage}>
      <a className="canonical-skip" href="#bis-task-surface">Skip to current task</a>

      <header className="canonical-topbar">
        <Link className="canonical-brand" href="/habit" aria-label="BIS Today">
          <span>BIS</span>
          <div><strong>Behaviour Intelligence Series™</strong><small>Habit programme</small></div>
        </Link>
        <div className="canonical-location" aria-label="Current BIS location">
          <span>Learner View</span><ChevronRight /><strong>{guide.label}</strong>
        </div>
      </header>

      <section className="canonical-orientation" aria-label="Screen orientation">
        <div><span>Where you are</span><strong>Learner View · {guide.label}</strong></div>
        <div><span>What this means</span><p>{guide.meaning}</p></div>
        <div><span>Do now</span><p>{guide.now}</p></div>
        <div><span>Next</span><p>{guide.next}</p></div>
        <div className="canonical-help"><LifeBuoy /><span><strong>Need help?</strong><small>Return to Today for the recommended next action. In a facilitated programme, ask your facilitator for support.</small></span></div>
      </section>

      <details className="canonical-mobile-guide">
        <summary><LifeBuoy /> Screen guide <ChevronRight /></summary>
        <div><span>What this means</span><p>{guide.meaning}</p></div>
        <div><span>Do now</span><p>{guide.now}</p></div>
        <div><span>Next</span><p>{guide.next}</p></div>
        <div><span>Help</span><p>Return to Today for the recommended next action. In a facilitated programme, ask your facilitator for support.</p></div>
      </details>

      <div id="bis-task-surface" className="canonical-task" tabIndex={-1}>{children}</div>

      {menuOpen ? (
        <>
          <button type="button" className="canonical-scrim" aria-label="Close BIS menu" onClick={() => setMenuOpen(false)} />
          <div className="canonical-menu open" role="dialog" aria-modal="true" aria-label="BIS learner menu">
            <div className="canonical-menu-head">
              <div><span>BIS</span><div><strong>Behaviour Intelligence Series™</strong><small>One programme. One learner shell.</small></div></div>
              <button ref={closeRef} type="button" onClick={() => setMenuOpen(false)} aria-label="Close BIS menu"><X /></button>
            </div>
            <nav className="canonical-menu-items" aria-label="BIS learner destinations">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return <Link key={item.id} className={stage === item.id ? "active" : ""} href={item.href} onClick={() => setMenuOpen(false)} aria-current={stage === item.id ? "page" : undefined}><Icon /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>;
              })}
            </nav>
            <div className="canonical-menu-foot"><ShieldCheck /><span>Learning responses, formal Lab inputs and experiment evidence remain separate records.</span></div>
          </div>
        </>
      ) : null}

      <button ref={triggerRef} type="button" className="canonical-menu-trigger" onClick={() => setMenuOpen(true)} aria-label="Open BIS menu" aria-expanded={menuOpen}><Menu /><span>Menu</span></button>
    </div>
  );
}
