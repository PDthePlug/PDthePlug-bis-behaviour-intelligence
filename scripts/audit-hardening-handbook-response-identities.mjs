import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import ts from "typescript";
import { chromium } from "@playwright/test";

// Runs both actual enhancement implementations in an isolated browser DOM.
// No authentication, application writes or production connection is involved.
const baseline = "63118cf512b459b0f89a271687bd1e1fc7da57d9";
const base = "http://127.0.0.1:3100";
const modules = new Map();
async function moduleUrl(file, variant) {
  const url = `${base}/__bis_identity_audit/${variant}/${file}`;
  if (modules.has(url)) return url;
  modules.set(url, "");
  const source = variant === "baseline" ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : await readFile(file, "utf8");
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, allowJs: true } }).outputText;
  for (const match of [...compiled.matchAll(/from\s+["']([^"']+)["']/g)]) {
    assert.ok(match[1].startsWith("."), "Only the reader's relative browser dependencies are allowed");
    let dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
    if (!path.posix.extname(dependency)) dependency += ".ts";
    compiled = compiled.replace(match[0], `from ${JSON.stringify(await moduleUrl(dependency, variant))}`);
  }
  modules.set(url, compiled);
  return url;
}
const entry = "app/learning/handbook-document-enhancements.ts";
const original = await moduleUrl(entry, "baseline"), current = await moduleUrl(entry, "current");
const browser = await chromium.launch();
const rows = [];
try {
  const page = await browser.newPage();
  await page.route("**/__bis_identity_audit/**", route => route.fulfill({ contentType: "text/javascript", body: modules.get(route.request().url()) ?? "throw Error('Unknown audit module')" }));
  await page.goto(`${base}/reader-hardening`);
  await page.locator('[data-specimen="money-emerging_adult"]').waitFor();
  await page.setContent('<div id="baseline"></div><div id="current"></div>');
  await page.addScriptTag({ type: "module", content: `window.bisIdentityAudit = { baseline: await import(${JSON.stringify(original)}), current: await import(${JSON.stringify(current)}) };` });
  await page.waitForFunction(() => Boolean(window.bisIdentityAudit));
  for (const slug of ["habit", "decision", "money", "identity", "attention"]) for (const edition of ["school", "emerging_adult", "workplace"]) {
    const file = `public/handbooks/v1/${slug}-${edition}.json.gz.b64`;
    const source = await readFile(file, "utf8");
    assert.equal(source, execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }), "Accepted source package changed");
    const handbook = JSON.parse(gunzipSync(Buffer.from(source, "base64")));
    for (const specimen of handbook.treatment.pages) {
      const fields = await page.evaluate(({ code, specimen }) => Object.fromEntries(["baseline", "current"].map(variant => {
        const root = document.getElementById(variant); root.innerHTML = specimen.html;
        for (let pass = 0; pass < 4; pass++) window.bisIdentityAudit[variant].enhanceHandbookDocument(root, code, specimen.id, { programmeDay: specimen.programmeDay, pageTitle: specimen.label, enableFormativeLearningChecks: true });
        return [variant, [...root.querySelectorAll("[data-field-id]")].map(field => ({ id: field.getAttribute("data-field-id"), key: field.getAttribute("data-source-key"), purpose: field.getAttribute("data-purpose") })).sort((a, b) => a.id.localeCompare(b.id))];
      })), { code: handbook.labCode, specimen });
      assert.deepEqual(fields.current, fields.baseline, `${handbook.labCode} ${edition} ${specimen.key}: accepted response identities changed`);
      rows.push({ module: handbook.labCode, edition, page: specimen.key, semanticStepId: specimen.id, count: fields.current.length, digest: createHash("sha256").update(JSON.stringify(fields.current)).digest("hex"), result: "PASS" });
    }
  }
  await writeFile("docs/hardening/handbook-response-integrity.json", JSON.stringify({ baseline, result: "PASS", boundary: "All 195 accepted source page/edition variants, original/current enhancement modules after four passes. Field IDs, source keys and purposes compared, including radio option controls. Source packages compared byte-for-byte. This does not certify every live historical publication or every manual page review.", pages: rows }, null, 2) + "\n");
  console.log({ result: "PASS", pages: rows.length, renderedControls: rows.reduce((count, row) => count + row.count, 0), originalSourcesPreserved: true });
} finally { await browser.close(); }
