import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("programme outcomes expose a real PDF export route", async () => {
  const [view, route, pdf] = await Promise.all([
    source("app/programme-outcomes-view.tsx"),
    source("app/api/staff/route.ts"),
    source("lib/programme-report-pdf.ts"),
  ]);

  assert.match(view, /Download PDF/);
  assert.match(view, /report=pdf/);
  assert.match(route, /url\.searchParams\.get\("report"\) === "pdf"/);
  assert.match(route, /content-type": "application\/pdf"/);
  assert.match(route, /PROGRAMME_REPORT_EXPORTED/);
  assert.match(pdf, /%PDF-1\.4/);
  assert.match(pdf, /Programme Outcomes Report/);
  assert.match(pdf, /LEARNING JOURNEY/);
  assert.match(pdf, /Recurring structured challenges/);
  assert.match(pdf, /Group shifts/);
});

test("demo cohort is explicitly synthetic, isolated and reproducible", async () => {
  const seed = await source("scripts/seed-bis-reporting-demo.sql");

  assert.match(seed, /BIS-DEMO-HAB-20/);
  assert.match(seed, /BIS Demonstration — 20-person Habit Lab/);
  assert.match(seed, /for i in 1\.\.20 loop/);
  assert.match(seed, /@bis\.invalid/);
  assert.match(seed, /DEMO-HAB-/);
  assert.match(seed, /Synthetic demonstration support request/);
  assert.doesNotMatch(seed, /insert into auth\.users/i);
  assert.match(seed, /on conflict/);
});

test("demo cohort exercises mixed outcomes instead of a perfect success story", async () => {
  const seed = await source("scripts/seed-bis-reporting-demo.sql");

  assert.match(seed, /when i <= 16 then/);
  assert.match(seed, /when i = 15 then 1/);
  assert.match(seed, /else 0/);
  assert.match(seed, /when i=10 then case when d=1 then true else false end/);
  assert.match(seed, /array\[2,5,9,13,17\]/);
  assert.match(seed, /LEARNER_REQUEST/);
});

test("organisation report summaries adapt to the evidence rather than forcing positive language", async () => {
  const view = await source("app/programme-outcomes-view.tsx");

  assert.match(view, /Participation falls sharply across the learning journey/);
  assert.match(view, /Participation is thinning as the programme progresses/);
  assert.match(view, /Participation remains strong across the learning journey/);
  assert.match(view, /The evidence base is mixed/);
  assert.match(view, /More real-world evidence is still needed/);
  assert.match(view, /Some participants moved into action/);
});
