"use client";
import { useLayoutEffect, useRef } from "react";
import { enhanceHandbookDocument } from "../../../../../app/learning/handbook-document-enhancements";

const specimen = '<h1>DAY 2 OF 10</h1><h2>Reading your evidence</h2><div class="authored-lines">☐ Observe the context\nbefore interpreting the result</div><table><tbody><tr><td>Prediction Accuracy = 100 −</td><td>Predicted % − Actual %</td><td></td></tr></tbody></table><table><tbody><tr><td>Situation</td><td>Your evidence notes</td></tr><tr><td data-label="Situation">At work</td><td data-label="Your evidence notes">_____</td></tr></tbody></table>';

export default function Page() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    enhanceHandbookDocument(root.current, "RSK", "recovery");
    enhanceHandbookDocument(root.current, "RSK", "recovery");
    for (const field of root.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-field-id]")) {
      field.value = sessionStorage.getItem(field.dataset.fieldId!) ?? "";
      field.oninput = () => sessionStorage.setItem(field.dataset.fieldId!, field.value);
    }
  }, []);
  return <main className="prototype-player"><article className="prototype-reader"><div className="prototype-document" ref={root} dangerouslySetInnerHTML={{ __html: specimen }} /></article></main>;
}
