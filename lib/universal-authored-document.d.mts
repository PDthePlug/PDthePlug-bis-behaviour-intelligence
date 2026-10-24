export type UniversalAuthoredField = {
  id: string;
  sourceKey: string;
  label: string;
  prompt: string;
  valueKey: string;
  type: "TEXT" | "INTEGER" | "DATE" | "CATEGORICAL" | "BOOLEAN";
  control: "PARAGRAPH" | "LINE" | "CHECKBOX" | "RADIO";
  options?: string[];
  choiceValue?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  rows: number;
  purpose: string;
  privacyClass: string;
  readOnly: boolean;
};
export type UniversalAuthoredDocumentDefinition = {
  schemaVersion: "universal-authored-document-1";
  html: string;
  fields: UniversalAuthoredField[];
};
export const UNIVERSAL_DOCUMENT_VERSION: "universal-authored-document-1";
export function compileUniversalAuthoredDocument(html: string, options?: { pageKey?: string; pageTitle?: string }): UniversalAuthoredDocumentDefinition;
