import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
const manifest=JSON.parse(await readFile(new URL('../content/sources/manifest.json',import.meta.url),'utf8'));
for(const item of manifest){
 const bytes=await readFile(item.path);
 if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error(`Canonical Volume ${item.volume} fingerprint changed. Review the source manifest before release.`);
}
const result=spawnSync(process.execPath,['scripts/audit-lab-interactions.mjs',...manifest.map(item=>item.path)],{stdio:'inherit'});
process.exitCode=result.status??1;
