"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, FlaskConical } from "lucide-react";
import {
  BIS_MODULES,
  BIS_VOLUMES,
  isModuleOpen,
  moduleHref,
  type BISVolume,
} from "@/lib/bis-catalogue";

type LibraryMode = "learning" | "lab";

function statusLabel(
  mode: LibraryMode,
  status: "live" | "source_ready" | "catalogued" | "planned",
) {
  if (status === "live") return "Open";
  if (mode === "learning" && status === "source_ready") return "Coming next";
  return "Coming soon";
}

export function ModuleLibrary({ mode }: { mode: LibraryMode }) {
  const [volume, setVolume] = useState<BISVolume>(1);
  const modules = useMemo(
    () => BIS_MODULES.filter((module) => module.volume === volume),
    [volume],
  );
  const title = mode === "learning" ? "Learning library" : "Lab library";
  const intro =
    mode === "learning"
      ? "Choose a handbook to open or continue."
      : "Choose an investigation.";

  return (
    <main className="bis-library-page">
      <section className="bis-library-hero">
        <div>
          <p className="bis-library-eyebrow">Behaviour Intelligence Series™</p>
          <h1>{title}.</h1>
          <p>{intro}</p>
        </div>
        <div className="bis-library-count" aria-label="BIS catalogue size">
          <strong>32</strong>
          <span>{mode === "learning" ? "handbooks" : "Labs"}</span>
        </div>
      </section>

      <nav className="bis-volume-tabs" aria-label="BIS volumes">
        {BIS_VOLUMES.map((item) => (
          <button
            key={item.volume}
            type="button"
            className={volume === item.volume ? "active" : ""}
            onClick={() => setVolume(item.volume)}
            aria-pressed={volume === item.volume}
          >
            <span>Volume {item.volume}</span>
            <small>{item.count}</small>
          </button>
        ))}
      </nav>

      <div className="bis-volume-heading">
        <div>
          <p>Volume {volume}</p>
          <h2>{BIS_VOLUMES.find((item) => item.volume === volume)?.title}</h2>
        </div>
        <span>{modules.length} {mode === "learning" ? "handbooks" : "Labs"}</span>
      </div>

      <section className="bis-module-grid" aria-label={title}>
        {modules.map((module) => {
          const status = mode === "learning" ? module.learningStatus : module.labStatus;
          const open = isModuleOpen(module, mode);
          const href = moduleHref(module, mode);
          const Icon = mode === "learning" ? BookOpen : FlaskConical;

          const body = (
            <>
              <div className="bis-module-card-top">
                <span>{String(module.global).padStart(2, "0")}</span>
                <Icon aria-hidden="true" />
              </div>
              <div className="bis-module-card-copy">
                <small>Volume {module.volume} · {mode === "learning" ? "Handbook" : "Lab"} {module.position}</small>
                <h3>{module.title}</h3>
              </div>
              <div className="bis-module-card-foot">
                <span className={open ? "open" : ""}>{statusLabel(mode, status)}</span>
                {open ? <ArrowRight aria-hidden="true" /> : null}
              </div>
            </>
          );

          return open && href ? (
            <Link className="bis-module-card" href={href} key={module.code}>
              {body}
            </Link>
          ) : (
            <article className="bis-module-card unavailable" key={module.code} aria-disabled="true">
              {body}
            </article>
          );
        })}
      </section>
    </main>
  );
}
