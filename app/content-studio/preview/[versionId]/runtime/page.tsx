import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { ProgrammePlayer } from "@/app/learning/programme-player";
import { UniversalRuntimeLab } from "@/app/labs/[code]/universal-runtime-lab";
import { CanonicalAdaptiveShell } from "@/app/canonical-adaptive-shell";
import "@/app/canonical-shell.css";
import "@/app/learner-readability.css";
import "@/app/lab-investigation-frame.css";

export const dynamic = "force-dynamic";

export default async function ContentPreviewRuntimePage({
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
  await requireUser(`/content-studio/preview/${versionId}/runtime`);

  const code = String(query.code ?? "").toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(code)) notFound();

  if (query.kind === "LEARNING_MODULE") {
    const edition = ["school", "emerging_adult", "workplace"].includes(String(query.edition))
      ? query.edition as "school" | "emerging_adult" | "workplace"
      : null;
    if (!edition) notFound();
    return (
      <CanonicalAdaptiveShell>
        <ProgrammePlayer
          moduleCode={code}
          initialSection="learn"
          initialLearnMode="reader"
          previewVersionId={versionId}
          previewEdition={edition}
        />
      </CanonicalAdaptiveShell>
    );
  }

  if (query.kind === "LAB") {
    return (
      <CanonicalAdaptiveShell>
        <UniversalRuntimeLab labCode={code} previewVersionId={versionId} />
      </CanonicalAdaptiveShell>
    );
  }

  notFound();
}
