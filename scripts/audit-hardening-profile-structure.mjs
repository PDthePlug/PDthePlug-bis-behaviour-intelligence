import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

// Inventory a source-structure defect; this does not edit packages or invent bindings.
const findings = [];
const previous = JSON.parse(await readFile("docs/hardening/profile-structure-register.json", "utf8").catch(() => '{"findings":[]}'));
let pagesReviewed = 0;
for (const name of (await readdir("public/handbooks/v1")).filter(name => name.endsWith(".json.gz.b64")).sort()) {
  const source = `public/handbooks/v1/${name}`;
  const bytes = await readFile(source);
  const content = gunzipSync(Buffer.from(bytes.toString(), "base64"));
  const publication = JSON.parse(content);
  for (const page of publication.treatment.pages) {
    pagesReviewed++;
    const header = /<p>Element My Answer<\/p>/.exec(page.html);
    if (!header) continue;
    const remainder = page.html.slice(header.index + header[0].length);
    const section = remainder.split(/<hr\b|<h[1-6]\b/i, 1)[0];
    const finding = {
      route: `/handbooks/${publication.labCode.toLowerCase()}?page=${publication.treatment.pages.indexOf(page) + 1}`,
      role: "Learner; assigned facilitator reference",
      module: publication.labCode,
      edition: publication.edition,
      semanticStepId: page.id,
      source,
      sourcePackageByteHash: createHash("sha256").update(bytes).digest("hex"),
      sourceContentHash: createHash("sha256").update(content).digest("hex"),
      sourceAuthority: publication.sourceTrace.authority,
      profileRows: [...section.matchAll(/<p>(.*?)<\/p>/gs)].map(match => match[1].replace(/<[^>]*>/g, "")),
      sourceTableCount: [...section.matchAll(/<table\b/gi)].length,
      sourceResponseControlCount: [...section.matchAll(/<(?:input|textarea|select)\b/gi)].length,
      problem: "Profile header and row labels are unpaired paragraphs; no value/answer cells or semantic bindings exist in this section.",
      correction: "OPEN: restore the authored relationship through a reviewed shared presentation/binding contract without guessing metrics, overwriting source or rekeying existing responses.",
      releaseStatus: "UNRESOLVED; FULL_CERTIFICATION_OPEN",
    };
    // Keep reviewed renderer evidence only for the identical authored source bytes.
    const reviewed = previous.findings.find(item => item.source === source && item.semanticStepId === page.id && item.sourcePackageByteHash === finding.sourcePackageByteHash);
    if (reviewed) for (const key of ["correction", "releaseStatus", "verification", "presentationEvidence", "outstanding"]) {
      if (reviewed[key] !== undefined) finding[key] = reviewed[key];
    }
    findings.push(finding);
  }
}
const report = { sourcePagesInspected: pagesReviewed, scope: "All 15 accepted source packages; source-pattern inspection is not whole-page editorial or live certification.", findings, productionDataChanged: false, sourcePackagesChanged: false };
await writeFile("docs/hardening/profile-structure-register.json", JSON.stringify(report, null, 2) + "\n");
console.log(`${pagesReviewed} source pages inspected; ${findings.length} unpaired profile sections inventoried for correction.`);
