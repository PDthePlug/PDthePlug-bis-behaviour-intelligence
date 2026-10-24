"use client";

import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UniversalLabPrompt } from "@/lib/content-compiler";

/** One response primitive for Lab prompts and responses placed inside authored documents. */
export function UniversalResponseControl({ prompt, value, onValue, disabled = false, compact = false, line = false, rows = 3, attributes = {}, nativeChoice = false }: {
  prompt: UniversalLabPrompt;
  value: string;
  onValue: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  nativeChoice?: boolean;
  line?: boolean;
  rows?: number;
  attributes?: Record<string, string>;
}) {
  const label = prompt.label;
  const shared = { "aria-label": label, disabled, value, ...attributes };
  if (prompt.readOnly) return <output {...attributes} aria-label={label} className="universal-computed-value">{value || "Available after recording the source evidence"}</output>;
  const options = prompt.type === "BOOLEAN" ? prompt.allowNoOpportunity ? ["Yes", "No", "No opportunity"] : ["Yes", "No"] : prompt.options ?? [];
  if (prompt.type === "MULTI_SELECT") {
    let values: string[] = [];
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) values = parsed.map(String); } catch { values = value.split("|").map(item => item.trim()).filter(Boolean); }
    const selected = new Set(values);
    return <div className="universal-multi-select">{options.map(option => <label key={option}><Checkbox disabled={disabled} checked={selected.has(option)} onCheckedChange={checked => {
      const next = new Set(selected);
      if (checked === true) next.add(option); else next.delete(option);
      onValue(JSON.stringify([...next]));
    }} /><span>{option}</span></label>)}</div>;
  }
  if (options.length) {
    if (compact && !nativeChoice) return <Select disabled={disabled} value={value} onValueChange={onValue}><SelectTrigger aria-label={label}><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
    if (compact) return <select {...shared} className="response workbook-choice-response" onChange={event => onValue(event.target.value)}><option value="">Choose…</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select>;
    return <div className="answer-list universal-choice-list" role="group" aria-label={label}>{options.map(option => <button type="button" key={option} className={value === option ? "selected" : ""} aria-pressed={value === option} disabled={disabled} onClick={() => onValue(option)}><span>{value === option ? <Check /> : null}</span>{option}</button>)}</div>;
  }
  if (prompt.type === "INTEGER" && prompt.controlRole === "RATING" && !nativeChoice) {
    const ratingOptions = Array.from({ length: Number(prompt.max) - Number(prompt.min) + 1 }, (_, index) => Number(prompt.min) + index).map(option => (
      <button type="button" key={option} className={value === String(option) ? "selected" : ""} aria-pressed={value === String(option)} disabled={disabled} onClick={() => onValue(String(option))}>{option}</button>
    ));
    if (compact) return <span className="universal-rating-options" role="group" aria-label={label}>{ratingOptions}</span>;
    return <div className="universal-rating-scale" role="group" aria-label={label}>
      <div className="universal-rating-options">{ratingOptions}</div>
      <div className="universal-rating-anchors">
        <span>{prompt.min} · {/confidence|confident/i.test(`${label} ${prompt.prompt}`) ? "Not confident" : "Lower"}</span>
        <span>{prompt.max} · {/confidence|confident/i.test(`${label} ${prompt.prompt}`) ? "Very confident" : "Higher"}</span>
      </div>
    </div>;
  }
  if (prompt.type === "DATE" || prompt.type === "INTEGER" || line) return <Input {...shared} className={compact ? "response workbook-short-response" : undefined} type={prompt.type === "DATE" ? "date" : prompt.type === "INTEGER" ? "number" : "text"} min={prompt.min} max={prompt.max} step={prompt.type === "INTEGER" ? 1 : undefined} maxLength={20000} placeholder={prompt.type === "DATE" ? undefined : prompt.placeholder} onChange={event => onValue(event.target.value)} />;
  return <Textarea {...shared} className={compact ? "response compiled-workbook-response" : undefined} rows={rows} maxLength={20000} placeholder={prompt.placeholder ?? "Write your response here…"} onChange={event => onValue(event.target.value)} />;
}
