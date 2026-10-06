import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { stagingSession } from "./hardening-staging-session.mjs";

if(process.env.BIS_STAGING_ALLOW_MUTATIONS!=="true")throw new Error("Explicit staging mutation acknowledgement required.");
const preview=JSON.parse(await readFile("/tmp/bis-hardening-learning-preview-audit.json","utf8"));
assert.equal(preview.length,117);
assert.ok(preview.every(row=>row.overflow<=1&&!row.unlabelled&&!row.violations.length&&!row.errors.length),"Complete the clean preview sweep before publication.");
const prepared=JSON.parse(await readFile("/tmp/bis-hardening-learning-prepared.json","utf8"));
assert.ok(prepared.sources.every(source=>source.authoredPageParity?.startsWith("PASS")));
const admin=await stagingSession(),learner=await stagingSession("LEARNER",19);
const before=await admin.request("/api/content-studio"),item=before.items.find(row=>row.id===prepared.itemId);
assert.equal(item.activeActivation?.runtimeMode,"STATIC");assert.equal(item.activeEditions.length,0);
const ids=item.versions.map(version=>version.id).sort();
const evidenceBefore=await learner.request("/api/learning?lab=HAB");
const checklist=Object.fromEntries(["authored_content","navigation","inputs_privacy","responsive","handoff_completion","learner_language"].map(key=>[key,true]));
await admin.request("/api/content-studio",{action:"saveUat",versionId:prepared.versionId,checklist,notes:"BIS-HARDENING-20261006: accepted source wording/page identity/order/10 touchpoints verified in all three editions. 117 real preview states at 360/430/1280 passed overflow, input names, browser errors and WCAG checks after shared-shell/caption corrections. Mobile/desktop representative pages inspected. Live response/check/reading-size refresh journeys and automated navigation/handover contracts passed. No editorial waiver or content rewrite."});
await admin.request("/api/content-studio",{action:"signOffUat",versionId:prepared.versionId});
await admin.request("/api/content-studio",{action:"approveVersion",versionId:prepared.versionId});
const rows=[];
const select=data=>data.items.find(row=>row.id===prepared.itemId);
function verifyActive(data){assert.equal(select(data).activeEditions.length,3);assert.ok(select(data).activeEditions.every(row=>row.versionId===prepared.versionId));}
let published=false;
try {
 const live=await admin.request("/api/content-studio",{action:"activateVersion",versionId:prepared.versionId});published=true;verifyActive(live);
 for(const source of prepared.sources){const runtime=await learner.request(`/api/runtime-content?kind=LEARNING_MODULE&code=HAB&edition=${source.edition}`);assert.equal(runtime.version.id,prepared.versionId);assert.equal(runtime.payload.treatment.pages.length,13);}
 rows.push({transition:"PUBLISH",editions:3,authoredPagesPerEdition:13,previewFingerprint:"PASS",priorVersionsRetained:"PASS"});
 assert.equal(select(live).rollbackAvailable,false);
 await assert.rejects(admin.request("/api/content-studio",{action:"rollbackActivation",itemId:prepared.itemId}));
 rows.push({transition:"ROLLBACK_WITHOUT_EDITION_PREDECESSOR",result:"DENIED",boundary:"The retained global static activation is not an edition supersession edge."});
 const offline=await admin.request("/api/content-studio",{action:"unpublishItem",itemId:prepared.itemId});
 assert.equal(select(offline).activeEditions.length,0);assert.equal(select(offline).activeActivation,null);
 for(const source of prepared.sources)await assert.rejects(learner.request(`/api/runtime-content?kind=LEARNING_MODULE&code=HAB&edition=${source.edition}`));
 const catalogue=await learner.request("/api/runtime-catalogue");assert.equal(catalogue.items.find(row=>row.kind==="LEARNING_MODULE"&&row.code==="HAB").live,false);
 rows.push({transition:"UNPUBLISH",editionsOffline:3,retainedGlobalFallback:"OFFLINE",runtimeAndCatalogue:"PASS"});
 const restored=await admin.request("/api/content-studio",{action:"republishVersion",versionId:prepared.versionId});verifyActive(restored);assert.equal(select(restored).activeActivation,null);
 rows.push({transition:"REPUBLISH",editions:3,retainedGlobalFallback:"REMAINS_OFFLINE",sameReviewedVersion:"PASS"});
} finally {
 if(published){const current=await admin.request("/api/content-studio");if(select(current).activeEditions.length!==3)await admin.request("/api/content-studio",{action:"republishVersion",versionId:prepared.versionId});}
}
const final=await admin.request("/api/content-studio");verifyActive(final);assert.deepEqual(select(final).versions.map(version=>version.id).sort(),ids);
const evidenceAfter=await learner.request("/api/learning?lab=HAB");assert.deepEqual(evidenceAfter.workbookResponses,evidenceBefore.workbookResponses);assert.deepEqual(evidenceAfter.progress,evidenceBefore.progress);
await writeFile("/tmp/bis-hardening-learning-publication-audit.json",JSON.stringify({project:"lbmhkddrkhtmkcvfmumd",itemId:prepared.itemId,versionId:prepared.versionId,sourceVersionsRetained:ids.length,workbookResponsesAndProgressRetained:"PASS",transitions:rows,finalAvailability:"LIVE: all three editions",historicalEditionRollback:"No edition predecessor exists; negative actual case verified; multi-version rollback covered by database acceptance."},null,2));
console.log(rows);
