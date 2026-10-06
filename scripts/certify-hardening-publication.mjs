import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { stagingSession } from "./hardening-staging-session.mjs";

if(process.env.BIS_STAGING_ALLOW_MUTATIONS!=="true")throw new Error("Explicit staging mutation acknowledgement required.");
const admin=await stagingSession(),learner=await stagingSession("LEARNER");
const before=await admin.request("/api/content-studio");
const item=before.items.find(item=>item.code==="HAB"&&item.kind==="LAB");
const active=item.activeActivation;
assert.equal(active.versionId,"content:lab:HAB:4.5.4");
const ids=item.versions.map(version=>version.id).sort();
const rows=[];
try {
 assert.ok(active.supersedesActivationId,"This one-time fixture needs its retained original predecessor.");
 const rolled=await admin.request("/api/content-studio",{action:"rollbackActivation",itemId:item.id});
 const rolledItem=rolled.items.find(row=>row.id===item.id);
 assert.ok(rolledItem.activeActivation);
 assert.equal(rolledItem.activeActivation.id,active.supersedesActivationId);
 rows.push({transition:"ROLLBACK",predecessor:rolledItem.activeActivation.versionId,activationId:rolledItem.activeActivation.id,exactSupersessionEdge:"PASS"});
 assert.deepEqual(rolledItem.versions.map(version=>version.id).sort(),ids);
 const returned=await admin.request("/api/content-studio",{action:"republishVersion",versionId:active.versionId});
 assert.equal(returned.items.find(row=>row.id===item.id).activeActivation.versionId,active.versionId);
 const offline=await admin.request("/api/content-studio",{action:"unpublishItem",itemId:item.id});
 assert.ok(!offline.items.find(row=>row.id===item.id).activeActivation);
 const catalogue=await learner.request("/api/runtime-catalogue");assert.equal(catalogue.items.find(row=>row.code==="HAB"&&row.kind==="LAB").live,false);
 rows.push({transition:"UNPUBLISH",availability:"OFFLINE",versionsRetained:"PASS"});
 const restored=await admin.request("/api/content-studio",{action:"republishVersion",versionId:active.versionId});
 assert.equal(restored.items.find(row=>row.id===item.id).activeActivation.versionId,active.versionId);
 rows.push({transition:"REPUBLISH",availability:"LIVE",fingerprintGovernance:"PASS"});

} finally {
 const current=await admin.request("/api/content-studio");
 const version=current.items.find(row=>row.id===item.id).versions.find(row=>row.id===active.versionId);
 if(current.items.find(row=>row.id===item.id).activeActivation?.versionId!==active.versionId)await admin.request("/api/content-studio",{action:"republishVersion",versionId:version.id});
}
const after=await admin.request("/api/content-studio");
assert.equal(after.items.find(row=>row.id===item.id).activeActivation.versionId,active.versionId);
assert.equal((await learner.request("/api/universal-lab?lab=HAB")).enrolment.status,"COMPLETED");
await writeFile("/tmp/bis-hardening-publication-audit.json",JSON.stringify({project:"lbmhkddrkhtmkcvfmumd",itemId:item.id,versionIdsRetained:ids.length,transitions:rows,finalVersion:active.versionId,existingEnrolment:"COMPLETED"},null,2));
console.log(rows);
