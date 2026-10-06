import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const manifest=JSON.parse(await readFile(".next/server/app/api/runtime-content/route.js.nft.json","utf8"));
for(const slug of ["habit","decision","money","identity","attention"])for(const edition of ["school","emerging_adult","workplace"])assert.ok(manifest.files.some(file=>file.endsWith(`/public/handbooks/v1/${slug}-${edition}.json.gz.b64`)),`${slug}/${edition} missing from the serverless artifact`);
console.log("Verified all 15 retained learning packages in the serverless runtime artifact.");
