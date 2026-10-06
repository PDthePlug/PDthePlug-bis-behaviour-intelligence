import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { loadStaticLearningPackage } from "../lib/static-learning-package.mjs";

test("retained learning packages open every accepted edition without an HTTP self-fetch", async () => {
 const prior=globalThis.fetch;
 globalThis.fetch=()=>{throw new Error("Protected self-fetch is unavailable.");};
 try {
  for(const slug of ["habit","decision","money","identity","attention"])for(const edition of ["school","emerging_adult","workplace"]) {
   const payload=await loadStaticLearningPackage(slug,edition);
   assert.equal(payload.edition,edition);assert.equal(payload.treatment.pages.filter(page=>page.programmeDay).length,10);
   assert.ok(payload.treatment.pages.every(page=>typeof page.html==="string"&&page.html.length));
  }
 } finally {globalThis.fetch=prior;}
});

test("unknown, missing and corrupt packages fail without returning fallback content",async()=>{
 await assert.rejects(loadStaticLearningPackage("../habit","school"),/Unknown/);
 await assert.rejects(loadStaticLearningPackage("habit","../school"),/Unknown/);
 const root=await mkdtemp(join(tmpdir(),"bis-static-package-"));
 try {
  await assert.rejects(loadStaticLearningPackage("habit","school",root),{code:"ENOENT"});
  const folder=join(root,"public","handbooks","v1");await mkdir(folder,{recursive:true});
  const file=join(folder,"habit-school.json.gz.b64");
  await writeFile(file,"<html>Protected deployment sign in</html>");await assert.rejects(loadStaticLearningPackage("habit","school",root));
  await writeFile(file,gzipSync("invalid JSON").toString("base64"));await assert.rejects(loadStaticLearningPackage("habit","school",root),SyntaxError);
 } finally {await rm(root,{recursive:true,force:true});}
});
