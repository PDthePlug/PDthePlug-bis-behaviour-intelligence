"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { enhanceHandbookDocument, syncHandbookLearningChecks } from "../../../../../app/learning/handbook-document-enhancements";
import type { HabitProgramme } from "../../../../../lib/programme-handbook";

export default function Page() {
  const [source, setSource] = useState("money-emerging_adult");
  const [handbook, setHandbook] = useState<HabitProgramme | null>(null);
  const [day, setDay] = useState("2");
  const root = useRef<HTMLDivElement>(null);
  const current = handbook?.treatment.pages.find(page => String(page.programmeDay) === day);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/reader-sources/${source}`, { signal: controller.signal }).then(r => r.json()).then(setHandbook).catch(() => {});
    return () => controller.abort();
  }, [source]);
  useLayoutEffect(() => {
    if (!root.current || !current || !handbook) return;
    for (let pass = 0; pass < 4; pass++) enhanceHandbookDocument(root.current, handbook.labCode, current.id, { programmeDay: current.programmeDay, enableFormativeLearningChecks: true });
    for (const field of root.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-field-id]")) {
      const saved = sessionStorage.getItem(field.dataset.fieldId!);
      if (field instanceof HTMLInputElement && field.type === "radio") field.checked = saved === field.value;
      else field.value = saved ?? "";
      field.addEventListener("input", () => sessionStorage.setItem(field.dataset.fieldId!, field.value));
    }
    syncHandbookLearningChecks(root.current);
  }, [current, handbook]);
  return <main className="prototype-player">
    <nav aria-label="Test specimen"><label>Handbook<select value={source} onChange={e => setSource(e.target.value)}>{["habit", "money", "decision", "identity", "attention"].flatMap(slug => ["school", "emerging_adult", "workplace"].map(edition => <option value={`${slug}-${edition}`} key={`${slug}-${edition}`}>{slug} · {edition}</option>))}</select></label><label>Day<select value={day} onChange={e => setDay(e.target.value)}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label></nav>
    <article className="prototype-reader learner-document-stage"><div key={`${source}-${current?.id}`} ref={root} className="prototype-document learner-document" data-specimen={`${handbook?.slug}-${handbook?.edition}`} data-day={current?.programmeDay} dangerouslySetInnerHTML={{ __html: current?.html ?? "Loading handbook…" }} /></article>
  </main>;
}
