"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/runtime-catalogue", { cache: "no-store", signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Catalogue unavailable"); return response.json(); })
      .then((data) => {
        if (!Array.isArray(data?.items) || data.items.some((item: RuntimeCatalogueItem) => !item || !["LEARNING_MODULE", "LAB"].includes(item.kind) || typeof item.code !== "string" || typeof item.live !== "boolean")) throw new Error("Catalogue unavailable");
        if (!controller.signal.aborted) setRuntimeItems(data.items);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
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

      {loading ? <p role="status" className="bis-library-notice">Checking what is available…</p> : null}
      {error ? <div role="alert" className="bis-library-notice"><p>We couldn’t check which titles are available. Please try again.</p><button type="button" onClick={() => { setLoading(true); setError(false); setRetry(value => value + 1); }}>Try again</button></div> : null}
      <section className="bis-module-grid" aria-label={title} aria-busy={loading}>
        {modules.map((item) => {
          const status = mode === "learning" ? item.learningStatus : item.labStatus;
          const runtime = runtimeItems.find((entry) =>
            entry.code === item.code &&
            entry.kind === (mode === "learning" ? "LEARNING_MODULE" : "LAB"),
          );
          const dynamic = runtime?.runtimeMode === "DYNAMIC";
          const open = !loading && !error && Boolean(runtime?.live && (dynamic ? runtime.routePath : isModuleOpen(item, mode)));
          const href = dynamic ? runtime?.routePath ?? null : moduleHref(item, mode);
          const displayStatus = open ? "live" : status === "live" ? "catalogued" : status;
          const liveLabRuntime = runtimeItems.find((entry) =>
            entry.code === item.code &&
            entry.kind === "LAB" &&
            entry.live &&
            Boolean(entry.routePath),
          );
          const labConnected = Boolean(liveLabRuntime);

          const body = (
            <>
              <div className="bis-module-card-copy">
                <h3>{item.title}</h3>
              </div>
              <div className="bis-module-card-foot">
                <div>
                  <span className={open ? "open" : ""}>{loading ? "Checking availability" : error ? "Availability unknown" : statusLabel(mode, displayStatus)}</span>
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
