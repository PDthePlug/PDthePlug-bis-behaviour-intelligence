"use client";
import { useLayoutEffect, useRef } from "react";
import { enhanceHandbookDocument } from "../../../../../app/learning/handbook-document-enhancements";
import "../../../../../app/learning/programme-player.css";

export default function Page() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    enhanceHandbookDocument(root.current, "PUR", "day-3");
    enhanceHandbookDocument(root.current, "PUR", "day-3");
  }, []);
  return <main><div ref={root} className="prototype-document" dangerouslySetInnerHTML={{ __html: '<h2>Reflection</h2><p>"What gives your life meaning? Where did this come from?"</p><textarea class="response" data-field-id="PUR.WB.ORIGINAL" data-source-key="original" aria-label="Your response">An existing learner answer</textarea><h3>✅ Checkpoint</h3><p>What pattern repeats here, and what evidence shows it happens?</p>' }} /></main>;
}
