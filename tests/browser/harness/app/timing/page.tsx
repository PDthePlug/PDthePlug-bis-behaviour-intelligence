"use client";
import { useLayoutEffect, useRef } from "react";
import { enhanceHandbookDocument } from "../../../../../app/learning/handbook-document-enhancements";

export default function TimingFixture() {
  const learning = useRef<HTMLDivElement>(null);
  const bridge = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (learning.current) {
      enhanceHandbookDocument(learning.current, "HAB", "day-2", { programmeDay: 2 });
      enhanceHandbookDocument(learning.current, "HAB", "day-2", { programmeDay: 2 });
    }
    if (bridge.current) enhanceHandbookDocument(bridge.current, "HAB", "day-3", { programmeDay: 3 });
  }, []);
  return <main><section aria-label="Learning session"><div ref={learning}>
    <table><tbody><tr><td><p>TIME: 90 minutes</p></td></tr></tbody></table>
    <p>The facilitated Lab takes 90 minutes.</p>
  </div></section><section aria-label="Lab handoff"><div ref={bridge}><p>TIME: 90 minutes</p></div></section></main>;
}
