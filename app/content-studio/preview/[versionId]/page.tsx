import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { ContentPreviewWorkspace } from "./preview-workspace";
import "./preview.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Content Preview",
  robots: { index: false, follow: false },
};

export default async function ContentPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>;
  searchParams: Promise<{ kind?: string; code?: string; edition?: string }>;
}) {
  const { versionId: rawVersionId } = await params;
  let versionId = rawVersionId;
  try { versionId = decodeURIComponent(rawVersionId); } catch {}
  const query = await searchParams;
  await requireUser(`/content-studio/preview/${versionId}`);

  const kind = query.kind === "LAB" ? "LAB" : query.kind === "LEARNING_MODULE" ? "LEARNING_MODULE" : null;
  const code = String(query.code ?? "").toUpperCase();
  const edition = ["school", "emerging_adult", "workplace"].includes(String(query.edition))
    ? query.edition as "school" | "emerging_adult" | "workplace"
    : "school";
  if (!kind || !/^[A-Z][A-Z0-9_-]{1,11}$/.test(code)) notFound();

  return <ContentPreviewWorkspace versionId={versionId} kind={kind} code={code} initialEdition={edition} />;
}
