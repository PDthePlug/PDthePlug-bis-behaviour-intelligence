"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, FlaskConical, LifeBuoy, LockKeyhole, Menu, ShieldCheck, X } from "lucide-react";

type LabSlug = "decision" | "money";

type LabShellDefinition = {
  title: string;
  shortTitle: string;
  focus: string;
  accent: string;
};

const definitions: Record<LabSlug, LabShellDefinition> = {
  decision: {
    title: "Decision Lab",
    shortTitle: "Decision",
    focus: "A guided investigation into how you make decisions under real conditions.",
    accent: "#c9684d",
  },
  money: {
    title: "Money Lab",
    shortTitle: "Money",
    focus: "A guided investigation into how spending behaviour changes across real situations.",
    accent: "#a7782e",
  },
};

const labs = [
  {
    href: "/habit",
    label: "Habit Programme",
    detail: "Day-by-day learning, Habit Lab and the seven-day experiment",
    icon: BookOpen,
  },
  {
    href: "/decision",
    label: "Decision Lab",
    detail: "Nine investigations and a seven-day decision experiment",
    icon: FlaskConical,
  },
  {
    href: "/money",
    label: "Money Lab",
    detail: "Nine investigations and a seven-day spending experiment",
    icon: FlaskConical,
  },
];

export function MultiLabAdaptiveShell({ lab, children }: { lab: LabSlug; children: React.ReactNode }) {
  const definition = definitions[lab];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const activeHref = useMemo(() => `/${lab}`, [lab]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(".multi-lab-menu");
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')];
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
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
  }, [menuOpen]);

  return (
    <div className="multi-lab-shell" style={{ "--multi-lab-accent": definition.accent } as React.CSSProperties}>
      <a className="multi-lab-skip" href="#multi-lab-task-surface">Skip to current Lab task</a>

      <header className="multi-lab-topbar">
        <Link className="multi-lab-brand" href="/habit" aria-label="BIS learner home">
          <span>B</span>
          <div><strong>BIS</strong><small>Behaviour Intelligence Series</small></div>
        </Link>
        <div className="multi-lab-context" aria-label="Current learner context">
          <span>Learner View</span><strong>{definition.title}</strong>
        </div>
        <button ref={menuButtonRef} className="multi-lab-menu-button" type="button" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <Menu /> <span>Labs</span>
        </button>
      </header>

      <section className="multi-lab-orientation" aria-label="Screen guide">
        <div><span>Where you are</span><strong>{definition.title}</strong></div>
        <div><span>What this means</span><p>{definition.focus}</p></div>
        <div><span>Do now</span><p>Continue the investigation or experiment step shown below.</p></div>
        <div><span>What happens next</span><p>The next step opens as you complete the current one. Real-world experiment days remain calendar-gated.</p></div>
        <div><span>Where to get help</span><p>Use the Lab guide and privacy cues without exposing your private responses.</p></div>
      </section>

      <details className="multi-lab-mobile-guide">
        <summary><LifeBuoy /> Screen guide</summary>
        <div><strong>Meaning</strong><p>{definition.focus}</p></div>
        <div><strong>Do now</strong><p>Continue the task shown below.</p></div>
        <div><strong>Next</strong><p>Your next investigation opens when the current one is complete.</p></div>
        <div><strong>Privacy</strong><p>Your responses stay inside this Lab unless a staff-safe progress signal is explicitly designed to leave it.</p></div>
      </details>

      <section className="multi-lab-route-banner" aria-label="Lab journey">
        <div>
          <p>Volume 1 · Applied Commerce®</p>
          <h1>{definition.title}</h1>
          <span>{definition.focus}</span>
        </div>
        <div className="multi-lab-journey" aria-label="Lab journey stages">
          <span><CheckCircle2 /> Investigate</span><ArrowRight /><span><FlaskConical /> Experiment</span><ArrowRight /><span><ShieldCheck /> Review</span>
        </div>
      </section>

      <main id="multi-lab-task-surface" className="multi-lab-task-surface">{children}</main>

      {menuOpen && (
        <>
          <button className="multi-lab-scrim" type="button" aria-label="Close Lab menu" onClick={() => setMenuOpen(false)} />
          <section className="multi-lab-menu" role="dialog" aria-modal="true" aria-label="BIS Labs">
            <header><div><p>Behaviour Intelligence Series</p><h2>Choose your Lab</h2></div><button ref={closeButtonRef} type="button" aria-label="Close Lab menu" onClick={() => setMenuOpen(false)}><X /></button></header>
            <div className="multi-lab-menu-list">
              {labs.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                return <Link key={item.href} className={active ? "active" : ""} href={item.href} onClick={() => setMenuOpen(false)}><Icon /><span><strong>{item.label}</strong><small>{item.detail}</small></span>{active && <em>Current</em>}</Link>;
              })}
            </div>
            <div className="multi-lab-menu-privacy"><LockKeyhole /><p>Each Lab keeps its own evidence record. Switching Labs does not merge or rewrite your responses.</p></div>
          </section>
        </>
      )}
    </div>
  );
}
