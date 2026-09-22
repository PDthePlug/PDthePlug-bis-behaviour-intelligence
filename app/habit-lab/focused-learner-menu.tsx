"use client";

import { BisMark } from "@/components/brand/bis-mark";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, FlaskConical, House, Menu, X } from "lucide-react";
import type { RequestedHabitView } from "../habit-route-bridge";

export function FocusedLearnerMenu({ active }: { active: RequestedHabitView }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? (
        <button
          type="button"
          className="prototype-menu-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close BIS menu"
        />
      ) : null}
      <nav className={`prototype-bottom-sheet ${open ? "open" : ""}`} aria-label="BIS learner menu">
        <div className="prototype-bottom-sheet-head">
          <div>
            <span><BisMark /></span>
            <div><strong>Behaviour Intelligence Series™</strong><small>Applied Commerce®</small></div>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close BIS menu"><X /></button>
        </div>
        <div className="prototype-menu-items">
          <Link href="/habit"><House /><span><strong>Today</strong><small>What needs your attention now</small></span></Link>
          <Link href="/learn"><BookOpen /><span><strong>Learn</strong><small>Browse handbooks</small></span></Link>
          <Link className={active === "lab" ? "active" : ""} href="/labs"><FlaskConical /><span><strong>Lab</strong><small>Browse investigations</small></span></Link>
          <Link className={active === "experiment" ? "active" : ""} href="/habit-lab/experiment"><CalendarDays /><span><strong>Experiment</strong><small>Seven-day field evidence</small></span></Link>
        </div>
      </nav>
      <button
        type="button"
        className="prototype-bottom-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open BIS menu"
        aria-expanded={open}
      >
        <Menu /><span>Menu</span>
      </button>
    </>
  );
}

