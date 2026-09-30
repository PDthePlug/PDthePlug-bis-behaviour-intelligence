"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, FlaskConical } from "lucide-react";
import {
  BIS_MODULES,
  BIS_PRODUCT_SCOPE,
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
  if (status === "source_ready") return mode === "lab" ? "Digital access pending" : "Source ready";
  return "Coming soon";
}

type RuntimeCatalogueItem = {
  kind: "LEARNING_MODULE" | "LAB";
  code: string;
  routePath: string | null;
  runtimeMode: "STATIC" | "DYNAMIC" | null;
  version: string;
  live: boolean;
};

export function ModuleLibrary({ mode }: { mode: LibraryMode }) {
  const [volume, setVolume] = useState<BISVolume>(1);
  const [runtimeItems, setRuntimeItems] = useState<RuntimeCatalogueItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/runtime-catalogue", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((data) => {
        if (!controller.signal.aborted) setRuntimeItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const modules = useMemo(
    () => BIS_MODULES.filter((item) => item.volume === volume),
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
          <strong>{BIS_PRODUCT_SCOPE}</strong>
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
        {modules.map((item) => {
          const status = mode === "learning" ? item.learningStatus : item.labStatus;
          const runtime = runtimeItems.find((entry) =>
            entry.code === item.code &&
            entry.kind === (mode === "learning" ? "LEARNING_MODULE" : "LAB") &&
            entry.live,
          );
          const dynamic = runtime?.runtimeMode === "DYNAMIC";
          const open = dynamic ? Boolean(runtime?.routePath) : isModuleOpen(item, mode);
          const href = dynamic ? runtime?.routePath ?? null : moduleHref(item, mode);
          const displayStatus = dynamic ? "live" : status;
          const liveLabRuntime = runtimeItems.find((entry) =>
            entry.code === item.code &&
            entry.kind === "LAB" &&
            entry.live &&
            Boolean(entry.routePath),
          );
          const labConnected =
            Boolean(liveLabRuntime) ||
            (item.labStatus === "live" && Boolean(item.labHref));
          const Icon = mode === "learning" ? BookOpen : FlaskConical;

          const body = (
            <>
              <div className="bis-module-card-top">
                <span>{String(item.global).padStart(2, "0")}</span>
                <Icon aria-hidden="true" />
              </div>
              <div className="bis-module-card-copy">
                <small>Volume {item.volume} · {mode === "learning" ? "Handbook" : "Lab"} {item.position}</small>
                <h3>{item.title}</h3>
              </div>
              <div className="bis-module-card-foot">
                <div>
                  <span className={open ? "open" : ""}>{statusLabel(mode, displayStatus)}</span>
                  {mode === "learning" && open ? (
                    <small className={labConnected ? "connected" : ""}>
                      {labConnected ? "Lab connected" : "Lab access pending"}
                    </small>
                  ) : null}
                </div>
                {open ? <ArrowRight aria-hidden="true" /> : null}
              </div>
            </>
          );

          return open && href ? (
            <Link className="bis-module-card" href={href} key={item.code}>
              {body}
            </Link>
          ) : (
            <article className="bis-module-card unavailable" key={item.code} data-availability="unavailable">
              {body}
            </article>
          );
        })}
      </section>
    </main>
  );
}
