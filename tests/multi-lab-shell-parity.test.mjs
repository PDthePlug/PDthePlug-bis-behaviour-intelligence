import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("app/multi-lab-adaptive-shell.tsx", "utf8");
const css = readFileSync("app/multi-lab-shell.css", "utf8");
const flowCss = readFileSync("app/multi-lab-flow-cleanup.css", "utf8");
const decisionLayout = readFileSync("app/decision/layout.tsx", "utf8");
const moneyLayout = readFileSync("app/money/layout.tsx", "utf8");
const engine = readFileSync("app/core-lab-experience.tsx", "utf8");
const labApi = readFileSync("app/api/labs/route.ts", "utf8");

test("Decision and Money routes are owned by the same BIS multi-Lab shell", () => {
  assert.match(decisionLayout, /MultiLabAdaptiveShell lab="decision"/);
  assert.match(moneyLayout, /MultiLabAdaptiveShell lab="money"/);
  assert.match(decisionLayout, /multi-lab-shell\.css/);
  assert.match(moneyLayout, /multi-lab-shell\.css/);
  assert.match(decisionLayout, /multi-lab-flow-cleanup\.css/);
  assert.match(moneyLayout, /multi-lab-flow-cleanup\.css/);
});

test("multi-Lab navigation presents the BIS destinations and Profile", () => {
  assert.match(shell, /Habit Programme/);
  assert.match(shell, /Decision Lab/);
  assert.match(shell, /Money Lab/);
  assert.match(shell, /Profile/);
  assert.match(shell, /href: "\/habit"/);
  assert.match(shell, /href: "\/decision"/);
  assert.match(shell, /href: "\/money"/);
  assert.match(shell, /href: "\/profile"/);
  assert.doesNotMatch(shell, /Each Lab keeps its own evidence record/);
});

test("Decision and Money put the active task before repeated explanatory chrome", () => {
  assert.doesNotMatch(shell, /Screen guide/);
  assert.doesNotMatch(shell, /multi-lab-orientation/);
  assert.doesNotMatch(shell, /multi-lab-mobile-guide/);
  assert.doesNotMatch(shell, /multi-lab-route-banner/);
  assert.doesNotMatch(shell, /Phase A · 90 minutes · Phase B · 7 days/);
  assert.match(flowCss, /corelab-progressbar[\s\S]*margin-top:\s*0/);
});

test("shared shell owns global chrome without deleting the Core Lab task engine", () => {
  assert.match(css, /\.multi-lab-shell \.corelab-header\{display:none!important\}/);
  assert.match(css, /\.multi-lab-shell \.corelab-progressbar\{position:sticky/);
  assert.match(engine, /definition\.investigations\.map/);
  assert.match(engine, /step === 7 && <CanonicalExperimentStep/);
  assert.match(engine, /step === 8 && <ReviewStep/);
  assert.match(engine, /step === 9 && <CanonicalFinalStep/);
});

test("Decision and Money welcome surfaces hide internal catalogue metadata", () => {
  assert.match(css, /corelab-welcome \.fidelity-hero \[data-slot="badge"\]/);
  assert.match(css, /corelab-welcome \.fidelity-hero dl\{display:none\}/);
});

test("multi-Lab parity includes keyboard, mobile and readable interaction hardening", () => {
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /menuButton\?\.focus/);
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
