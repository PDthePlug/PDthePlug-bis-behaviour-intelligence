"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { UniversalAuthoredDocumentDefinition, UniversalAuthoredField } from "@/lib/universal-authored-document.mjs";
import { UniversalResponseControl } from "./universal-response-control";

/** Render only compiled answer slots. Never infer questions or manufacture controls from prose. */
export function UniversalContentDocument({ document, html = document?.html ?? "", values = {}, onValue = () => {}, disabled = false, className, evidenceValues = {}, as: Tag = "div" }: {
  document?: UniversalAuthoredDocumentDefinition;
  as?: "article" | "div";
  html?: string;
  values?: Record<string, string>;
  onValue?: (field: UniversalAuthoredField, value: string) => void;
  disabled?: boolean;
  className?: string;
  evidenceValues?: Record<string, string>;
}) {
  const [slots, setSlots] = useState<Map<string, HTMLElement>>(() => new Map());
  // Preserve the mounted slot nodes while a controlled answer changes. A new
  // innerHTML prop object would let React replace the portal containers.
  const markup = useMemo(() => ({ __html: html }), [html]);
  const bindSlots = useCallback((root: HTMLElement | null) => {
    if (!root) return;
    const next = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>("[data-universal-response-slot]").forEach(slot => next.set(slot.dataset.universalResponseSlot!, slot));
    setSlots(previous => next.size || previous.size ? next : previous);
  }, []);
  return <>
    <Tag key={html} className={className} ref={bindSlots} data-universal-document={document?.schemaVersion ?? "universal-authored-document-1"} dangerouslySetInnerHTML={markup} />
    {document?.fields.map(field => {
      const slot = slots.get(field.id);
      if (!slot) return null; // A Day 3 segment renders only the slots inside that segment.
      const attributes = { "data-field-id": field.id, "data-source-key": field.sourceKey, "data-purpose": field.purpose, "data-privacy-class": field.privacyClass };
      const fromEvidence = Object.hasOwn(evidenceValues, field.valueKey);
      const value = fromEvidence ? evidenceValues[field.valueKey] : values[field.id] ?? "";
      const control = field.control === "CHECKBOX" || field.control === "RADIO"
        ? <input {...attributes} aria-label={field.label} type={field.control === "CHECKBOX" ? "checkbox" : "radio"} disabled={disabled || field.readOnly} checked={value === (field.choiceValue || "true")} onChange={event => onValue(field, event.target.checked ? field.choiceValue || "true" : "")} />
        : <UniversalResponseControl prompt={fromEvidence ? { ...field, readOnly: true } : field} compact nativeChoice line={field.control === "LINE"} rows={field.rows} value={value} onValue={next => onValue(field, next)} disabled={disabled} attributes={attributes} />;
      return createPortal(control, slot, field.id);
    })}
  </>;
}
