import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("ships the BIS responsive visual foundations in the Next.js source", async () => {
  const css = await read("app/globals.css");

  assert.match(css, /--ink:\s*#17313b/);
  assert.match(css, /--coral:\s*#e5654b/);
  assert.match(css, /\.adaptive-contextbar/);
  assert.match(css, /\.mobile-task-dock/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("delegates progress semantics and preserves the percentage transform", async () => {
  const progress = await read("components/ui/progress.tsx");

  assert.match(progress, /ProgressPrimitive\.Root/);
  assert.match(progress, /value=\{value\}/);
  assert.match(progress, /ProgressPrimitive\.Indicator/);
  assert.match(progress, /100 - \(value \?\? 0\)/);
});

test("emits chart themes through media-aware source rules", async () => {
  const chart = await read("components/ui/chart.tsx");

  assert.match(chart, /dark:\s*"\(prefers-color-scheme: dark\)"/);
  assert.match(chart, /data-chart=\{chartId\}/);
  assert.match(chart, /return media \? `@media \$\{media\}/);
  assert.doesNotMatch(chart, /\.dark\s/);
});

test("keeps sidebar skeleton widths deterministic", async () => {
  const sidebar = await read("components/ui/sidebar.tsx");

  assert.match(sidebar, /const width = "70%"/);
  assert.match(sidebar, /"--skeleton-width": width/);
  assert.doesNotMatch(sidebar, /Math\.random|crypto\.randomUUID/);
});
