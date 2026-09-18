"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, FlaskConical, Menu, UserRound, X } from "lucide-react";

type LabSlug = "decision" | "money";

type LabShellDefinition = {
  title: string;
  accent: string;
};

const definitions: Record<LabSlug, LabShellDefinition> = {
  decision: {
    title: "Decision Lab",
    accent: "#c9684d",
  },
  money: {
    title: "Money Lab",
    accent: "#a7782e",
  },
};

const destinations = [
  {
    href: "/habit",
    label: "Today",
    detail: "Resume your current journey",
    icon: BookOpen,
  },
  {
    href: "/learn",
    label: "Learn",
    detail: "Browse handbooks",
    icon: BookOpen,
  },
  {
    href: "/labs",
    label: "Lab",
    detail: "Browse investigations",
    icon: FlaskConical,
  },
  {
    href: "/profile",
    label: "Profile",
    detail: "Account and sign out",
    icon: UserRound,
  },
];

export function MultiLabAdaptiveShell({ lab, children }: { lab: LabSlug; children: React.ReactNode }) {
  const definition = definitions[lab];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const activeHref = "/labs";

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
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
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ];
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
      window.requestAnimationFrame(() => menuButton?.focus());
    };
  }, [menuOpen]);

  return (
    <div
      className="multi-lab-shell"
      style={{ "--multi-lab-accent": definition.accent } as React.CSSProperties}
    >
      <a className="multi-lab-skip" href="#multi-lab-task-surface">
        Skip to current Lab task
      </a>

      <header className="multi-lab-topbar">
        <Link className="multi-lab-brand" href="/habit" aria-label="BIS learner home">
          <span>B</span>
          <div>
            <strong>BIS</strong>
            <small>Behaviour Intelligence Series</small>
          </div>
        </Link>
        <div className="multi-lab-context" aria-label="Current Lab">
          <strong>{definition.title}</strong>
        </div>
        <button
          ref={menuButtonRef}
          className="multi-lab-menu-button"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu /> <span>Menu</span>
        </button>
      </header>

      <main id="multi-lab-task-surface" className="multi-lab-task-surface">
        {children}
      </main>

      {menuOpen ? (
        <>
          <button
            className="multi-lab-scrim"
            type="button"
            aria-label="Close BIS menu"
            onClick={() => setMenuOpen(false)}
          />
          <section
            className="multi-lab-menu"
            role="dialog"
            aria-modal="true"
            aria-label="BIS learner menu"
          >
            <header>
              <div>
                <p>Behaviour Intelligence Series</p>
                <h2>BIS menu</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close BIS menu"
                onClick={() => setMenuOpen(false)}
              >
                <X />
              </button>
            </header>
            <div className="multi-lab-menu-list">
              {destinations.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    className={active ? "active" : ""}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                    {active ? <em>Current</em> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
