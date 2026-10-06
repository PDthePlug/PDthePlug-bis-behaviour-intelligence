import assert from "node:assert/strict";
import test from "node:test";
import { learnerHeadingHtml, learnerHeadingText } from "../lib/learner-heading-presentation.mjs";

test("heading decoration is removed without changing authored wording or useful notation", () => {
  assert.equal(learnerHeadingText("📖 Step 3 — Identify the Routine"), "Step 3 — Identify the Routine");
  assert.equal(learnerHeadingText("🌱 Today's Insight"), "Today's Insight");
  for (const meaningful of ["✓ Evidence verified", "☐ My answer", "1 — First observation", "✅ Checkpoint", "Δ Change", "🟢 Observe"]) {
    assert.equal(learnerHeadingText(meaningful), meaningful);
  }
});

test("HTML heading cleanup preserves prose, tables, controls and source content outside headings", () => {
  const html = '<h2><strong>📖 The Loop</strong></h2><p>📖 is the reading symbol.</p><table><tr><td>🌱 Reflect</td></tr></table><input data-field-id="HAB.I2.Q1" value="📖" />';
  const cleaned = '<h2><strong>The Loop</strong></h2><p>📖 is the reading symbol.</p><table><tr><td>🌱 Reflect</td></tr></table><input data-field-id="HAB.I2.Q1" value="📖" />';
  assert.equal(learnerHeadingHtml(html), cleaned);
  assert.equal(learnerHeadingHtml(cleaned), cleaned);
});
