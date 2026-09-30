import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("all Day 3 Lab handovers use one light editorial component", async () => {
  const [player, css] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/learning/programme-player.css"),
  ]);

  assert.match(player, /prototype-lab-handoff \$\{live \? "live" : "planned"\}/);
  assert.match(player, /DAY 3 · LAB HANDOVER/);
  assert.match(player, /Lab ready/);
  assert.match(player, /Planned integration/);
  assert.match(player, /Phase A/);
  assert.match(player, /BIS_LAB_PHASE_A_MINUTES/);
  assert.match(player, /prototype-lab-handoff-action/);

  const handoffStart = css.indexOf(".prototype-lab-handoff{");
  const handoffEnd = css.indexOf(".prototype-btn-disabled", handoffStart);
  assert.ok(handoffStart >= 0 && handoffEnd > handoffStart);
  const handoffCss = css.slice(handoffStart, handoffEnd);

  assert.match(handoffCss, /background:#f6f3eb/);
  assert.match(handoffCss, /\.prototype-lab-handoff\.live\{background:#f7f6f1/);
  assert.match(handoffCss, /\.prototype-lab-handoff-action\{[^}]*background:var\(--p-accent\)/);
  assert.doesNotMatch(handoffCss, /\.prototype-lab-handoff\{[^}]*background:var\(--p-accent\)/);
  assert.doesNotMatch(handoffCss, /\.prototype-lab-handoff\.planned\{[^}]*background:/);
});

test("Decision handbook source typography is normalised without changing authored content", async () => {
  const [enhancement, css] = await Promise.all([
    source("app/learning/handbook-document-enhancements.ts"),
    source("app/learning/programme-player.css"),
  ]);

  assert.match(enhancement, /function normaliseDecisionHandbookLayout/);
  assert.match(enhancement, /if \(labCode !== "DEC"\) return/);
  assert.match(enhancement, /root\.dataset\.handbookLayout = "decision-normalised"/);
  for (const property of ["font-size", "line-height", "font-family", "letter-spacing", "margin-top", "margin-bottom"]) {
    assert.ok(enhancement.includes(`"${property}"`), `Decision normaliser should govern ${property}`);
  }
  assert.match(enhancement, /element\.style\.removeProperty\(property\)/);
  assert.match(enhancement, /decision-handbook-meta-line/);
  assert.match(enhancement, /decision-handbook-meta-heading/);
  assert.match(enhancement, /normaliseDecisionHandbookLayout\(root, labCode\)/);

  assert.match(css, /data-handbook-layout="decision-normalised"/);
  assert.match(css, /decision-handbook-meta-line/);
  assert.match(css, /decision-handbook-meta-heading/);
});

test("Decision layout normalisation remains module-scoped", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");
  const start = enhancement.indexOf("function normaliseDecisionHandbookLayout");
  const end = enhancement.indexOf("function softenLearnerTechnicalLabels", start);
  assert.ok(start >= 0 && end > start);
  const block = enhancement.slice(start, end);

  assert.match(block, /labCode !== "DEC"/);
  assert.doesNotMatch(block, /HAB|MON|IDN|ATT/);
});
