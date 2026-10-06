"use client";

import { BisMark } from "@/components/brand/bis-mark";
import {
  applyPersonalisation,
  loadLocalPersonalisation,
} from "@/lib/learner-personalization";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  FlaskConical,
  House,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

type ShellStage = "today" | "learn" | "lab" | "experiment" | "portfolio" | "profile";

const stageLabels: Record<ShellStage, string> = {
  today: "Today",
  learn: "Learn",
  lab: "Lab",
  experiment: "Experiment",
  portfolio: "Evidence Portfolio",
  profile: "Profile",
};

function resolveStage(pathname: string, section: string | null, previewKind: string | null): ShellStage {
  if (pathname.startsWith("/content-studio/preview/")) {
    if (previewKind === "LEARNING_MODULE") return "learn";
    if (previewKind === "LAB") return "lab";
  }
  if (pathname.startsWith("/portfolio")) return "portfolio";
  if (pathname.startsWith("/profile") || pathname.startsWith("/settings") || pathname === "/experience") return "profile";
  if (pathname.startsWith("/learn") || pathname.startsWith("/handbooks/")) return "learn";
  if (pathname.startsWith("/labs")) return "lab";
  if (pathname.startsWith("/habit-lab/experiment")) return "experiment";
  if (pathname.startsWith("/habit-lab")) return "lab";
  if (pathname.startsWith("/decision") || pathname.startsWith("/money")) return "lab";
  if (section === "learn") return "learn";
  return "today";
}

export function CanonicalAdaptiveShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stage = resolveStage(pathname, searchParams.get("section"), searchParams.get("kind"));
  const [menuOpen, setMenuOpen] = useState(false);
  const experimentHref = pathname.startsWith("/decision")
    ? "/decision?step=7"
    : pathname.startsWith("/money")
      ? "/money?step=7"
      : "/habit-lab/experiment";
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const menuItems = useMemo(
    () => [
      {
        id: "today" as const,
        label: "Today",
        detail: "Your next step",
        href: "/habit",
        icon: House,
      },
      {
        id: "learn" as const,
        label: "Learn",
        detail: "Browse handbooks",
        href: "/learn",
        icon: BookOpen,
      },
      {
        id: "lab" as const,
        label: "Lab",
        detail: "Browse investigations",
        href: "/labs",
        icon: FlaskConical,
      },
      {
        id: "experiment" as const,
        label: "Experiment",
        detail: "Your seven-day real-world test",
        href: experimentHref,
        icon: CalendarDays,
      },
      {id:"portfolio" as const,label:"Evidence Portfolio",detail:"Your evidence and development over time",href:"/portfolio",icon:BookOpen},
      {
        id: "profile" as const,
        label: "Profile",
        detail: "Account and sign out",
        href: "/profile",
        icon: UserRound,
      },
    ],
    [experimentHref],
  );

  useEffect(() => {
    const local = loadLocalPersonalisation();
    if (local) applyPersonalisation(local);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
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
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',
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
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => trigger?.focus());
    };
  }, [menuOpen]);

  return (
    <div className="canonical-shell" data-stage={stage}>
      <a className="canonical-skip" href="#bis-task-surface">
        Skip to current task
      </a>

      <header className="canonical-topbar">
        <Link className="canonical-brand" href="/habit" aria-label="BIS Today">
          <span><BisMark /></span>
          <div>
            <strong>Behaviour Intelligence Series™</strong>
            <small>Applied Commerce®</small>
          </div>
        </Link>
      </header>

      <div id="bis-task-surface" className="canonical-task" tabIndex={-1}>
        {children}
      </div>

      <button
        ref={triggerRef}
        type="button"
        className="canonical-menu-trigger"
        onClick={() => setMenuOpen(true)}
        aria-label={`Open BIS menu · current area ${stageLabels[stage]}`}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
      >
        <Menu />
        <span>Menu</span>
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="canonical-scrim"
            aria-label="Close BIS menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="canonical-menu open"
            role="dialog"
            aria-modal="true"
            aria-label="BIS learner menu"
          >
            <div className="canonical-menu-head">
              <div>
                <span><BisMark /></span>
                <div>
                  <strong>Behaviour Intelligence Series™</strong>
                  <small>Learner menu</small>
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close BIS menu"
              >
                <X />
              </button>
            </div>
            <nav className="canonical-menu-items" aria-label="BIS learner destinations">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    className={stage === item.id ? "active" : ""}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={stage === item.id ? "page" : undefined}
                  >
                    <Icon />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      ) : null}

    </div>
  );
}
