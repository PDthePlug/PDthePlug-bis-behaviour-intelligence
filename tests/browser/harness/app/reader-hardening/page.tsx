"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { enhanceHandbookDocument, observeHandbookTables, syncHandbookLearningChecks } from "../../../../../app/learning/handbook-document-enhancements";
import type { HabitProgramme } from "../../../../../lib/programme-handbook";

export default function Page() {
  const [source, setSource] = useState("money-emerging_adult");
  const [handbook, setHandbook] = useState<HabitProgramme | null>(null);
  const [error, setError] = useState("");
  const [day, setDay] = useState("2");
  const root = useRef<HTMLDivElement>(null);
  const current = handbook?.treatment.pages.find(page => String(page.programmeDay) === day || page.key === day);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/handbooks/v1/${source}.json.gz.b64`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`Handbook source returned ${response.status}`);
      const bytes = Uint8Array.from(atob((await response.text()).trim()), character => character.charCodeAt(0));
      return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).json();
    }).then(setHandbook).catch(error => { if (!controller.signal.aborted) setError(String(error)); });
    return () => controller.abort();
  }, [source]);
  useLayoutEffect(() => {
    if (!root.current || !current || !handbook) return;
    for (let pass = 0; pass < 4; pass++) enhanceHandbookDocument(root.current, handbook.labCode, current.id, { programmeDay: current.programmeDay, pageTitle: current.label, enableFormativeLearningChecks: true });
    for (const field of root.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-field-id]")) {
      const saved = sessionStorage.getItem(field.dataset.fieldId!);
      if (field instanceof HTMLInputElement && field.type === "radio") field.checked = saved === field.value;
      else field.value = saved ?? "";
      field.addEventListener("input", () => sessionStorage.setItem(field.dataset.fieldId!, field.value));
    }
    syncHandbookLearningChecks(root.current);
    return observeHandbookTables(root.current);
  }, [current, handbook]);
  return <main className="prototype-player">
    {error ? <p role="alert">{error}</p> : null}
    <nav aria-label="Test specimen"><label>Handbook<select value={source} onChange={e => setSource(e.target.value)}>{["habit", "money", "decision", "identity", "attention"].flatMap(slug => ["school", "emerging_adult", "workplace"].map(edition => <option value={`${slug}-${edition}`} key={`${slug}-${edition}`}>{slug} · {edition}</option>))}</select></label><label>Day<select value={day} onChange={e => setDay(e.target.value)}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}{["Welcome", "Weekend", "Certificate"].map(key => <option key={key}>{key}</option>)}</select></label></nav>
    <article className="prototype-reader learner-document-stage"><div key={`${source}-${current?.id}`} ref={root} className="prototype-document learner-document" data-specimen={`${handbook?.slug}-${handbook?.edition}`} data-day={current?.programmeDay} data-page-key={current?.key} dangerouslySetInnerHTML={{ __html: current?.html ?? "Loading handbook…" }} /></article>
  </main>;
}
