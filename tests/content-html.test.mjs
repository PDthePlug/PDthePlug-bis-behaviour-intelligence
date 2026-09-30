import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { sanitizeContentHtml, sanitizeRuntimePackage } from "../lib/content-html.mjs";

test("encoded executable links, event handlers and active embedded documents are removed", () => {
  const dirty = '<p onclick="run()">Keep this wording</p><a href="java&#x73;cript:run()">link</a><img src="x" onerror="run()"><iframe srcdoc="bad"></iframe><svg onload="run()"></svg><form action="https://outside.invalid"><input formaction="javascript:run()"></form><style>body{display:none}</style><script>run()</script>';
  const clean = sanitizeContentHtml(dirty);
  assert.match(clean, /Keep this wording/);
  assert.doesNotMatch(clean, /onclick|onerror|onload|javascript|iframe|svg|formaction|<form|<script|<style/);
});

test("workbook identity, options and values survive sanitization", () => {
  const clean = sanitizeContentHtml('<label for="answer">Evidence</label><textarea id="answer" data-field-id="HAB.WB.TEST" data-source-key="source" data-purpose="LEARNING_RESPONSE" data-privacy-class="P3" rows="4">A &amp; B</textarea><select><option value="yes" selected>Yes</option></select>');
  for (const text of ['data-field-id="HAB.WB.TEST"', 'data-source-key="source"', 'data-privacy-class="P3"', 'A &amp; B', 'value="yes"']) assert.ok(clean.includes(text));
});

test("historical runtime packages sanitize HTML without editing learner prompts", () => {
  const value = sanitizeRuntimePackage({ treatment: { pages: [{ html: '<img src="x" onerror="bad()">' }] }, investigations: [{ introHtml: '<script>bad()</script>Intro', prompts: [{ prompt: 'A < B?' }], blocks: [{ type: 'HTML', html: '<a href="javascript:bad()">safe text</a>' }] }] });
  assert.equal(value.investigations[0].prompts[0].prompt, 'A < B?');
  assert.doesNotMatch(JSON.stringify(value), /onerror|javascript|<script/);
});

test("all 15 published packages retain every bound control after sanitization", async () => {
  const root = new URL('../public/handbooks/v1/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  for (const item of manifest.handbooks) {
    const encoded = await readFile(new URL(item.asset, root), 'utf8');
    const programme = JSON.parse(gunzipSync(Buffer.from(encoded.trim(), 'base64')));
    for (const page of programme.treatment.pages) {
      const ids = (html) => [...html.matchAll(/data-field-id="([^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(ids(sanitizeContentHtml(page.html)), ids(page.html), `${item.code}/${item.edition}/${page.key}`);
    }
  }
});
