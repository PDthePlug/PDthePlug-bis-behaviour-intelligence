import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { stagingSession } from "./hardening-staging-session.mjs";
import { loadContentTools } from "./lib/load-content-tools.mjs";

const session = await stagingSession();
await session.browserState("/tmp/bis-hardening-admin-storage.json");
const tools = await loadContentTools();
const prepared = [];
try {
  const bytes = await readFile("content/sources/volume-1.docx");
  const manifest = JSON.parse(await readFile("content/sources/manifest.json", "utf8"));
  if (createHash("sha256").update(bytes).digest("hex") !== manifest.find(row => row.volume === 1).sha256) throw new Error("Source checksum mismatch.");
  let studio = await session.request("/api/content-studio");
  for (const code of ["HAB","DEC","MON","RSK","IDN"]) {
    const item = studio.items.find(item => item.kind === "LAB" && item.code === code);
    if (!item) throw new Error(`Existing ${code} shelf required.`);
    // Use the governed API's next safe version, never replace an existing source.
    studio = await session.request("/api/content-studio", {action:"createVersion",itemId:item.id,sourceFormat:"BIS_PACKAGE_JSON",releaseNotes:"BIS-HARDENING-20261006: isolated staging certification from canonical Volume 1; preserve previous activations."});
    const created = studio.items.find(row=>row.id===item.id).versions.find(row=>!item.versions.some(old=>old.id===row.id));
    const packages = await tools.adaptBisVolumeSource(bytes,1,created.version);
    const source = packages.find(row=>row.code===code);
    if (!source) throw new Error(`Canonical source missing ${code}.`);
    const hash = createHash("sha256").update(source.packageBytes).digest("hex");
    const storagePath = `sources/${created.id}/lab/${hash}.json`;
    const upload = await session.client.storage.from("bis-content-studio").upload(storagePath,source.packageBytes,{contentType:"application/json",upsert:false});
    if(upload.error) throw new Error(`${code} source upload failed.`);
    studio = await session.request("/api/content-studio",{action:"attachSource",versionId:created.id,sourceKey:"lab",sourceFormat:"BIS_PACKAGE_JSON",sourceFileName:`${code}-canonical-volume-1.json`,sourceStoragePath:storagePath,sourceBytes:source.packageBytes.length,mimeType:"application/json"});
    studio = await session.request("/api/content-studio",{action:"compileVersion",versionId:created.id});
    const version = studio.items.find(row=>row.id===item.id).versions.find(row=>row.id===created.id);
    if(!version.compilerCurrent||version.runtimeStatus!=="READY") throw new Error(`${code} did not prepare successfully.`);
    const record = {code,itemId:item.id,versionId:version.id,version:version.version,sourceHash:hash,compiler:version.compilerVersion,editorial:version.compilerReport.editorialStatus,warnings:version.compilerReport.editorialWarnings,previousActivation:item.activeActivation??null};
    prepared.push(record);console.log(record);
    await writeFile("/tmp/bis-hardening-prepared.json",JSON.stringify(prepared,null,2));
  }
} finally { await tools.dispose(); }
