import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const frame = readFileSync("app/lab-investigation-frame.tsx", "utf8");
const frameCss = readFileSync("app/lab-investigation-frame.css", "utf8");
const decisionLayout = readFileSync("app/decision/layout.tsx", "utf8");
const moneyLayout = readFileSync("app/money/layout.tsx", "utf8");
const habitLayout = readFileSync("app/habit-lab/layout.tsx", "utf8");
const habitShell = readFileSync("app/habit-lab/habit-lab-shell.tsx", "utf8");
const habitEngine = readFileSync("app/bis-app.tsx", "utf8");
const coreEngine = readFileSync("app/core-lab-experience.tsx", "utf8");
const labApi = readFileSync("app/api/labs/route.ts", "utf8");
const manifest = readFileSync("lib/lab-experience-manifest.ts", "utf8");

test("Habit, Decision and Money use the same canonical BIS learner shell", () => {
  for (const source of [decisionLayout, moneyLayout, habitLayout]) {
    assert.match(source, /CanonicalAdaptiveShell/);
    assert.match(source, /canonical-shell\.css/);
    assert.match(source, /learner-readability\.css/);
    assert.match(source, /lab-investigation-frame\.css/);
  }
  assert.doesNotMatch(decisionLayout, /MultiLabAdaptiveShell/);
  assert.doesNotMatch(moneyLayout, /MultiLabAdaptiveShell/);
});

test("one universal investigation frame owns progress, navigation and mission presentation", () => {
  assert.match(frame, /export function LabInvestigationFrame/);
  assert.match(frame, /export function LabMissionHeader/);
  assert.match(frame, /universal-lab-progress/);
  assert.match(frame, /universal-investigation-nav/);
  assert.match(frame, /universal-lab-mission/);
  assert.match(frame, /investigation\.produces/);
  assert.match(frame, /investigation\.difficulty/);
});

test("Habit and Core Labs both render through the same investigation frame", () => {
  assert.match(habitEngine, /<LabInvestigationFrame/);
  assert.match(habitEngine, /labTitle=\{labExperienceManifest\.HAB\.shortTitle\}/);
  assert.match(habitEngine, /investigations=\{investigations\}/);
  assert.match(coreEngine, /<LabInvestigationFrame/);
  assert.match(coreEngine, /labTitle=\{definition\.shortTitle\}/);
  assert.match(coreEngine, /investigations=\{definition\.investigations\}/);
});

test("individual Lab routes no longer add competing learner chrome", () => {
  assert.doesNotMatch(habitShell, /habit-lab-route-header/);
  assert.doesNotMatch(habitShell, /FocusedLearnerMenu/);
  assert.doesNotMatch(coreEngine, /<header className="corelab-header"/);
  assert.doesNotMatch(coreEngine, /className="corelab-progressbar"/);
  assert.doesNotMatch(coreEngine, /className="corelab-rail"/);
});

test("universal Lab CSS defines one mobile grammar for all Labs", () => {
  assert.match(frameCss, /\.universal-lab-progress/);
  assert.match(frameCss, /\.universal-investigation-nav/);
  assert.match(frameCss, /\.universal-lab-stage/);
  assert.match(frameCss, /\.universal-lab-mission/);
  assert.match(frameCss, /@media\(max-width:820px\)/);
  assert.match(frameCss, /@media\(max-width:430px\)/);
  assert.match(frameCss, /prefers-reduced-motion/);
  assert.match(frameCss, /canonical-shell \.corelab-welcome>header\{display:none\}/);
});

test("shared presentation does not collapse separate Lab evidence namespaces", () => {
  assert.match(coreEngine, /labCode: definition\.code/);
  assert.match(labApi, /labCode/);
  assert.match(labApi, /DEC|MON/);
  assert.match(habitEngine, /HAB\./);
});


test("future Lab presentation is registered through a manifest rather than route-specific chrome", () => {
  for (const code of ["HAB", "DEC", "MON"]) {
    assert.match(manifest, new RegExp(code + ": \\{"));
  }
  assert.match(manifest, /investigations: 9/);
  assert.match(habitEngine, /labExperienceManifest\.HAB\.accent/);
  assert.match(coreEngine, /definition\.accent/);
});


test("Core Lab navigation uses URL history while respecting unlocked progress", () => {
  assert.match(coreEngine, /useSearchParams/);
  assert.match(coreEngine, /params\.set\("step", String\(target\)\)/);
  assert.match(coreEngine, /router\.push\(/);
  assert.match(coreEngine, /const maxAllowed = allowAdvance \? Math\.min\(9, maxStep \+ 1\) : maxStep/);
  assert.match(coreEngine, /next=\{\(\) => goToStep\(2, true\)\}/);
});
