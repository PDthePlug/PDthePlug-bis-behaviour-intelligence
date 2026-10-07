"use client";
import { readClientResponse, clientResponseMessage, clientResponseDenied } from "@/lib/client-response";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Eye,
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
import { BIS_MODULES } from "@/lib/bis-catalogue";
import { BisMark } from "@/components/brand/bis-mark";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  nextContentVersion,
  type ContentKind,
} from "@/lib/content-studio";
import {
  CONTENT_UAT_CHECKS,
  editorialReviewComplete,
  requiredPreviewKeys,
  type ContentUatChecklist,
} from "@/lib/content-uat";

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
  deliveryEditions: string[];
  validationStatus: string;
  runtimeStatus: string;
  status: string;
  releaseNotes: string;
  compilerStatus: string;
  compilerCurrent: boolean;
  compilerReport: {
    summary?: string;
    requiredEditions?: string[];
    artifactKeys?: string[];
    schemaVersion?: string;
    runtimeProfile?: string;
    detectedCapabilities?: string[];
    calculatedFields?: number;
    indicatorCount?: number;
    unboundIndicators?: string[];
    experimentDays?: number | null;
    profileEntries?: number;
    standardVersion?: string | null;
    editorialStatus?: "PASS" | "REVIEW" | "BLOCKED" | null;
    editorialWarnings?: string[];
    questionQuality?: {
      totalPrompts: number;
      learnerInputs: number;
      derivedFields: number;
      reusedInputs: number;
      duplicateGroups: Array<{
        fingerprint: string;
        promptIds: string[];
        investigations: number[];
        count: number;
      }>;
      denseInvestigations: Array<{
        investigation: number;
        learnerInputs: number;
      }>;
      reviewItems: string[];
      principle: string;
    };
  };
  compiledAt: string | null;
  sourceFiles: ContentSourceFile[];
  artifacts: RuntimeArtifact[];
  uat: null | {
    id: string;
    artifactFingerprint: string;
    previewedArtifacts: string[];
    checklist: ContentUatChecklist;
    notes: string;
    status: "IN_REVIEW" | "PASSED";
    reviewedBy: string | null;
    reviewedAt: string | null;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
};

type ContentItem = {
  rollbackAvailable?: boolean;
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
  activeEditions: Array<{
    id: string;
    deliveryEdition: string;
    versionId: string;
    activatedAt: string;
  }>;
  versions: ContentVersion[];
};

type VolumeAuditResult = {
  volume: number;
  fileName: string;
  version: string;
  expectedLabs: number;
  compiledLabs: number;
  blockedLabs: number;
  editorialReviewLabs: number;
  passLabs: number;
  stagedLabs: number;
  stageRequested: boolean;
  staged: Array<{ code: string; versionId: string; storagePath: string }>;
  labs: Array<{
    code: string;
    title: string;
    sourceProductNumber: number;
    sourcePosition: number;
    canonicalPosition: number;
    detectedLearnerCopies: number;
    expectedLearnerCopies: number;
    sourceWarnings: string[];
    compileStatus: "COMPILED" | "BLOCKED";
    standardVersion: string | null;
    editorialStatus: "PASS" | "REVIEW" | "BLOCKED";
    editorialIssues: Array<{ code?: string; severity?: string; investigation?: number; message?: string }>;
    normalizationNotes: Array<{ message?: string }>;
    investigationCount: number;
    promptCount: number;
    stageStatus: "NOT_REQUESTED" | "PENDING" | "STAGED" | "FAILED";
  }>;
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

const editionSlots = [
  { key: "school", label: "School", note: "School-age learners" },
  { key: "emerging_adult", label: "Emerging Adult", note: "Young adult learners" },
  { key: "workplace", label: "Workplace", note: "Workplace programmes" },
] as const;

function formatBytes(value: number | null | undefined) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function versionState(entry: ContentVersion) {
  if (entry.status === "PUBLISHED" && entry.runtimeStatus === "LIVE") return { label: "Published", tone: "good" };
  if (entry.status === "PUBLISHED" && entry.runtimeStatus === "READY") return { label: "Offline", tone: "neutral" };
  if (entry.compilerStatus === "COMPILED" && !entry.compilerCurrent) return { label: "Re-prepare required", tone: "bad" };
  if (entry.status === "APPROVED") return { label: "Ready to publish", tone: "good" };
  if (entry.compilerStatus === "COMPILED" && entry.compilerCurrent) return { label: "Ready to review", tone: "good" };
  if (entry.compilerStatus === "FAILED" || entry.runtimeStatus === "BLOCKED") return { label: "Needs attention", tone: "bad" };
  return { label: "In progress", tone: "neutral" };
}

export function ContentStudio() {
  const [data, setData] = useState<StudioSnapshot | null>(null);
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedKind, setSelectedKind] = useState<ContentKind>("LEARNING_MODULE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [volumeAuditOpen, setVolumeAuditOpen] = useState(false);
  const [volumeAuditVolume, setVolumeAuditVolume] = useState("1");
  const [volumeAuditVersion, setVolumeAuditVersion] = useState("source-2026");
  const [volumeAuditFile, setVolumeAuditFile] = useState<File | null>(null);
  const [volumeAuditResult, setVolumeAuditResult] = useState<VolumeAuditResult | null>(null);
  const [auditingVolume, setAuditingVolume] = useState(false);
  const [kind, setKind] = useState<ContentKind>("LEARNING_MODULE");
  const [code, setCode] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [linkedLabItemId, setLinkedLabItemId] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [pasteOpen, setPasteOpen] = useState("");
  const [pasteValues, setPasteValues] = useState<Record<string, string>>({});
  const [uatDrafts, setUatDrafts] = useState<Record<string, { checklist: ContentUatChecklist; notes: string }>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [client] = useState(createClient);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/content-studio", { cache: "no-store" });
      const payload = await readClientResponse<StudioSnapshot>(response, "Content Studio could not open. Try again.", value => Array.isArray(value.items) && Boolean(value.metrics));
      setData(payload);
      const first = BIS_MODULES.find((module) => payload.items.some((item) => item.code === module.code))
        ?? payload.items[0];
      setSelectedCode((current) => current || first?.code || "");
    } catch (cause) {
      if (clientResponseDenied(cause)) setData(null);
      setError(clientResponseMessage(cause, "Content Studio could not open. Try again."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const refreshAfterPreview = () => {
      if (document.visibilityState === "visible" && !saving) void load();
    };
    window.addEventListener("focus", refreshAfterPreview);
    return () => window.removeEventListener("focus", refreshAfterPreview);
  }, [saving]);

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
      const result = await readClientResponse<StudioSnapshot>(response, "That change could not be completed. Try again.", value => Array.isArray(value.items) && Boolean(value.metrics));
      setData(result);
      if (success) setMessage(success);
      return result;
    } catch (cause) {
      if (clientResponseDenied(cause)) setData(null);
      setError(clientResponseMessage(cause, "That change could not be completed. Try again."));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function auditVolume(stage = false) {
    if (!volumeAuditFile) {
      setError("Choose the original BIS Volume Word document.");
      return;
    }
    setAuditingVolume(true);
    setError("");
    setMessage("");
    setVolumeAuditResult(null);
    try {
      const form = new FormData();
      form.set("file", volumeAuditFile);
      form.set("volume", volumeAuditVolume);
      form.set("version", stage ? "1.0" : (volumeAuditVersion.trim() || "source-2026"));
      if (stage) form.set("stage", "1");
      const response = await fetch("/api/content-studio/volume-audit", {
        method: "POST",
        body: form,
      });
      const result = await readClientResponse<VolumeAuditResult>(response, "The BIS volume could not be audited. Try again.", value => Array.isArray(value.labs) && Array.isArray(value.staged));
      setVolumeAuditResult(result);
      setMessage(
        result.stageRequested
          ? `Volume ${result.volume}: ${result.stagedLabs} Lab packages staged into version 1.0 drafts. Nothing was published.`
          : `Volume ${result.volume} split into ${result.expectedLabs} Lab drafts. Nothing was published.`,
      );
      if (result.stageRequested) void load();
    } catch (cause) {
      setError(clientResponseMessage(cause, "The BIS volume could not be audited. Try again."));
    } finally {
      setAuditingVolume(false);
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
  const catalogueCodes = useMemo(() => {
    const known = BIS_MODULES.map((module) => module.code).filter((code) => activeItems.some((item) => item.code === code));
    const extra = activeItems.map((item) => item.code).filter((code) => !known.includes(code));
    return [...known, ...new Set(extra)];
  }, [activeItems]);
  const selected =
    activeItems.find((item) => item.code === selectedCode && item.kind === selectedKind)
    ?? activeItems.find((item) => item.code === selectedCode)
    ?? activeItems[0]
    ?? null;
  const workingVersion = selected?.versions.find((entry) => ["DRAFT", "VALIDATED", "APPROVED"].includes(entry.status)) ?? null;
  const liveVersion = selected?.versions.find((entry) => entry.status === "PUBLISHED" && entry.runtimeStatus === "LIVE") ?? null;
  const offlinePublishedVersion = selected?.versions.find((entry) => entry.status === "PUBLISHED" && entry.runtimeStatus === "READY") ?? null;
  const actionVersion = workingVersion ?? offlinePublishedVersion ?? liveVersion;
  const actionVersionCanPreview = Boolean(
    actionVersion
    && actionVersion.compilerStatus === "COMPILED"
    && actionVersion.compilerCurrent
    && actionVersion.artifacts.length,
  );
  const actionVersionCanPublish = Boolean(
    actionVersion
    && (
      (actionVersion.status === "PUBLISHED" && actionVersion.runtimeStatus === "READY")
      || (
        ["VALIDATED", "APPROVED"].includes(actionVersion.status)
        && actionVersion.runtimeStatus === "READY"
        && actionVersion.uat?.status === "PASSED"
      )
    ),
  );
  const actionPreviewHref = actionVersion && selected
    ? selected.kind === "LAB"
      ? `/content-studio/preview/${actionVersion.id}?kind=LAB&code=${encodeURIComponent(selected.code)}`
      : (() => {
          const edition = actionVersion.artifacts.find((artifact) => artifact.deliveryEdition)?.deliveryEdition ?? "school";
          return `/content-studio/preview/${actionVersion.id}?kind=LEARNING_MODULE&code=${encodeURIComponent(selected.code)}&edition=${edition}`;
        })()
    : null;

  function chooseCode(nextCode: string) {
    setSelectedCode(nextCode);
    const sameKind = activeItems.some((item) => item.code === nextCode && item.kind === selectedKind);
    if (!sameKind) {
      const available = activeItems.find((item) => item.code === nextCode);
      if (available) setSelectedKind(available.kind);
    }
  }

  async function createItem() {
    const result = await act({
      action: "createItem",
      kind,
      code,
      slug,
      title,
      summary,
      linkedLabItemId: kind === "LEARNING_MODULE" ? linkedLabItemId || undefined : undefined,
    }, "Added to Content Studio.");
    if (!result) return;
    setSelectedCode(code.trim().toUpperCase());
    setSelectedKind(kind);
    setCode("");
    setSlug("");
    setTitle("");
    setSummary("");
    setLinkedLabItemId("");
    setCreateOpen(false);
  }

  async function createVersion(copyFromVersionId?: string) {
    if (!selected) return;
    const suggested = nextContentVersion(selected.versions.map((entry) => entry.version));
    const result = await act({
      action: "createVersion",
      itemId: selected.id,
      copyFromVersionId,
      schemaVersion: selected.kind === "LAB" ? "universal-lab-v1" : "2.0",
      sourceFormat: "BIS_PACKAGE_JSON",
      releaseNotes,
    }, copyFromVersionId
      ? `Editable update v${suggested} is ready with the current source carried forward.`
      : `Working update v${suggested} is ready. Add the content you have.`);
    if (!result) return;
    setReleaseNotes("");
  }

  async function editVersion(entry: ContentVersion) {
    if (entry.status === "DRAFT") return;
    if (["VALIDATED", "APPROVED"].includes(entry.status)) {
      await act({ action: "reopenVersion", versionId: entry.id }, "This update is editable again.");
      return;
    }
    if (entry.status === "PUBLISHED") {
      if (workingVersion) {
        setMessage(`Working update v${workingVersion.version} is already open.`);
        return;
      }
      await createVersion(entry.id);
    }
  }

  async function unpublishSelected() {
    if (!selected || !liveVersion) return;
    if (!window.confirm(`Take ${selected.title} offline for learners? You can republish the reviewed version later.`)) return;
    await act({ action: "unpublishItem", itemId: selected.id }, "Taken offline. The published version is preserved and can be republished.");
  }

  async function rollbackSelected() {
    if (!selected?.rollbackAvailable) return;
    if (!window.confirm(`Restore the previous published version of ${selected.title}?`)) return;
    await act({ action: "rollbackActivation", itemId: selected.id }, "Previous published version restored.");
  }

  async function publishVersion(entry: ContentVersion) {
    if (entry.status === "PUBLISHED" && entry.runtimeStatus === "READY") {
      await act({ action: "republishVersion", versionId: entry.id }, "Published again.");
      return;
    }
    if (entry.uat?.status !== "PASSED") {
      setError("Preview this version and complete the final check before publishing.");
      return;
    }
    if (entry.status === "VALIDATED") {
      const approved = await act({ action: "approveVersion", versionId: entry.id });
      if (!approved) return;
    }
    await act(
      { action: "activateVersion", versionId: entry.id },
      selected?.kind === "LEARNING_MODULE"
        ? "Published the learner edition."
        : "Lab published.",
    );
  }

  async function uploadSource(
    contentVersion: ContentVersion,
    sourceKey: "school" | "emerging_adult" | "workplace" | "lab",
    file: File,
  ) {
    const detected = sourceFormatFor(file.name, file.type);
    if (!detected) {
      setError("Use a Word document, PDF, pasted text, HTML, Markdown, BIS JSON or ZIP file.");
      return;
    }
    if (file.size > 26_214_400) {
      setError("Use a file smaller than 25 MB.");
      return;
    }
    if (!["DRAFT", "VALIDATED", "APPROVED"].includes(contentVersion.status)) {
      setError("Start the next update before changing published content.");
      return;
    }

    if (contentVersion.status !== "DRAFT") {
      const reopened = await act(
        { action: "reopenVersion", versionId: contentVersion.id },
        "Content reopened for this update.",
      );
      if (!reopened) return;
    }

    const key = `${contentVersion.id}:${sourceKey}`;
    setUploadingKey(key);
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
      if (upload.error) throw new Error("The file could not be uploaded.");

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
      const prepared = await act(
        { action: "compileVersion", versionId: contentVersion.id },
        sourceKey === "lab"
          ? "Lab added and the learner preview is ready to check."
          : `${sourceKey.replace("_", " ")} edition added and the learner preview is ready to check.`,
      );
      if (!prepared) return;
    } catch {
      setError("The file could not be uploaded. Check the file and try again.");
    } finally {
      setUploadingKey("");
      const input = fileInputs.current[key];
      if (input) input.value = "";
    }
  }

  function applyPastedText(entry: ContentVersion, sourceKey: "school" | "emerging_adult" | "workplace" | "lab") {
    const key = `${entry.id}:${sourceKey}`;
    const text = pasteValues[key]?.trim();
    if (!text) {
      setError("Paste the content first.");
      return;
    }
    const file = new File(
      [text],
      `${selected?.code.toLowerCase() ?? "bis"}-${sourceKey}-pasted.md`,
      { type: "text/markdown" },
    );
    void uploadSource(entry, sourceKey, file).then(() => {
      setPasteOpen("");
      setPasteValues((current) => ({ ...current, [key]: "" }));
    });
  }

  function uatDraft(entry: ContentVersion) {
    return uatDrafts[entry.id] ?? {
      checklist: entry.uat?.checklist ?? {},
      notes: entry.uat?.notes ?? "",
    };
  }

  function updateUatCheck(entry: ContentVersion, id: string, checked: boolean) {
    const current = uatDraft(entry);
    setUatDrafts((drafts) => ({
      ...drafts,
      [entry.id]: {
        ...current,
        checklist: { ...current.checklist, [id]: checked },
      },
    }));
  }

  function updateUatNotes(entry: ContentVersion, notes: string) {
    const current = uatDraft(entry);
    setUatDrafts((drafts) => ({
      ...drafts,
      [entry.id]: { ...current, notes },
    }));
  }

  async function saveFinalCheck(entry: ContentVersion, success = "Review saved.") {
    const draft = uatDraft(entry);
    return act({
      action: "saveUat",
      versionId: entry.id,
      checklist: draft.checklist,
      notes: draft.notes,
    }, success);
  }

  async function signOff(entry: ContentVersion) {
    const saved = await saveFinalCheck(entry);
    if (!saved) return;
    const signed = await act(
      { action: "signOffUat", versionId: entry.id },
    );
    if (!signed) return;
    const approved = await act(
      { action: "approveVersion", versionId: entry.id },
      "Ready to publish.",
    );
    if (approved) {
      setUatDrafts((drafts) => {
        const next = { ...drafts };
        delete next[entry.id];
        return next;
      });
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
        <p>{error || "This workspace is available to BIS administrators."}</p>
        <Button asChild variant="outline"><Link href="/workspace?view=admin">Back to administration</Link></Button>
      </main>
    );
  }

  return (
    <main className="content-studio">
      <header className="content-studio-header">
        <Link href="/workspace?view=admin" className="content-studio-brand">
          <span><BisMark /></span>
          <div><strong>BIS Content Studio</strong><small>Publishing workspace</small></div>
        </Link>
        <div className="content-studio-header-actions">
          <Button asChild variant="outline"><Link href="/workspace?view=admin"><ArrowLeft /> Administration</Link></Button>
          <Button variant="outline" onClick={() => setVolumeAuditOpen((value) => !value)}><ClipboardCheck /> Audit a volume</Button>
          <Button variant="outline" onClick={() => setCreateOpen((value) => !value)}><Plus /> Add something new</Button>
        </div>
      </header>

      <section className="content-studio-hero">
        <div>
          <p className="eyebrow">Content Studio</p>
          <h1>Choose a BIS title and add the content that is ready.</h1>
          <p>You do not need all three learning editions at once. Upload School, Emerging Adult or Workplace whenever each one is ready. Learners only see an edition after you preview, approve and publish it.</p>
        </div>
        <ShieldCheck />
      </section>

      {error ? <div className="content-studio-alert bad"><CircleAlert /><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div> : null}
      {message ? <div className="content-studio-alert good"><Check /><span>{message}</span><button onClick={() => setMessage("")}>Dismiss</button></div> : null}

      <section className="content-studio-metrics" aria-label="Content summary">
        <article><BookOpen /><span>Learning titles</span><strong>{data.metrics.learningModules}</strong></article>
        <article><FlaskConical /><span>Labs</span><strong>{data.metrics.labs}</strong></article>
        <article><FileText /><span>In progress</span><strong>{data.metrics.drafts}</strong></article>
        <article><PackageCheck /><span>Ready to publish</span><strong>{data.metrics.ready}</strong></article>
        <article><ShieldCheck /><span>Published versions</span><strong>{data.metrics.live}</strong></article>
      </section>

      {volumeAuditOpen ? (
        <section className="content-studio-card volume-audit-card">
          <div className="content-studio-section-title">
            <div>
              <p className="eyebrow">Volume intake</p>
              <h2>Audit a complete BIS volume before migration</h2>
              <p>The source stays unchanged. BIS splits the Word document into individual Lab drafts, runs the Habit Lab standard and reports what must be strengthened before approval.</p>
            </div>
            <ClipboardCheck />
          </div>
          <div className="volume-audit-controls">
            <label>
              Source volume
              <Select value={volumeAuditVolume} onValueChange={setVolumeAuditVolume}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Volume 1 · 12 Labs</SelectItem>
                  <SelectItem value="2">Volume 2 · 10 source-backed Labs</SelectItem>
                  <SelectItem value="3">Volume 3 · 10 Labs</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              Audit version
              <Input value={volumeAuditVersion} onChange={(event) => setVolumeAuditVersion(event.target.value)} placeholder="source-2026" />
            </label>
            <label className="volume-audit-file">
              Word source
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => setVolumeAuditFile(event.target.files?.[0] ?? null)}
              />
              <small>{volumeAuditFile ? volumeAuditFile.name : "Choose the original Volume DOCX"}</small>
            </label>
            <div className="volume-audit-actions">
              <Button variant="outline" onClick={() => void auditVolume(false)} disabled={auditingVolume || !volumeAuditFile}>
                {auditingVolume ? <LoaderCircle className="spin" /> : <ClipboardCheck />}
                {auditingVolume ? "Working…" : "Audit only"}
              </Button>
              <Button onClick={() => void auditVolume(true)} disabled={auditingVolume || !volumeAuditFile}>
                {auditingVolume ? <LoaderCircle className="spin" /> : <Upload />}
                {auditingVolume ? "Working…" : "Stage into 1.0 drafts"}
              </Button>
            </div>
          </div>

          {volumeAuditResult ? (
            <div className="volume-audit-results">
              <div className="volume-audit-summary">
                <article><strong>{volumeAuditResult.expectedLabs}</strong><span>Lab drafts found</span></article>
                <article><strong>{volumeAuditResult.compiledLabs}</strong><span>Structurally compiled</span></article>
                <article><strong>{volumeAuditResult.editorialReviewLabs}</strong><span>Need strengthening</span></article>
                <article><strong>{volumeAuditResult.blockedLabs}</strong><span>Blocked</span></article>
                <article><strong>{volumeAuditResult.passLabs}</strong><span>Editorial pass</span></article>
                {volumeAuditResult.stageRequested ? <article><strong>{volumeAuditResult.stagedLabs}</strong><span>Staged to 1.0</span></article> : null}
              </div>
              <div className="volume-audit-list">
                {volumeAuditResult.labs.map((lab) => (
                  <article key={lab.code} data-status={lab.editorialStatus.toLowerCase()}>
                    <header>
                      <div>
                        <span>{lab.code}</span>
                        <strong>{lab.title}</strong>
                        <small>Source Product #{lab.sourceProductNumber} · source position {lab.sourcePosition} · {lab.promptCount} captured fields</small>
                      </div>
                      <b>{lab.stageStatus === "STAGED" ? "STAGED · " : ""}{lab.editorialStatus}</b>
                    </header>
                    {lab.sourceWarnings.length ? (
                      <ul>{lab.sourceWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                    ) : null}
                    {lab.editorialIssues.length ? (
                      <div className="volume-audit-issues">
                        {lab.editorialIssues.slice(0, 6).map((issue, index) => (
                          <p key={`${lab.code}-${issue.code ?? "issue"}-${index}`}>
                            <strong>{issue.investigation ? `Investigation ${issue.investigation}: ` : ""}{issue.code ?? "Review"}</strong>
                            {issue.message}
                          </p>
                        ))}
                        {lab.editorialIssues.length > 6 ? <small>+ {lab.editorialIssues.length - 6} more review findings</small> : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {createOpen ? (
        <section className="content-studio-card content-create">
          <div className="content-studio-section-title">
            <div><p className="eyebrow">Future addition</p><h2>Add a new BIS title</h2><p>The 34 BIS titles are already loaded. Use this only when the series grows beyond the current catalogue.</p></div>
          </div>
          <div className="content-create-grid">
            <label>What are you adding?<Select value={kind} onValueChange={(value) => setKind(value as ContentKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LEARNING_MODULE">Learning module</SelectItem><SelectItem value="LAB">Lab</SelectItem></SelectContent></Select></label>
            <label>Short code<Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="FOC" maxLength={12} /></label>
            <label>URL name<Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="focus" /></label>
            <label className="wide">Title<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "LAB" ? "Focus Lab™" : "Focus Learning Module"} /></label>
            <label className="wide">Short description<Textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What will the learner investigate?" /></label>
            {kind === "LEARNING_MODULE" ? (
              <label className="wide">Linked Lab<Select value={linkedLabItemId || "NONE"} onValueChange={(value) => setLinkedLabItemId(value === "NONE" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No linked Lab yet</SelectItem>{labItems.map((item) => <SelectItem value={item.id} key={item.id}>{item.code} · {item.title}</SelectItem>)}</SelectContent></Select></label>
            ) : null}
          </div>
          <div className="content-studio-actions">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={saving || !code || !slug || !title} onClick={() => void createItem()}><Plus /> Add title</Button>
          </div>
        </section>
      ) : null}

      <section className="content-picker content-studio-card">
        <div>
          <p className="eyebrow">Choose content</p>
          <h2>What are you updating?</h2>
        </div>
        <label>
          BIS title
          <Select value={selectedCode} onValueChange={chooseCode}>
            <SelectTrigger><SelectValue placeholder="Choose a BIS title" /></SelectTrigger>
            <SelectContent>
              {catalogueCodes.map((itemCode) => {
                const catalogue = BIS_MODULES.find((module) => module.code === itemCode);
                const title = catalogue?.title ?? activeItems.find((item) => item.code === itemCode)?.title ?? itemCode;
                return <SelectItem value={itemCode} key={itemCode}>{itemCode} · {title}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </label>
        <div className="content-kind-tabs" role="tablist" aria-label="Content type">
          {(["LEARNING_MODULE", "LAB"] as ContentKind[]).map((itemKind) => {
            const available = activeItems.some((item) => item.code === selectedCode && item.kind === itemKind);
            return (
              <button
                type="button"
                role="tab"
                key={itemKind}
                disabled={!available}
                aria-selected={selectedKind === itemKind}
                className={selectedKind === itemKind ? "active" : ""}
                onClick={() => setSelectedKind(itemKind)}
              >
                {itemKind === "LAB" ? <FlaskConical /> : <BookOpen />}
                {itemKind === "LAB" ? "Lab" : "Learning module"}
              </button>
            );
          })}
        </div>
      </section>

      <section className="content-studio-workspace content-studio-workspace-simple">
        <section className="content-detail">
          {selected ? (
            <>
              <header className="content-detail-hero">
                <div>
                  <p className="eyebrow">{selected.kind === "LAB" ? "Lab" : "Learning module"} · {selected.code}</p>
                  <h2>{selected.title}</h2>
                  <p>{selected.summary || "Ready for its next content version."}</p>
                  {selected.kind === "LEARNING_MODULE" && selected.linkedLabItemId ? (
                    <span className="content-link-note">Linked Lab: {labItems.find((item) => item.id === selected.linkedLabItemId)?.title ?? "Linked"}</span>
                  ) : null}
                </div>
                <span className="content-detail-mark">{selected.kind === "LAB" ? <FlaskConical /> : <BookOpen />}</span>
              </header>

              <section className="content-studio-card content-publish-panel">
                <div className="content-studio-section-title">
                  <div>
                    <p className="eyebrow">Current status</p>
                    <h3>
                      {liveVersion
                        ? "Published to learners"
                        : workingVersion
                          ? `Working update v${workingVersion.version}`
                          : offlinePublishedVersion
                            ? "Currently offline"
                            : "No content version yet"}
                    </h3>
                    <p>
                      {liveVersion
                        ? "Learners can open this title now. Edit creates a safe working update without changing the live version."
                        : workingVersion
                          ? workingVersion.status === "DRAFT"
                            ? "Edit the source, then prepare and preview it before publishing."
                            : "Preview the prepared version, complete the final check, then publish."
                          : offlinePublishedVersion
                            ? "The reviewed version is preserved. You can republish it or start an editable update."
                            : "Start by adding the authored content you want BIS to prepare."}
                    </p>
                  </div>
                  <span className="content-auto-version">
                    {liveVersion
                      ? `Live: v${liveVersion.version}`
                      : workingVersion
                        ? `Working: v${workingVersion.version}`
                        : offlinePublishedVersion
                          ? `Offline: v${offlinePublishedVersion.version}`
                          : `Next: v${nextContentVersion(selected.versions.map((entry) => entry.version))}`}
                  </span>
                </div>

                <div className="content-primary-actions" aria-label="Content actions">
                  {actionVersion ? (
                    <Button
                      variant={workingVersion?.status === "DRAFT" ? "outline" : "default"}
                      disabled={saving || workingVersion?.status === "DRAFT"}
                      onClick={() => void editVersion(actionVersion)}
                    >
                      <FileText />
                      {workingVersion?.status === "DRAFT" ? "Editing" : "Edit content"}
                    </Button>
                  ) : (
                    <Button disabled={saving} onClick={() => void createVersion()}>
                      <Plus /> Add content
                    </Button>
                  )}

                  {actionPreviewHref && actionVersionCanPreview ? (
                    <Button asChild variant="outline">
                      <Link target="_blank" rel="noreferrer" href={actionPreviewHref}>
                        <Eye /> Preview
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" disabled><Eye /> Preview</Button>
                  )}

                  <Button
                    disabled={saving || !actionVersion || !actionVersionCanPublish}
                    onClick={() => actionVersion && void publishVersion(actionVersion)}
                  >
                    <PackageCheck />
                    {offlinePublishedVersion && actionVersion?.id === offlinePublishedVersion.id ? "Republish" : "Publish"}
                  </Button>

                  {liveVersion ? (
                    <Button variant="outline" disabled={saving} onClick={() => void unpublishSelected()}>
                      <LockKeyhole /> Unpublish
                    </Button>
                  ) : null}

                  {liveVersion && selected.rollbackAvailable ? (
                    <Button variant="outline" disabled={saving} onClick={() => void rollbackSelected()}>
                      Restore previous version
                    </Button>
                  ) : null}

                  {selected.routePath && liveVersion ? (
                    <Button asChild variant="ghost">
                      <Link href={selected.routePath}>Open learner view <ChevronRight /></Link>
                    </Button>
                  ) : null}
                </div>

                {!actionVersionCanPublish && actionVersion ? (
                  <p className="content-action-help">
                    {actionVersion.status === "DRAFT"
                      ? "Prepare this update before previewing or publishing."
                      : actionVersion.uat?.status !== "PASSED"
                        ? "Preview it and complete the final check before publishing."
                        : actionVersion.runtimeStatus !== "READY" && actionVersion.runtimeStatus !== "LIVE"
                          ? "This version still needs preparation before it can go live."
                          : actionVersion.runtimeStatus === "LIVE"
                            ? "This version is already published."
                            : "Finish the current review before publishing."}
                  </p>
                ) : null}
              </section>

              <section className="content-versions">
                <div className="content-versions-heading">
                  <div><p className="eyebrow">Versions</p><h3>{selected.versions.length ? "Version history" : "No versions yet"}</h3></div>
                  <Button variant="ghost" size="sm" disabled={loading || saving} onClick={() => void load()}><RefreshCw /> Refresh</Button>
                </div>

                {selected.versions.map((entry) => {
                  const state = versionState(entry);
                  const staleCompilation = entry.compilerStatus === "COMPILED" && !entry.compilerCurrent;
                  const canEdit = ["DRAFT", "VALIDATED", "APPROVED"].includes(entry.status);
                  const canPrepare = canEdit || (staleCompilation && ["VALIDATED", "APPROVED"].includes(entry.status));
                  const sourceSlots = selected.kind === "LEARNING_MODULE"
                    ? editionSlots
                    : [{ key: "lab" as const, label: "Lab", note: "Interactive investigation" }];
                  const hasAnySource = sourceSlots.some((slot) => entry.sourceFiles.some((source) => source.sourceKey === slot.key));
                  const busy = saving || uploadingKey.startsWith(`${entry.id}:`);
                  const artifactKeys = entry.artifacts.map((artifact) => artifact.artifactKey);
                  const previewKeys = requiredPreviewKeys(selected.kind, artifactKeys);
                  const previewed = new Set(entry.uat?.previewedArtifacts ?? []);
                  const allPreviewed = previewKeys.length > 0 && previewKeys.every((key) => previewed.has(key));
                  const review = uatDraft(entry);
                  const needsEditorialReview = entry.compilerReport.editorialStatus === "REVIEW";
                  const allChecks = CONTENT_UAT_CHECKS.every((check) => review.checklist[check.id] === true)
                    && editorialReviewComplete(entry.compilerReport, review.checklist, review.notes);
                  const finalCheckPassed = entry.uat?.status === "PASSED";

                  return (
                    <article className="content-version-card" key={entry.id}>
                      <header>
                        <div>
                          <span className="content-version-number">v{entry.version}</span>
                          <strong>{selected.kind === "LEARNING_MODULE" ? "Learning update" : "Lab update"}</strong>
                          <small>Created {formatDate(entry.createdAt)}</small>
                        </div>
                        <div className="content-status-row">
                          <span data-tone={state.tone}>{state.label}</span>
                        </div>
                      </header>

                      {selected.kind === "LEARNING_MODULE" ? (
                        <div className="content-edition-note">
                          <BookOpen />
                          <div>
                            <strong>Each edition can move at its own pace.</strong>
                            <p>School, Emerging Adult and Workplace are separate publishing slots. An edition that has not been published simply remains unavailable for that learner group.</p>
                          </div>
                        </div>
                      ) : null}

                      <div className="content-source-stack">
                        {sourceSlots.map((slot) => {
                          const source = entry.sourceFiles.find((candidate) => candidate.sourceKey === slot.key);
                          const artifactKey = slot.key === "lab" ? "lab:universal" : `learning:${slot.key}`;
                          const prepared = entry.compilerCurrent && entry.artifacts.some((artifact) => artifact.artifactKey === artifactKey);
                          const liveEdition = slot.key !== "lab"
                            ? selected.activeEditions.some((activation) => activation.deliveryEdition === slot.key && activation.versionId === entry.id)
                              || (
                                selected.activeActivation?.runtimeMode === "STATIC"
                                && selected.activeActivation.versionId === entry.id
                                && entry.runtimeStatus === "LIVE"
                              )
                            : selected.activeActivation?.versionId === entry.id && entry.runtimeStatus === "LIVE";
                          const inputKey = `${entry.id}:${slot.key}`;
                          return (
                            <section className="content-source-slot content-source-slot-rich" key={slot.key}>
                              <div className="content-source-slot-main">
                                <FileCheck2 />
                                <span className="content-source-slot-copy">
                                  <strong>{slot.label}</strong>
                                  <small>{slot.note}</small>
                                  <small>{source ? `${source.fileName}${formatBytes(source.sourceBytes) ? ` · ${formatBytes(source.sourceBytes)}` : ""}` : "Nothing uploaded yet"}</small>
                                </span>
                                <span className={liveEdition ? "edition-state live" : prepared ? "edition-state ready" : "edition-state"}>
                                  {liveEdition ? "Published" : prepared ? "Ready to preview" : source ? "Uploaded" : "Coming soon"}
                                </span>
                              </div>

                              {canEdit ? (
                                <div className="content-source-actions">
                                  <input
                                    ref={(node) => { fileInputs.current[inputKey] = node; }}
                                    type="file"
                                    aria-label={`Upload ${slot.label} source`}
                                    accept=".json,.docx,.pdf,.html,.htm,.md,.txt,.zip,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/markdown,text/plain,application/zip"
                                    hidden
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (file) void uploadSource(entry, slot.key, file);
                                    }}
                                  />
                                  <Button variant="outline" disabled={busy} onClick={() => fileInputs.current[inputKey]?.click()}>
                                    {uploadingKey === inputKey ? <LoaderCircle className="spin" /> : <Upload />}
                                    {source ? "Replace file" : "Upload file"}
                                  </Button>
                                  <Button variant="ghost" disabled={busy} onClick={() => setPasteOpen(pasteOpen === inputKey ? "" : inputKey)}>
                                    Paste text
                                  </Button>
                                </div>
                              ) : null}

                              {canEdit && pasteOpen === inputKey ? (
                                <div className="content-paste-box">
                                  <Textarea
                                    value={pasteValues[inputKey] ?? ""}
                                    onChange={(event) => setPasteValues((current) => ({ ...current, [inputKey]: event.target.value }))}
                                    placeholder={slot.key === "lab"
                                      ? "Paste the Lab text here. Keep headings such as Investigation 1 through Investigation 9."
                                      : "Paste the authored learning material here. Headings and questions will be preserved."}
                                  />
                                  <div>
                                    <Button variant="outline" onClick={() => setPasteOpen("")}>Cancel</Button>
                                    <Button disabled={!pasteValues[inputKey]?.trim()} onClick={() => applyPastedText(entry, slot.key)}>Use this text</Button>
                                  </div>
                                </div>
                              ) : null}
                            </section>
                          );
                        })}
                      </div>

                      {staleCompilation ? (
                        <div className="content-validation-summary bad">
                          <strong>This version was prepared by an older BIS engine.</strong>
                          <small>Prepare it again before preview, approval or publishing. Your uploaded source stays in place.</small>
                        </div>
                      ) : null}

                      {entry.compilerReport?.summary ? (
                        <div className={entry.compilerStatus === "FAILED" ? "content-validation-summary bad" : "content-validation-summary"}>
                          <strong>{entry.compilerStatus === "FAILED" ? "This version needs attention." : entry.compilerReport.summary}</strong>
                          {entry.compilerStatus === "FAILED" ? <small>{entry.compilerReport.summary}</small> : null}
                          {entry.compilerStatus === "COMPILED" && entry.compilerCurrent && selected.kind === "LAB" && entry.compilerReport.runtimeProfile ? (
                            <>
                              <div className="content-runtime-proof">
                                {entry.compilerReport.experimentDays ? <span>{entry.compilerReport.experimentDays}-day real-world test ready</span> : null}
                                {entry.compilerReport.indicatorCount ? <span>{entry.compilerReport.indicatorCount} programme measures connected</span> : null}
                                {entry.compilerReport.calculatedFields ? <span>{entry.compilerReport.calculatedFields} values calculated automatically</span> : null}
                                {entry.compilerReport.profileEntries ? <span>{entry.compilerReport.profileEntries} profile fields connected</span> : null}
                                {entry.compilerReport.editorialStatus ? <span>Editorial {entry.compilerReport.editorialStatus.toLowerCase()}</span> : null}
                              </div>
                              <details className="content-technical-details">
                                <summary>Advanced details</summary>
                                <div className="content-runtime-proof">
                                  <span>{entry.compilerReport.runtimeProfile === "UNIVERSAL_V2" ? "Universal V2 runtime" : "Universal V1 runtime"}</span>
                                  {(entry.compilerReport.detectedCapabilities ?? []).map((capability) => <span key={capability}>{capability}</span>)}
                                  {entry.compilerReport.standardVersion ? <span>BIS laboratory sequence checked</span> : null}
                                </div>
                              </details>
                            </>
                          ) : null}
                          {entry.compilerStatus === "COMPILED" && entry.compilerReport.questionQuality ? (
                            <div className="content-question-quality">
                              <strong>Question quality</strong>
                              <p>{entry.compilerReport.questionQuality.principle}</p>
                              <div className="content-runtime-proof">
                                <span>{entry.compilerReport.questionQuality.learnerInputs} learner questions</span>
                                <span>{entry.compilerReport.questionQuality.derivedFields} values not re-asked</span>
                                <span>{entry.compilerReport.questionQuality.reusedInputs} answers reused downstream</span>
                              </div>
                              {entry.compilerReport.questionQuality.reviewItems.length ? (
                                <>
                                  <small>Review these before approval:</small>
                                  <ul>
                                    {entry.compilerReport.questionQuality.reviewItems.slice(0, 6).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
                                  </ul>
                                  {entry.compilerReport.questionQuality.reviewItems.length > 6 ? <small>+ {entry.compilerReport.questionQuality.reviewItems.length - 6} more review items</small> : null}
                                </>
                              ) : (
                                <small>No repeated wording or unusually dense investigation was detected.</small>
                              )}
                            </div>
                          ) : null}

                          {entry.compilerStatus === "COMPILED" && entry.compilerReport.editorialWarnings?.length ? (
                            <div className="content-editorial-review">
                              <strong>Preparation notes to check</strong>
                              <p>Check these items against the source. If a question repeats to measure change, record that reason in the final check. Correct any unnecessary repetition before publishing.</p>
                              <ul>
                                {entry.compilerReport.editorialWarnings.slice(0, 8).map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                              </ul>
                              {entry.compilerReport.editorialWarnings.length > 8 ? <small>+ {entry.compilerReport.editorialWarnings.length - 8} more review items</small> : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {entry.compilerStatus === "COMPILED" && entry.compilerCurrent && ["VALIDATED", "APPROVED", "PUBLISHED"].includes(entry.status) ? (
                        <section className="content-uat-card">
                          <header>
                            <div>
                              <p className="eyebrow">Final check</p>
                              <h4>See it exactly as the learner will.</h4>
                              <p>Preview only the editions included in this version. Nothing entered in preview mode is saved to learner records.</p>
                            </div>
                            <span data-tone={finalCheckPassed ? "good" : "neutral"}>
                              {finalCheckPassed ? <><Check /> Complete</> : <><ClipboardCheck /> To do</>}
                            </span>
                          </header>

                          <div className="content-uat-previews">
                            {selected.kind === "LEARNING_MODULE" ? (
                              editionSlots.filter((slot) => artifactKeys.includes(`learning:${slot.key}`)).map((slot) => {
                                const key = `learning:${slot.key}`;
                                return (
                                  <div key={key} className={previewed.has(key) ? "reviewed" : ""}>
                                    <span>{previewed.has(key) ? <Check /> : <Eye />}</span>
                                    <div><strong>{slot.label}</strong><small>{previewed.has(key) ? "Preview opened" : "Open and check"}</small></div>
                                    <Button asChild size="sm" variant="outline">
                                      <Link target="_blank" rel="noreferrer" href={`/content-studio/preview/${entry.id}?kind=LEARNING_MODULE&code=${encodeURIComponent(selected.code)}&edition=${slot.key}`}>
                                        Preview
                                      </Link>
                                    </Button>
                                  </div>
                                );
                              })
                            ) : (
                              <div className={previewed.has("lab:universal") ? "reviewed" : ""}>
                                <span>{previewed.has("lab:universal") ? <Check /> : <Eye />}</span>
                                <div><strong>Lab experience</strong><small>{previewed.has("lab:universal") ? "Preview opened" : "Open and check"}</small></div>
                                <Button asChild size="sm" variant="outline">
                                  <Link target="_blank" rel="noreferrer" href={`/content-studio/preview/${entry.id}?kind=LAB&code=${encodeURIComponent(selected.code)}`}>Preview</Link>
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="content-uat-checklist">
                            {CONTENT_UAT_CHECKS.map((check) => (
                              <label key={check.id}>
                                <Checkbox
                                  checked={review.checklist[check.id] === true}
                                  disabled={finalCheckPassed}
                                  onCheckedChange={(value) => updateUatCheck(entry, check.id, value === true)}
                                />
                                <span><strong>{check.label}</strong><small>{check.detail}</small></span>
                              </label>
                            ))}
                            {needsEditorialReview ? (
                              <label>
                                <Checkbox checked={review.checklist.editorial_review === true} disabled={finalCheckPassed}
                                  onCheckedChange={(value) => updateUatCheck(entry, "editorial_review", value === true)} />
                                <span><strong>I have checked the preparation notes</strong><small>Confirm the repeated questions are intentional and explain their evidence purpose below.</small></span>
                              </label>
                            ) : null}
                          </div>

                          <label className="content-uat-notes">
                            Notes <span>{needsEditorialReview ? "(required for the preparation review)" : "(optional)"}</span>
                            <Textarea
                              value={review.notes}
                              disabled={finalCheckPassed}
                              maxLength={2000}
                              onChange={(event) => updateUatNotes(entry, event.target.value)}
                              placeholder="Anything you want to remember before publishing?"
                            />
                          </label>

                          <footer>
                            <span className={allPreviewed ? "ready" : ""}>
                              {allPreviewed ? <Check /> : <Eye />}
                              {allPreviewed ? "All included content has been previewed" : "Open every included preview first"}
                            </span>
                            {finalCheckPassed ? (
                              <p className="content-uat-signed"><ShieldCheck /> Final check completed {formatDate(entry.uat?.reviewedAt)}</p>
                            ) : (
                              <div>
                                <Button variant="outline" disabled={busy} onClick={() => void saveFinalCheck(entry)}>Save check</Button>
                                <Button disabled={busy || !allPreviewed || !allChecks} onClick={() => void signOff(entry)}><ShieldCheck /> Mark ready</Button>
                              </div>
                            )}
                          </footer>
                        </section>
                      ) : null}

                      {entry.releaseNotes ? <p className="content-release-notes"><strong>Note:</strong> {entry.releaseNotes}</p> : null}

                      <footer>
                        {canPrepare ? (
                          <Button disabled={busy || !hasAnySource} onClick={() => void act(
                            { action: "compileVersion", versionId: entry.id },
                            selected.kind === "LEARNING_MODULE"
                              ? "Content processed. Preview it before publishing."
                              : "Lab processed. Preview it before publishing.",
                          )}>
                            <RefreshCw /> {entry.compilerStatus === "COMPILED" ? "Process again" : "Process content"}
                          </Button>
                        ) : null}
                        {["VALIDATED", "APPROVED"].includes(entry.status) ? (
                          <Button variant="outline" disabled={busy} onClick={() => void editVersion(entry)}>
                            <FileText /> Edit this update
                          </Button>
                        ) : null}
                        {entry.status === "PUBLISHED" && entry.runtimeStatus === "LIVE" ? <span className="activation-note live"><Check /> Published to learners</span> : null}
                        {entry.status === "PUBLISHED" && entry.runtimeStatus === "READY" ? <span className="activation-note">Offline — use Republish above when ready.</span> : null}
                      </footer>
                    </article>
                  );
                })}
              </section>
            </>
          ) : (
            <div className="content-empty"><PackageCheck /><h2>Choose a BIS title.</h2><p>Select a title above to add or update its learning material and Lab.</p></div>
          )}
        </section>
      </section>
    </main>
  );
}
