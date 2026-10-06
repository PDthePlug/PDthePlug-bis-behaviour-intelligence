import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

if(process.env.BIS_STAGING_ALLOW_MUTATIONS!=="true")throw new Error("Explicit staging mutation acknowledgement required.");
const session=await stagingSession("LEARNER",19);
const initial=await session.request("/api/profile");
await session.browserState("/tmp/bis-hardening-learning-storage.json");
const browser=await chromium.launch(),rows=[];
try {
 const context=await browser.newContext({storageState:"/tmp/bis-hardening-learning-storage.json",viewport:{width:360,height:900}});
 const page=await context.newPage();
 for(const edition of ["school","emerging_adult","workplace"]) {
  await session.request("/api/profile",{deliveryEdition:edition},"PATCH");
  await page.goto(session.base+"/settings");
  await page.getByRole("button",{name:"Reading",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Text size"})).toBeEnabled();
  await page.getByRole("combobox",{name:"Text size"}).selectOption("extra_large");
  await expect(page.locator(".settings-status")).toHaveText("Saved");
  for(const code of ["hab","dec","mon","idn","att"]) {
   await page.goto(session.base+`/handbooks/${code}?page=2`);
   const field=page.locator("textarea[data-response-check]").first();
   await expect(field).toBeVisible({timeout:30000});
   const fieldId=await field.getAttribute("data-field-id"),checkId=await field.getAttribute("data-response-check");
   const value=`SYNTHETIC-HARDENING-LEARNING: ${code} ${edition}. I compared the example with my experience and recorded a practical observation.`;
   const fields=page.locator(`[data-response-check="${checkId}"]`);
   for(const response of await fields.all())await response.fill(value);
   const group=page.locator(`[data-formative-signal-for="${checkId}"]`);
   await expect(group).toBeVisible();
   await group.getByText("I understand this",{exact:true}).click();
   await expect(page.locator(".prototype-save-state")).toContainText("Workbook responses saved",{timeout:30000});
   await page.reload();
   await expect(page.locator(`[data-field-id="${fieldId}"]`)).toHaveValue(value,{timeout:30000});
   await expect(page.locator(`[data-formative-signal-for="${checkId}"]`).getByRole("radio",{name:"I understand this",exact:true})).toBeChecked();
   const textSize=await field.evaluate(element=>parseFloat(getComputedStyle(element).fontSize));
   assert.ok(Math.abs(textSize-20.8)<0.2,`Reading size did not persist: ${textSize}`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1);
   const row={code:code.toUpperCase(),edition,fieldId,textSize,responseRefresh:"PASS",understandingRefresh:"PASS",overflow:0};rows.push(row);console.log(row);
   await page.screenshot({path:`/tmp/bis-hardening-evidence/learning-${code}-${edition}-360.png`,fullPage:true});
   await writeFile("/tmp/bis-hardening-learning-audit.json",JSON.stringify(rows,null,2));
  }
 }
} finally {
 await browser.close();
 await session.request("/api/profile",{deliveryEdition:initial.profile.deliveryEdition,textSize:initial.profile.textSizePreference||"standard"},"PATCH");
}
