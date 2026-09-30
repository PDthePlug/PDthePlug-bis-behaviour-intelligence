"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { learnerText, type LearnerEdition } from "@/lib/school-language";

const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

function adaptElement(root: HTMLElement, edition?: LearnerEdition | null) {
  if (!edition) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    const parent = text.parentElement;
    if (
      parent &&
      !SKIP.has(parent.tagName) &&
      !parent.closest("[data-edition-language='keep-technical']") &&
      !parent.closest("[data-school-language='keep-technical']")
    ) {
      nodes.push(text);
    }
    current = walker.nextNode();
  }

  for (const node of nodes) {
    const before = node.nodeValue ?? "";
    const after = learnerText(before, edition);
    if (after !== before) node.nodeValue = after;
  }

  root.querySelectorAll<HTMLElement>("[aria-label],[title],[placeholder]").forEach((element) => {
    if (
      element.closest("[data-edition-language='keep-technical']") ||
      element.closest("[data-school-language='keep-technical']")
    ) return;

    for (const attribute of ["aria-label", "title", "placeholder"] as const) {
      const before = element.getAttribute(attribute);
      if (!before) continue;
      const after = learnerText(before, edition);
      if (after !== before) element.setAttribute(attribute, after);
    }
  });
}

export function EditionLanguageScope({
  edition,
  enabled = true,
  children,
}: {
  edition?: LearnerEdition | null;
  enabled?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !edition || !ref.current) return;
    const root = ref.current;
    adaptElement(root, edition);

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        adaptElement(root, edition);
      });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [edition, enabled]);

  return (
    <div
      ref={ref}
      style={{ display: "contents" }}
      data-edition-language={enabled && edition ? edition : "standard"}
    >
      {children}
    </div>
  );
}

// Backward-compatible wrapper retained while School Edition code and older
// tests migrate to the edition-aware scope.
export function SchoolLanguageScope({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return <EditionLanguageScope edition={enabled ? "school" : null}>{children}</EditionLanguageScope>;
}
