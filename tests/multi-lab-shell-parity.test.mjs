import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("app/multi-lab-adaptive-shell.tsx", "utf8");
const css = readFileSync("app/multi-lab-shell.css", "utf8");
const decisionLayout = readFileSync("app/decision/layout.tsx", "utf8");
const moneyLayout = readFileSync("app/money/layout.tsx", "utf8");
const engine = readFileSync("app/core-lab-experience.tsx", "utf8");
const labApi = readFileSync("app/api/labs/route.ts", "utf8");

test("Decision and Money routes are owned by the same BIS multi-Lab shell", () => {
  assert.match(decisionLayout, /MultiLabAdaptiveShell lab="decision"/);
  assert.match(moneyLayout, /MultiLabAdaptiveShell lab="money"/);
  assert.match(decisionLayout, /multi-lab-shell\.css/);
  assert.match(moneyLayout, /multi-lab-shell\.css/);
});

test("multi-Lab navigation presents Habit, Decision and Money as one product family", () => {
  assert.match(shell, /Habit Programme/);
  assert.match(shell, /Decision Lab/);
  assert.match(shell, /Money Lab/);
  assert.match(shell, /href: "\/habit"/);
  assert.match(shell, /href: "\/decision"/);
  assert.match(shell, /href: "\/money"/);
  assert.match(shell, /Each Lab keeps its own evidence record/);
});

test("Decision and Money retain the five-question BIS orientation model", () => {
  for (const label of ["Where you are", "What this means", "Do now", "What happens next", "Where to get help"]) {
    assert.match(shell, new RegExp(label));
  }
  assert.match(shell, /Screen guide/);
  assert.match(shell, /Investigate/);
  assert.match(shell, /Experiment/);
  assert.match(shell, /Review/);
});

test("shared shell owns global chrome without deleting the Core Lab task engine", () => {
  assert.match(css, /\.multi-lab-shell \.corelab-header\{display:none!important\}/);
  assert.match(css, /\.multi-lab-shell \.corelab-progressbar\{position:sticky/);
  assert.match(engine, /definition\.investigations\.map/);
  assert.match(engine, /step === 7 && <CanonicalExperimentStep/);
  assert.match(engine, /step === 8 && <ReviewStep/);
  assert.match(engine, /step === 9 && <CanonicalFinalStep/);
});

test("multi-Lab parity includes keyboard, mobile and readable interaction hardening", () => {
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /menuButtonRef\.current\?\.focus/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-x:auto/);
});

test("shell parity does not collapse Decision and Money evidence into Habit", () => {
  assert.match(engine, /labCode: definition\.code/);
  assert.match(labApi, /labCode/);
  assert.match(labApi, /DEC|MON/);
});
