"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  FileArchive,
  FileCheck2,
  FileText,
  FlaskConical,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { BisMark } from "@/components/brand/bis-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  CONTENT_STUDIO_BUCKET,
  sourceFormatFor,
  type ContentKind,
  type ContentSourceFormat,
} from "@/lib/content-studio";

type CheckResult = {
  id: string;
  label: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
};

type ContentSourceFile = {
  id: string;
  versionId: string;
  sourceKey: string;
  deliveryEdition: string | null;
  sourceFormat: string;
  fileName: string;
  storagePath: string;
  sourceHash: string | null;
  sourceBytes: number;
  mimeType: string | null;
};

type RuntimeArtifact = {
  id: string;
  artifactKey: string;
  deliveryEdition: string | null;
  artifactHash: string;
  artifactBytes: number;
};

type ContentVersion = {
  id: string;
  itemId: string;
  version: string;
  schemaVersion: string;
  sourceFormat: string;
  sourceFileName: string | null;
  sourceStoragePath: string | null;
  sourceHash: string | null;
  sourceBytes: number | null;
  mimeType: string | null;
  deliveryEditions: string[];
  manifest: Record<string, unknown>;
  validationStatus: string;
  runtimeStatus: string;
  validationReport: {
    summary?: string;
    checks?: CheckResult[];
    activationReady?: boolean;
  };
  status: string;
  releaseNotes: string;
  compilerStatus: string;
  compilerReport: { summary?: string; requiredEditions?: string[]; artifactKeys?: string[] };
  compilerVersion: string | null;
  compiledAt: string | null;
  sourceFiles: ContentSourceFile[];
  artifacts: RuntimeArtifact[];
  createdAt: string;
  updatedAt: string;
};

type ContentItem = {
  id: string;
  kind: ContentKind;
  code: string;
  slug: string;
  title: string;
  summary: string;
  routePath: string | null;
  linkedLabItemId: string | null;
  status: string;
  activeActivation: null | {
    id: string;
    versionId: string;
    runtimeMode: "STATIC" | "DYNAMIC";
    status: string;
    activatedAt: string;
  };
  versions: ContentVersion[];
};

type StudioSnapshot = {
  metrics: {
    learningModules: number;
    labs: number;
    drafts: number;
    live: number;
    ready: number;
    compiled: number;
    activeDynamic: number;
  };
  items: ContentItem[];
};

function formatBytes(value: number | null | undefined) {
  if (!value) return "No file";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sourceLabel(value: string) {
  return value === "BIS_PACKAGE_JSON"
    ? "BIS package"
    : value === "SYSTEM"
      ? "Existing system content"
      : value;
}

function statusTone(value: string) {
  if (["LIVE", "PUBLISHED", "VALID", "READY", "APPROVED"].includes(value)) return "good";
  if (["BLOCKED", "INVALID"].includes(value)) return "bad";
  if (["REQUIRES_ADAPTER", "PENDING"].includes(value)) return "warn";
  return "neutral";
}

export function ContentStudio() {
  const [data, setData] = useState<StudioSnapshot | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingVersionId, setUploadingVersionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [kind, setKind] = useState<ContentKind>("LEARNING_MODULE");
  const [code, setCode] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [linkedLabItemId, setLinkedLabItemId] = useState("");
  const [version, setVersion] = useState("");
  const [schemaVersion, setSchemaVersion] = useState("1.0");
  const [sourceFormat, setSourceFormat] = useState<ContentSourceFormat>("BIS_PACKAGE_JSON");
  const [releaseNotes, setReleaseNotes] = useState("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [client] = useState(createClient);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/content-studio", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Content Studio could not open.");
      setData(payload);
      setSelectedItemId((current) => current || payload.items?.[0]?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Content Studio could not open.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/content-studio", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Content Studio could not open.");
        if (controller.signal.aborted) return;
        setData(payload);
        setSelectedItemId(payload.items?.[0]?.id || "");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Content Studio could not open.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  async function act(payload: Record<string, unknown>, success?: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/content-studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The content change could not be saved.");
      setData(result);
      if (success) setMessage(success);
      return result as StudioSnapshot;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The content change could not be saved.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  const activeItems = useMemo(
    () => data?.items.filter((item) => item.status === "ACTIVE") ?? [],
    [data],
  );
  const labItems = useMemo(
    () => activeItems.filter((item) => item.kind === "LAB"),
    [activeItems],
  );
  const selected = activeItems.find((item) => item.id === selectedItemId) ?? activeItems[0] ?? null;

  async function createItem() {
    const result = await act({
      action: "createItem",
      kind,
      code,
      slug,
      title,
      summary,
      linkedLabItemId: kind === "LEARNING_MODULE" ? linkedLabItemId || undefined : undefined,
    }, `${kind === "LAB" ? "Lab" : "Learning module"} added to the library.`);
    if (!result) return;
    const created = result.items.find((item) => item.kind === kind && item.code === code.trim().toUpperCase());
    if (created) setSelectedItemId(created.id);
    setCode("");
    setSlug("");
    setTitle("");
    setSummary("");
    setLinkedLabItemId("");
    setCreateOpen(false);
  }

  async function createVersion() {
    if (!selected) return;
    const result = await act({
      action: "createVersion",
      itemId: selected.id,
      version,
      schemaVersion,
      sourceFormat,
      releaseNotes,
    }, "Draft version created. Upload its source when ready.");
    if (!result) return;
    setVersion("");
    setSchemaVersion("1.0");
    setReleaseNotes("");
  }

  async function uploadSource(
    contentVersion: ContentVersion,
    sourceKey: "school" | "emerging_adult" | "workplace" | "lab",
    file: File,
  ) {
    const detected = sourceFormatFor(file.name, file.type);
    if (!detected) {
      setError("Choose a BIS package JSON, DOCX, PDF, HTML, Markdown or ZIP source.");
      return;
    }
    if (file.size > 26_214_400) {
      setError("Use a source file up to 25 MB.");
      return;
    }
    if (contentVersion.status !== "DRAFT") {
      setError("Reopen this version before replacing its source.");
      return;
    }

    const uploadKey = `${contentVersion.id}:${sourceKey}`;
    setUploadingVersionId(uploadKey);
    setError("");
    setMessage("");
    try {
      const safeName = file.name
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(-140) || "source";
      const storagePath = `sources/${contentVersion.id}/${sourceKey}/${safeName}`;
      const upload = await client.storage.from(CONTENT_STUDIO_BUCKET).upload(storagePath, file, {
        contentType: file.type || undefined,
        cacheControl: "0",
        upsert: true,
      });
      if (upload.error) throw new Error(upload.error.message || "The source upload failed.");

      const attached = await act({
        action: "attachSource",
        versionId: contentVersion.id,
        sourceKey,
        deliveryEdition: sourceKey === "lab" ? null : sourceKey,
        sourceFileName: file.name,
        sourceStoragePath: storagePath,
        sourceBytes: file.size,
        mimeType: file.type || null,
        sourceFormat: detected,
      });
      if (!attached) {
        await client.storage.from(CONTENT_STUDIO_BUCKET).remove([storagePath]);
        return;
      }
      setMessage(
        sourceKey === "lab"
          ? "Lab source uploaded privately."
          : `${sourceKey.replace("_", " ")} edition uploaded privately.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The source upload failed.");
    } finally {
      setUploadingVersionId("");
      const input = fileInputs.current[uploadKey];
      if (input) input.value = "";
    }
  }

  if (loading) {
    return <main className="content-studio-gate"><LoaderCircle className="spin" /><h1>Opening Content Studio…</h1></main>;
  }

  if (!data) {
    return (
      <main className="content-studio-gate">
        <LockKeyhole />
        <h1>Content Studio unavailable</h1>
        <p>{error || "This workspace requires Super User access."}</p>
        <Button asChild variant="outline"><Link href="/workspace?view=admin">Back to administration</Link></Button>
      </main>
    );
  }

  return (
    <main className="content-studio">
      <header className="content-studio-header">
        <Link href="/workspace?view=admin" className="content-studio-brand">
          <span><BisMark /></span>
          <div><strong>BIS Content Studio</strong><small>Super User workspace</small></div>
        </Link>
        <div className="content-studio-header-actions">
          <Button asChild variant="outline"><Link href="/workspace?view=admin"><ArrowLeft /> Administration</Link></Button>
          <Button onClick={() => setCreateOpen((value) => !value)}><Plus /> Add content</Button>
        </div>
      </header>

      <section className="content-studio-hero">
        <div>
          <p className="eyebrow">Content architecture</p>
          <h1>One place to load the next BIS module or Lab.</h1>
          <p>Sources enter privately as drafts, pass validation, receive approval, and only then become candidates for runtime activation. Existing learner experiences remain untouched until that final controlled step.</p>
        </div>
        <ShieldCheck />
      </section>

      {error ? <div className="content-studio-alert bad"><CircleAlert /><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div> : null}
      {message ? <div className="content-studio-alert good"><Check /><span>{message}</span><button onClick={() => setMessage("")}>Dismiss</button></div> : null}

      <section className="content-studio-metrics" aria-label="Content library summary">
        <article><BookOpen /><span>Learning modules</span><strong>{data.metrics.learningModules}</strong></article>
        <article><FlaskConical /><span>Labs</span><strong>{data.metrics.labs}</strong></article>
        <article><FileText /><span>Draft versions</span><strong>{data.metrics.drafts}</strong></article>
        <article><PackageCheck /><span>Ready for activation</span><strong>{data.metrics.ready}</strong></article>
        <article><ShieldCheck /><span>Live versions</span><strong>{data.metrics.live}</strong></article>
      </section>

      {createOpen ? (
        <section className="content-studio-card content-create">
          <div className="content-studio-section-title">
            <div><p className="eyebrow">New content</p><h2>Create a library entry</h2><p>Create the identity first. Versions and source files come next.</p></div>
            {kind === "LAB" ? <FlaskConical /> : <BookOpen />}
          </div>
          <div className="content-create-grid">
            <label>Content type<Select value={kind} onValueChange={(value) => setKind(value as ContentKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LEARNING_MODULE">Learning module</SelectItem><SelectItem value="LAB">Lab</SelectItem></SelectContent></Select></label>
            <label>Code<Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="FOC" maxLength={12} /></label>
            <label>Slug<Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="focus" /></label>
            <label className="wide">Title<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "LAB" ? "Focus Lab™" : "Focus Learning Module"} /></label>
            <label className="wide">Summary<Textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What does this content help the learner investigate?" /></label>
            {kind === "LEARNING_MODULE" && labItems.length ? (
              <label className="wide">Linked Lab<Select value={linkedLabItemId || "NONE"} onValueChange={(value) => setLinkedLabItemId(value === "NONE" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No linked Lab yet</SelectItem>{labItems.map((item) => <SelectItem value={item.id} key={item.id}>{item.code} · {item.title}</SelectItem>)}</SelectContent></Select></label>
            ) : null}
          </div>
          <div className="content-studio-actions">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={saving || !code || !slug || !title} onClick={() => void createItem()}>{saving ? <LoaderCircle className="spin" /> : <Plus />} Create entry</Button>
          </div>
        </section>
      ) : null}

      <section className="content-studio-workspace">
        <aside className="content-library">
          <div className="content-library-heading">
            <div><p className="eyebrow">Library</p><h2>Content</h2></div>
            <Button variant="ghost" size="icon" aria-label="Reload content" disabled={loading || saving} onClick={() => void load()}><RefreshCw /></Button>
          </div>
          <div className="content-library-groups">
            {(["LEARNING_MODULE", "LAB"] as ContentKind[]).map((group) => (
              <section key={group}>
                <h3>{group === "LAB" ? "Labs" : "Learning modules"}</h3>
                {activeItems.filter((item) => item.kind === group).map((item) => {
                  const live = item.versions.find((entry) => entry.status === "PUBLISHED" && entry.runtimeStatus === "LIVE");
                  const drafts = item.versions.filter((entry) => ["DRAFT", "VALIDATED", "APPROVED"].includes(entry.status)).length;
                  return (
                    <button type="button" key={item.id} className={selected?.id === item.id ? "active" : ""} onClick={() => setSelectedItemId(item.id)}>
                      <span className="content-library-icon">{item.kind === "LAB" ? <FlaskConical /> : <BookOpen />}</span>
                      <span className="content-library-copy"><strong>{item.title}</strong><small>{item.code} · {live ? `v${live.version} live` : "not live"}{drafts ? ` · ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}</small></span>
                      <ChevronRight />
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </aside>

        <section className="content-detail">
          {selected ? (
            <>
              <header className="content-detail-hero">
                <div>
                  <p className="eyebrow">{selected.kind === "LAB" ? "Lab" : "Learning module"} · {selected.code}</p>
                  <h2>{selected.title}</h2>
                  <p>{selected.summary || "No summary yet."}</p>
                  {selected.linkedLabItemId ? <span className="content-link-note">Linked to {labItems.find((item) => item.id === selected.linkedLabItemId)?.title ?? "Lab"}</span> : null}
                </div>
                <span className="content-detail-mark">{selected.kind === "LAB" ? <FlaskConical /> : <BookOpen />}</span>
              </header>

              <section className="content-studio-card version-create">
                <div className="content-studio-section-title">
                  <div><p className="eyebrow">New version</p><h3>Create a controlled draft</h3><p>The draft is private to Super Users until it is deliberately activated in a later release step.</p></div>
                  <FileArchive />
                </div>
                <div className="version-create-grid">
                  <label>Version<Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.0" /></label>
                  <label>Schema<Select value={schemaVersion} onValueChange={setSchemaVersion}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1.0">1.0</SelectItem><SelectItem value="2.0">2.0</SelectItem><SelectItem value="universal-lab-v1">Universal Lab v1</SelectItem></SelectContent></Select></label>
                  <label>Source type<Select value={sourceFormat} onValueChange={(value) => setSourceFormat(value as ContentSourceFormat)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BIS_PACKAGE_JSON">BIS package JSON</SelectItem><SelectItem value="DOCX">Word document</SelectItem><SelectItem value="PDF">PDF</SelectItem><SelectItem value="HTML">HTML</SelectItem><SelectItem value="MARKDOWN">Markdown</SelectItem><SelectItem value="ZIP">ZIP package</SelectItem></SelectContent></Select></label>
                  <label className="wide">Release notes<Textarea value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} placeholder="What changed in this version?" /></label>
                </div>
                <Button disabled={saving || !version} onClick={() => void createVersion()}>{saving ? <LoaderCircle className="spin" /> : <Plus />} Create draft</Button>
              </section>

              <section className="content-versions">
                <div className="content-versions-heading">
                  <div><p className="eyebrow">Versions</p><h3>{selected.versions.length ? "Version history" : "No versions yet"}</h3></div>
                </div>
                {selected.versions.map((entry) => {
                  const checks = entry.validationReport?.checks ?? [];
                  const canEdit = entry.status === "DRAFT";
                  const busy = saving || uploadingVersionId === entry.id;
                  return (
                    <article className="content-version-card" key={entry.id}>
                      <header>
                        <div>
                          <span className="content-version-number">v{entry.version}</span>
                          <strong>{sourceLabel(entry.sourceFormat)}</strong>
                          <small>Created {formatDate(entry.createdAt)}</small>
                        </div>
                        <div className="content-status-row">
                          <span data-tone={statusTone(entry.status)}>{entry.status}</span>
                          <span data-tone={statusTone(entry.validationStatus)}>{entry.validationStatus}</span>
                          <span data-tone={statusTone(entry.runtimeStatus)}>{entry.runtimeStatus}</span>
                        </div>
                      </header>

                      <div className="content-version-source">
                        <div>
                          <FileCheck2 />
                          <span><strong>{entry.sourceFileName ?? "No source uploaded"}</strong><small>{formatBytes(entry.sourceBytes)}{entry.sourceHash ? ` · SHA-256 ${entry.sourceHash.slice(0, 12)}…` : ""}</small></span>
                        </div>
                        {canEdit ? (
                          <>
                            <input
                              ref={(node) => { fileInputs.current[entry.id] = node; }}
                              type="file"
                              accept=".json,.docx,.pdf,.html,.htm,.md,.zip,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/markdown,application/zip"
                              hidden
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadSource(entry, file);
                              }}
                            />
                            <Button variant="outline" disabled={busy} onClick={() => fileInputs.current[entry.id]?.click()}>
                              {uploadingVersionId === entry.id ? <LoaderCircle className="spin" /> : <Upload />}
                              {entry.sourceFileName ? "Replace source" : "Upload source"}
                            </Button>
                          </>
                        ) : null}
                      </div>

                      {entry.validationReport?.summary ? (
                        <div className="content-validation-summary">
                          <strong>{entry.validationReport.summary}</strong>
                          {checks.length ? <div className="content-check-list">{checks.map((check) => <div key={check.id} data-status={check.status}><span>{check.status === "PASS" ? <Check /> : <CircleAlert />}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div></div>)}</div> : null}
                        </div>
                      ) : null}

                      {entry.releaseNotes ? <p className="content-release-notes"><strong>Release notes:</strong> {entry.releaseNotes}</p> : null}

                      <footer>
                        {entry.status === "DRAFT" ? <Button disabled={busy || !entry.sourceStoragePath} onClick={() => void act({ action: "validateVersion", versionId: entry.id }, "Validation complete.")}><FileCheck2 /> Validate</Button> : null}
                        {entry.status === "VALIDATED" ? <Button disabled={busy} onClick={() => void act({ action: "approveVersion", versionId: entry.id }, "Version approved for the activation queue.")}><ShieldCheck /> Approve</Button> : null}
                        {["VALIDATED", "APPROVED"].includes(entry.status) ? <Button variant="outline" disabled={busy} onClick={() => void act({ action: "reopenVersion", versionId: entry.id }, "Version reopened as a draft.")}>Reopen draft</Button> : null}
                        {entry.status === "APPROVED" ? <span className="activation-note"><LockKeyhole /> Activation remains controlled until the runtime adapter is connected.</span> : null}
                        {entry.status === "PUBLISHED" && entry.runtimeStatus === "LIVE" ? <span className="activation-note live"><Check /> Live in the current BIS runtime.</span> : null}
                      </footer>
                    </article>
                  );
                })}
              </section>

              {!selected.versions.some((entry) => entry.status === "PUBLISHED" && entry.runtimeStatus === "LIVE") ? (
                <section className="content-studio-card content-architecture-note">
                  <LockKeyhole />
                  <div><strong>No learner-facing activation yet.</strong><p>Content Studio deliberately separates loading content from making it executable. A future runtime-activation milestone will bind approved packages to the universal learning and Lab renderers without letting uploads bypass validation.</p></div>
                </section>
              ) : null}

              {selected.versions.every((entry) => !(entry.status === "PUBLISHED" && entry.runtimeStatus === "LIVE")) ? (
                <Button variant="ghost" className="archive-control" disabled={saving} onClick={() => void act({ action: "archiveItem", itemId: selected.id }, "Content entry archived.")}><Archive /> Archive entry</Button>
              ) : null}
            </>
          ) : (
            <div className="content-empty"><PackageCheck /><h2>Create the first content entry.</h2><p>Learning modules and Labs will appear here.</p></div>
          )}
        </section>
      </section>
    </main>
  );
}
