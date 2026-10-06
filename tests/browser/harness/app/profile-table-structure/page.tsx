"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { enhanceHandbookDocument } from "../../../../../app/learning/handbook-document-enhancements";

const html = '<h2>My investigation profile</h2><p>Element My Answer</p><p>Recorded zero</p><p>Reported change</p><p>Unmapped answer</p><hr><h2>Private reflection</h2><p>What did you notice?</p><textarea data-field-id="SYS.WB.ORIGINAL" data-source-key="original" data-purpose="LEARNING_RESPONSE" aria-label="What did you notice?"></textarea>';

export default function Page() {
  const root = useRef<HTMLDivElement>(null);
  const [pass, setPass] = useState(0);
  useLayoutEffect(() => {
    if (!root.current) return;
    for (let index = 0; index < 4; index++) enhanceHandbookDocument(root.current, "SYS", "SYS.PROGRAMME.DAY10", { knownValues: [
      { labels: ["Recorded zero"], value: "0", exact: true, source: "Recorded source count" },
      { labels: ["Reported change"], value: "-2", exact: true, source: "Paired self-report answers" },
    ] });
  }, [pass]);
  return <main className="prototype-player"><h1>Profile table fixture</h1><button onClick={() => setPass(value => value + 1)}>Apply presentation again</button><article className="prototype-document learner-document"><div ref={root} className="learner-document-body" dangerouslySetInnerHTML={{ __html: html }} /></article></main>;
}
