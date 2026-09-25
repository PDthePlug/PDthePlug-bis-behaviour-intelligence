"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, FlaskConical, Laptop, Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Kind = "LEARNING_MODULE" | "LAB";
type Edition = "school" | "emerging_adult" | "workplace";

const editions: Array<{ id: Edition; label: string }> = [
  { id: "school", label: "School" },
  { id: "emerging_adult", label: "Emerging Adult" },
  { id: "workplace", label: "Workplace" },
];

export function ContentPreviewWorkspace({
  versionId,
  kind,
  code,
  initialEdition,
}: {
  versionId: string;
  kind: Kind;
  code: string;
  initialEdition: Edition;
}) {
  const [edition, setEdition] = useState<Edition>(initialEdition);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  const src = useMemo(() => {
    const params = new URLSearchParams({ kind, code });
    if (kind === "LEARNING_MODULE") params.set("edition", edition);
    return `/content-studio/preview/${encodeURIComponent(versionId)}/runtime?${params.toString()}`;
  }, [code, edition, kind, versionId]);

  return (
    <main className="uat-preview-workspace">
      <header className="uat-preview-toolbar">
        <div className="uat-preview-title">
          <span>{kind === "LAB" ? <FlaskConical /> : <BookOpen />}</span>
          <div>
            <p>Final publishing check</p>
            <strong>{code} · learner preview</strong>
          </div>
        </div>

        {kind === "LEARNING_MODULE" ? (
          <div className="uat-preview-editions" aria-label="Learning edition preview">
            {editions.map((item) => (
              <button
                type="button"
                key={item.id}
                className={edition === item.id ? "active" : ""}
                onClick={() => setEdition(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="uat-preview-devices" aria-label="Preview viewport">
          <button type="button" className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}><Laptop /> Desktop</button>
          <button type="button" className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}><Smartphone /> Mobile</button>
        </div>

        <Button asChild variant="outline"><Link href="/content-studio">Back to Content Studio</Link></Button>
      </header>

      <section className="uat-preview-notice">
        <ShieldCheck />
        <div>
          <strong>Preview safely. Nothing you type here is saved to a learner record.</strong>
          <p>Check the content, questions, navigation and phone/desktop layout. When you are happy, return to Content Studio and complete the final check.</p>
        </div>
      </section>

      <section className={`uat-preview-stage ${viewport}`}>
        <div className="uat-preview-device">
          <iframe
            key={src}
            title={kind === "LAB" ? `${code} Lab activation preview` : `${code} ${edition} activation preview`}
            src={src}
          />
        </div>
      </section>
    </main>
  );
}
