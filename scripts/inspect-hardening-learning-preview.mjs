import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

const admin=await stagingSession();
const stateFile=process.env.BIS_HARDENING_PREVIEW_ADMIN_STATE_FILE || "/tmp/bis-hardening-admin-storage.json";
const auditFile=process.env.BIS_HARDENING_LEARNING_PREVIEW_AUDIT_FILE || "/tmp/bis-hardening-learning-preview-audit.json";
const evidenceDir=process.env.BIS_HARDENING_LEARNING_PREVIEW_EVIDENCE_DIR || "/tmp/bis-hardening-evidence";
await mkdir(evidenceDir,{recursive:true});
await admin.browserState(stateFile);
const prepared=JSON.parse(await readFile(process.env.BIS_HARDENING_LEARNING_PREPARED_FILE || "/tmp/bis-hardening-learning-prepared.json","utf8"));
const axe=await readFile("/tmp/bis-hardening-axe.min.js","utf8");
const browser=await chromium.launch(),rows=process.env.BIS_HARDENING_PREVIEW_RESUME==="true"?JSON.parse(await readFile(auditFile,"utf8")):[];
assert.ok(rows.every(row=>row.versionId===prepared.versionId),"Resumed preview evidence must belong to this exact version; start a fresh sweep for older unbound records.");
try {
 const context=await browser.newContext({storageState:stateFile});
 const page=await context.newPage();let errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("response",response=>{if(response.status()>=400)errors.push(`${response.status()} ${new URL(response.url()).pathname}`);});
 for(const source of prepared.sources)for(const width of [360,430,1280])for(let position=1;position<=source.pages;position++) {
  if(rows.some(row=>row.edition===source.edition&&row.width===width&&row.position===position&&!row.violations.length&&!row.errors.length&&!row.unlabelled&&row.overflow<=1))continue;
  errors=[];await page.setViewportSize({width,height:900});
  await page.goto(admin.base+`/content-studio/preview/${encodeURIComponent(prepared.versionId)}/runtime?kind=LEARNING_MODULE&code=HAB&edition=${source.edition}&page=${position}`);
  await expect(page.locator(".prototype-document")).toBeVisible({timeout:30000});
  await page.waitForLoadState("networkidle");
  let previewInputIsolation="NOT_CHECKED";
  if(process.env.BIS_HARDENING_LEARNING_VERIFY_PREVIEW_ISOLATION==="true" && position===2) {
   const field=page.locator(".prototype-document textarea:not(:disabled)").first();
   await expect(field).toBeVisible();
   const fieldId=await field.getAttribute("data-field-id"),originalValue=await field.inputValue();
   assert.ok(fieldId,"Preview controls retain their authored identity");
   await field.fill("Synthetic preview-only response: must not become a learner record.");
   await expect(field).toHaveValue("Synthetic preview-only response: must not become a learner record.");
   await page.reload();await expect(page.locator(".prototype-document")).toBeVisible({timeout:30000});await page.waitForLoadState("networkidle");
   await expect(page.locator(`[data-field-id="${fieldId}"]`)).toHaveValue(originalValue);
   previewInputIsolation="PASS: preview-only value does not survive as a learner response";
  }
  await page.addScriptTag({content:axe});
  const result=await page.evaluate(async()=>({overflow:document.documentElement.scrollWidth-innerWidth,violations:(await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),unlabelled:[...document.querySelectorAll("textarea,input:not([type=hidden]),select")].filter(e=>!e.labels?.length&&!e.getAttribute("aria-label")&&!e.getAttribute("aria-labelledby")).length}));
  const row={versionId:prepared.versionId,edition:source.edition,position,width,...result,previewInputIsolation,errors:[...errors]};rows.push(row);
  await writeFile(auditFile,JSON.stringify(rows,null,2));console.log({edition:row.edition,position,width,overflow:row.overflow,violations:row.violations.length,unlabelled:row.unlabelled,errors:row.errors.length});
  if([2,4,12].includes(position))await page.screenshot({path:`${evidenceDir}/learning-preview-${source.edition}-${position}-${width}.png`,fullPage:true});
 }
 assert.ok(rows.every(row=>row.overflow<=1&&!row.unlabelled&&!row.violations.length&&!row.errors.length),"Learning preview has a recorded unresolved defect.");
} finally {await browser.close();}
