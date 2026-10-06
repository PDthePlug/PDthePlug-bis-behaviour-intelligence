import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

const admin=await stagingSession();
await admin.browserState("/tmp/bis-hardening-admin-storage.json");
const prepared=JSON.parse(await readFile("/tmp/bis-hardening-learning-prepared.json","utf8"));
const axe=await readFile("/tmp/bis-hardening-axe.min.js","utf8");
const browser=await chromium.launch(),rows=process.env.BIS_HARDENING_PREVIEW_RESUME==="true"?JSON.parse(await readFile("/tmp/bis-hardening-learning-preview-audit.json","utf8")):[];
try {
 const context=await browser.newContext({storageState:"/tmp/bis-hardening-admin-storage.json"});
 const page=await context.newPage();let errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("response",response=>{if(response.status()>=400)errors.push(`${response.status()} ${new URL(response.url()).pathname}`);});
 for(const source of prepared.sources)for(const width of [360,430,1280])for(let position=1;position<=source.pages;position++) {
  if(rows.some(row=>row.edition===source.edition&&row.width===width&&row.position===position&&!row.violations.length&&!row.errors.length&&!row.unlabelled&&row.overflow<=1))continue;
  errors=[];await page.setViewportSize({width,height:900});
  await page.goto(admin.base+`/content-studio/preview/${encodeURIComponent(prepared.versionId)}/runtime?kind=LEARNING_MODULE&code=HAB&edition=${source.edition}&page=${position}`);
  await expect(page.locator(".prototype-document")).toBeVisible({timeout:30000});
  await page.waitForLoadState("networkidle");await page.addScriptTag({content:axe});
  const result=await page.evaluate(async()=>({overflow:document.documentElement.scrollWidth-innerWidth,violations:(await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),unlabelled:[...document.querySelectorAll("textarea,input:not([type=hidden]),select")].filter(e=>!e.labels?.length&&!e.getAttribute("aria-label")&&!e.getAttribute("aria-labelledby")).length}));
  const row={edition:source.edition,position,width,...result,errors:[...errors]};rows.push(row);
  await writeFile("/tmp/bis-hardening-learning-preview-audit.json",JSON.stringify(rows,null,2));console.log({edition:row.edition,position,width,overflow:row.overflow,violations:row.violations.length,unlabelled:row.unlabelled,errors:row.errors.length});
  if([2,4,12].includes(position))await page.screenshot({path:`/tmp/bis-hardening-evidence/learning-preview-${source.edition}-${position}-${width}.png`,fullPage:true});
 }
 assert.ok(rows.every(row=>row.overflow<=1&&!row.unlabelled&&!row.violations.length&&!row.errors.length),"Learning preview has a recorded unresolved defect.");
} finally {await browser.close();}
