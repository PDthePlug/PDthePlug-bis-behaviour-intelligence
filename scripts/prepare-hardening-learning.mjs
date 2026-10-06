import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { stagingSession } from "./hardening-staging-session.mjs";

const admin=await stagingSession();
let studio=await admin.request("/api/content-studio");
const item=studio.items.find(item=>item.kind==="LEARNING_MODULE"&&item.code==="HAB");
const originals={};
for(const edition of ["school","emerging_adult","workplace"])originals[edition]=await admin.request(`/api/runtime-content?kind=LEARNING_MODULE&code=HAB&edition=${edition}`);
studio=await admin.request("/api/content-studio",{action:"createVersion",itemId:item.id,sourceFormat:"BIS_PACKAGE_JSON",releaseNotes:"BIS-HARDENING-20261006: staging publication lifecycle proof from accepted built-in editions; authored pages and all previous records retained."});
const created=studio.items.find(row=>row.id===item.id).versions.find(row=>!item.versions.some(old=>old.id===row.id));
assert.ok(created);
const record={itemId:item.id,versionId:created.id,version:created.version,previous:item.activeEditions,sources:[]};
await writeFile("/tmp/bis-hardening-learning-prepared.json",JSON.stringify(record,null,2));
for(const [edition,original]of Object.entries(originals)) {
 const payload={...original.payload,contentVersion:created.version};
 if(payload.identity)payload.identity={...payload.identity,version:created.version};
 const bytes=Buffer.from(JSON.stringify(payload)),hash=createHash("sha256").update(bytes).digest("hex");
 const storagePath=`sources/${created.id}/${edition}/${hash}.json`;
 const upload=await admin.client.storage.from("bis-content-studio").upload(storagePath,bytes,{contentType:"application/json",upsert:false});
 if(upload.error)throw new Error("Immutable learning source upload failed.");
 studio=await admin.request("/api/content-studio",{action:"attachSource",versionId:created.id,sourceKey:edition,deliveryEdition:edition,sourceFormat:"BIS_PACKAGE_JSON",sourceFileName:`HAB-accepted-${edition}.json`,sourceStoragePath:storagePath,sourceBytes:bytes.length,mimeType:"application/json"});
 record.sources.push({edition,hash,originalVersion:original.version.id});
 await writeFile("/tmp/bis-hardening-learning-prepared.json",JSON.stringify(record,null,2));
}
studio=await admin.request("/api/content-studio",{action:"compileVersion",versionId:created.id});
const prepared=studio.items.find(row=>row.id===item.id).versions.find(row=>row.id===created.id);
assert.equal(prepared.runtimeStatus,"READY");assert.equal(prepared.compilerCurrent,true);
for(const [edition,original]of Object.entries(originals)) {
 const preview=await admin.request(`/api/content-studio/preview?versionId=${encodeURIComponent(created.id)}&artifact=learning:${edition}`);
 // Verify authored wording, semantic page identity, day order and relationships.
 const normalizedHtml=html=>html.replace(/<(br|hr)\s*\/?>/g,"<$1>").replaceAll(' maxlength="20000"',"");
 const pages=value=>value.treatment.pages.map(page=>({id:page.id,key:page.key,label:page.label,programmeDay:page.programmeDay,html:normalizedHtml(page.html)}));
 assert.deepEqual(pages(preview.payload),pages(original.payload),`${edition} authored page parity failed`);
 record.sources.find(row=>row.edition===edition).authoredPageParity="PASS: only void-element serialization and existing 20000-character limit may differ";
}
await writeFile("/tmp/bis-hardening-learning-prepared.json",JSON.stringify(record,null,2));console.log(record);
