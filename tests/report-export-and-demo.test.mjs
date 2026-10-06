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
  assert.match(route, /searchParams\.get\("report"\)/);
  assert.match(route, /content-type": "application\/pdf"/);
  assert.match(route, /PROGRAMME_REPORT_EXPORTED/);
  assert.match(pdf, /import PDFDocument from "pdfkit"/);
  assert.match(pdf, /buildProgrammeReport/);
  assert.match(pdf, /Executive summary/);
  assert.match(pdf, /KEY FINDINGS/);
  assert.match(pdf, /Learning journey/);
  assert.match(pdf, /Behaviour in practice/);
  assert.match(pdf, /How much information we have/);
  assert.match(pdf, /Programme review/);
  assert.match(pdf, /They do not prescribe programme changes/);
  assert.match(pdf, /REPORTING NOTES/);

});

test("canonical PR #111 demo is explicitly synthetic, isolated and reproducible", async () => {
  const [audit, execution, contract, retiredSeed] = await Promise.all([
    source("docs/BIS_INTELLIGENCE_AUDIT_20261004.md"),
    source("docs/BIS_DEMO_EXECUTION_20261004.md"),
    source("docs/BIS_CANONICAL_DEMO_20261005.md"),
    source("scripts/seed-bis-reporting-demo.sql"),
  ]);

  assert.match(execution, /20 learner, one SYSTEM_ADMIN and one FACILITATOR account/i);
  assert.match(execution, /BIS Staging/);
  assert.match(execution, /Production was not accessed or altered/);
  assert.match(execution, /300 current responses across 20 learners/);
  assert.match(audit, /not evidence of student behaviour change or programme effectiveness/i);
  assert.match(contract, /PR #111.*supersedes.*PR #32/is);
  assert.match(retiredSeed, /RETIRED: PR #32-era Leap9 production demo seed/);
  assert.match(retiredSeed, /intentionally fails closed/);
  assert.doesNotMatch(retiredSeed, /insert into auth\.users/i);
});

test("canonical demo preserves mixed and incomplete evidence instead of a perfect success story", async () => {
  const [audit, execution] = await Promise.all([
    source("docs/BIS_INTELLIGENCE_AUDIT_20261004.md"),
    source("docs/BIS_DEMO_EXECUTION_20261004.md"),
  ]);

  assert.match(audit, /zero real-world observations/);
  assert.match(audit, /no completed seven-day real-world observation cycle/);
  assert.match(audit, /not improvement/);
  assert.match(execution, /one optional question deliberately passed/);
  assert.match(execution, /do not certify completion of Phase A/i);
  assert.match(execution, /Remaining release gates:.*complete Phase A/i);
  assert.match(execution, /Do not infer behaviour change/i);
});

test("organisation report summaries use exact descriptive findings without arbitrary performance thresholds", async () => {
  const [view,model] = await Promise.all([source("app/programme-outcomes-view.tsx"),source("lib/programme-intelligence.mjs")]);
  assert.match(view, /buildProgrammeReport/);
  assert.match(model, /No real-world testing is recorded yet/);
  assert.match(model, /Unavailable information is not zero participation/);
  assert.doesNotMatch(model, /attemptRate >=|retained >=|useful base/);
});


test("PDF engine includes reusable professional report primitives", async () => {
  const pdf = await source("lib/programme-report-pdf.ts");

  for (const primitive of ["measure(", "paragraph(", "chart(", "table(", "section("]) assert.ok(pdf.includes(primitive));
  assert.match(pdf, /DejaVuSerif-Bold/);
  assert.match(pdf, /Behaviour Intelligence Series/);
  assert.match(pdf, /GROUP-LEVEL REPORT/);
  assert.match(pdf, /What the programme results are showing/);
  assert.match(pdf, /What may be worth exploring next/);

});
