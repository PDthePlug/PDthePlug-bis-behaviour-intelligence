import assert from "node:assert/strict";
import test from "node:test";
import { questionIntelligenceRegistry } from "../lib/question-intelligence.mjs";

test("question intelligence registers structured questions but excludes free text from automatic aggregation", () => {
  const rows = questionIntelligenceRegistry({
    presentationBaseline: {
      items: [{ id: "LAB.BASELINE.SCORE", label: "Starting confidence", prompt: "How confident are you?", type: "INTEGER", sensitivity: "P2" }],
    },
    investigations: [
      { number: 4, prompts: [
        { id: "LAB.I4.CONTEXT", label: "Context", prompt: "Where does this happen?", type: "CATEGORICAL", sensitivity: "P2" },
        { id: "LAB.I4.PRIVATE", label: "Private reflection", prompt: "Tell us what happened in your own words", type: "TEXT", sensitivity: "P2" },
        { id: "LAB.I4.SENSITIVE", label: "Sensitive detail", prompt: "Choose one", type: "CATEGORICAL", sensitivity: "P3" },
        { id: "LAB.I4.DERIVED", label: "Calculated score", type: "INTEGER", readOnly: true, computed: { operation: "PRODUCT", inputs: [] } },
      ]},
      { number: 7, prompts: [
        { id: "LAB.I7.ACTION", label: "Action taken", prompt: "Did you take the action?", type: "BOOLEAN", sensitivity: "P2" },
      ]},
    ],
  }, { labCode: "LDR", labVersion: "1.0", versionId: "version-1" });

  assert.equal(rows.length, 5);
  assert.equal(rows.every((row) => row.status === "CANDIDATE"), true);
  assert.equal(rows.find((row) => row.semanticFieldId === "LAB.BASELINE.SCORE")?.evidenceClass, "BASELINE");
  assert.equal(rows.find((row) => row.semanticFieldId === "LAB.I7.ACTION")?.evidenceClass, "OBSERVATION");
  assert.equal(rows.find((row) => row.semanticFieldId === "LAB.I4.CONTEXT")?.aggregatePolicy, "STRUCTURED_ONLY");
  assert.equal(rows.find((row) => row.semanticFieldId === "LAB.I4.PRIVATE")?.aggregatePolicy, "EXCLUDE");
  assert.equal(rows.find((row) => row.semanticFieldId === "LAB.I4.SENSITIVE")?.aggregatePolicy, "EXCLUDE");
  assert.equal(rows.some((row) => row.semanticFieldId === "LAB.I4.DERIVED"), false);
});

test("repeated wording maps to one stable question family without merging the evidence fields", () => {
  const rows = questionIntelligenceRegistry({
    investigations: [
      { number: 1, prompts: [{ id: "PRE", prompt: "How confident are you about this?", type: "INTEGER" }] },
      { number: 8, prompts: [{ id: "POST", prompt: "How confident are you about this?", type: "INTEGER" }] },
    ],
  }, { labCode: "LAB", labVersion: "1", versionId: "v" });

  assert.notEqual(rows[0].semanticFieldId, rows[1].semanticFieldId);
  assert.equal(rows[0].questionFamily, rows[1].questionFamily);
});
