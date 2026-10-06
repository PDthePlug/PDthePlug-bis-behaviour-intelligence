import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";
if(process.env.BIS_STAGING_ALLOW_MUTATIONS!=="true")throw new Error("Explicit staging mutation acknowledgement required.");
const admin=await stagingSession(),actor=await stagingSession("SAFEGUARDING_OFFICER"),sponsor=await stagingSession("SPONSOR_VIEWER");
const group=JSON.parse(await readFile("/tmp/bis-hardening-group.json","utf8"));
const original=await admin.request("/api/staff");
assert.ok(!original.admin.roleAssignments.some(row=>row.principalEmail===actor.account.email&&row.status==="ACTIVE"&&row.role!=="SAFEGUARDING_OFFICER"));
const rows=[],assigned=[];const browser=await chromium.launch();
await actor.browserState("/tmp/bis-hardening-role-variants-storage.json");
const context=await browser.newContext({storageState:"/tmp/bis-hardening-role-variants-storage.json"}),page=await context.newPage();
try {
 await assert.rejects(actor.request("/api/commercial"));
 const owner=await admin.request("/api/staff",{action:"assignRole",email:actor.account.email,role:"PROGRAMME_OWNER",cohortId:group.id});
 assigned.push(owner.admin.roleAssignments.find(row=>row.principalEmail===actor.account.email&&row.role==="PROGRAMME_OWNER"&&row.status==="ACTIVE").id);
 const ownerSnapshot=await actor.request("/api/staff");assert.equal(ownerSnapshot.sponsor.cohorts.length,1);assert.equal(ownerSnapshot.sponsor.cohorts[0].cohort.id,group.id);assert.equal(ownerSnapshot.sponsor.cohorts[0].decisionRegister.canManage,true);assert.ok(!JSON.stringify(ownerSnapshot.sponsor).includes("PRIVATE-HARDENING-REFLECTION"));
 const title=`SYNTHETIC-HARDENING-OWNER ${Date.now()}: keep observation review available`;
 const body={action:"createProgrammeDecision",cohortId:group.id,sourceSignal:"OTHER",sourceTitle:title,sourceEvidence:"Synthetic software verification only; twenty fixture records are available.",decisionText:"Keep the existing programme while reviewing the available observations.",expectedOutcome:"Record whether sufficient evidence becomes available for a later team review."};
 await assert.rejects(sponsor.request("/api/staff",body));
 await assert.rejects(actor.request("/api/staff",{...body,cohortId:"00000000-0000-4000-8000-000000000000"}));
 await page.setViewportSize({width:360,height:900});await page.goto(actor.base+`/workspace?view=outcomes&section=decisions&group=${group.id}`);
 await page.getByLabel("Result or pattern",{exact:true}).fill(title);
 await page.getByLabel("What we saw",{exact:true}).fill(body.sourceEvidence);
 await page.getByLabel("What did your team decide?",{exact:true}).fill(body.decisionText);
 await page.getByLabel("What do we expect to observe next?",{exact:true}).fill(body.expectedOutcome);
 await page.getByRole("button",{name:"Record decision",exact:true}).click();
 await expect(page.locator(".decision-list")).toContainText(title,{timeout:30000});
 await page.reload();await expect(page.locator(".decision-list")).toContainText(title);
 const decisionCard=page.locator(".decision-card").filter({hasText:title});
 await decisionCard.getByLabel("What did the organisation learn?",{exact:true}).fill("SYNTHETIC-HARDENING-REVIEW: not enough evidence; keep the team's decision separate from descriptive results.");
 await decisionCard.getByRole("button",{name:"Record review",exact:true}).click();
 await expect(decisionCard.locator(".decision-review-result")).toContainText(/not enough evidence/i,{timeout:30000});await page.reload();await expect(decisionCard.locator(".decision-review-result")).toContainText("SYNTHETIC-HARDENING-REVIEW");
 for(const width of [360,430,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1);await page.screenshot({path:`/tmp/bis-hardening-evidence/programme-owner-${width}.png`,fullPage:true});}
 rows.push({role:"PROGRAMME_OWNER",assignedCohortOnly:"PASS",sponsorAndForeignCohortWriteDenied:"PASS",privateNarrativeExcluded:"PASS",decisionAndReviewUIRefresh:"PASS",reviewOutcome:"NOT_ENOUGH_EVIDENCE",widths:[360,430,1280]});
 await admin.request("/api/staff",{action:"revokeRole",assignmentId:assigned.pop()});
 await assert.rejects(actor.request("/api/staff",body));
 for(const role of ["COMMERCIAL_READ_ONLY","COMMERCIAL_RESEARCH","COMMERCIAL_LEAD","COMMERCIAL_ADMIN"]){
  const grant=await admin.request("/api/commercial",{action:"assignCommercialRole",email:actor.account.email,role});assigned.push(grant.roleAssignment.id);
  const permissions=await actor.request("/api/commercial");assert.equal(permissions.canWrite,role!=="COMMERCIAL_READ_ONLY");assert.equal(permissions.canAdmin,role==="COMMERCIAL_ADMIN");assert.equal(permissions.canAssignRoles,false);
  await assert.rejects(actor.request("/api/commercial",{action:"assignCommercialRole",email:actor.account.email,role:"COMMERCIAL_ADMIN"}));
  for(const width of [360,430,1280]){await page.setViewportSize({width,height:900});await page.goto(actor.base+"/commercial?section=accounts");const add=page.getByRole("button",{name:"+ Organisation",exact:true});if(role==="COMMERCIAL_READ_ONLY")await expect(add).toBeDisabled();else await expect(add).toBeEnabled();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1);}
  const name=`BIS hardening synthetic organisation 20261006 ${role}`;
  if(role==="COMMERCIAL_READ_ONLY")await assert.rejects(actor.request("/api/commercial",{action:"createOrganisation",name,organisationType:"Software verification fixture"}));
  else {await page.getByRole("button",{name:"+ Organisation",exact:true}).click();await page.getByLabel("Organisation name",{exact:true}).fill(name);await page.getByLabel("Organisation type",{exact:true}).fill("Software verification fixture");await page.getByRole("button",{name:"Add organisation",exact:true}).click();await expect(page.getByText(name,{exact:true})).toBeVisible({timeout:30000});await page.reload();await expect(page.getByText(name,{exact:true})).toBeVisible();}
  rows.push({role,read:"PASS",write:role==="COMMERCIAL_READ_ONLY"?"DENIED":"UI_SAVE_AND_REFRESH_PASS",roleAssignment:"DENIED",widths:[360,430,1280]});
  await admin.request("/api/staff",{action:"revokeRole",assignmentId:assigned.pop()});await assert.rejects(actor.request("/api/commercial"));
 }
} finally {for(const assignmentId of assigned)await admin.request("/api/staff",{action:"revokeRole",assignmentId});await browser.close();}
const after=await admin.request("/api/staff");assert.ok(!after.admin.roleAssignments.some(row=>row.principalEmail===actor.account.email&&row.status==="ACTIVE"&&row.role!=="SAFEGUARDING_OFFICER"));
await writeFile("/tmp/bis-hardening-role-variants-audit.json",JSON.stringify({project:"lbmhkddrkhtmkcvfmumd",rows,temporaryRolesRevoked:"PASS",boundary:"Actor retains only its original safeguarding role. Synthetic team decisions and organisations remain labelled software fixtures with audit history; no existing records or production data modified."},null,2));console.log(rows);
