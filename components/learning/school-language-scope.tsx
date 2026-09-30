"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { schoolLearnerText } from "@/lib/school-language";

const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "OPTION"]);

function simplifyElement(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    const parent = text.parentElement;
    if (parent && !SKIP.has(parent.tagName) && !parent.closest("[data-school-language='keep-technical']")) {
      nodes.push(text);
    }
    current = walker.nextNode();
  }

  for (const node of nodes) {
    const before = node.nodeValue ?? "";
    const after = schoolLearnerText(before);
    if (after !== before) node.nodeValue = after;
  }

  root.querySelectorAll<HTMLElement>("[aria-label],[title],[placeholder]").forEach((element) => {
    if (element.closest("[data-school-language='keep-technical']")) return;
    for (const attribute of ["aria-label", "title", "placeholder"] as const) {
      const before = element.getAttribute(attribute);
      if (!before) continue;
      const after = schoolLearnerText(before);
      if (after !== before) element.setAttribute(attribute, after);
    }
  });
}

export function SchoolLanguageScope({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const root = ref.current;
    simplifyElement(root);

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        simplifyElement(root);
      });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [enabled]);

  return <div ref={ref} style={{ display: "contents" }} data-school-language={enabled ? "plain" : "standard"}>{children}</div>;
}
