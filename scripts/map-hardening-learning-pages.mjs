import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const registerPath = "docs/hardening/learning-page-register.json";
let previous;
try { previous = JSON.parse(await readFile(registerPath, "utf8")); } catch { previous = { pages: [] }; }
const retained = new Map(previous.pages.map(page => [page.id, page]));
const pages = [];
for (const slug of ["habit", "decision", "money", "identity", "attention"]) {
  for (const edition of ["school", "emerging_adult", "workplace"]) {
    const source = `public/handbooks/v1/${slug}-${edition}.json.gz.b64`;
    const bytes = gunzipSync(Buffer.from(await readFile(source, "utf8"), "base64"));
    const handbook = JSON.parse(bytes);
    for (const [index, page] of handbook.treatment.pages.entries()) {
      const id = `${handbook.labCode}:${edition}:${page.id}`;
      const prior = retained.get(id);
      const findings = [];
      if (/SESSION:.*TIME:/s.test(page.html)) findings.push("Passive session labels interrupt the lesson opening.");
      if (/<h[1-4][^>]*>\s*(?:📖|💭|✍|📂|⚡|🏠|📌|🎯)/u.test(page.html)) findings.push("Decorative heading markers compete with reading hierarchy.");
      if (page.programmeDay) findings.push("Source day/title repeats the publication header.");
      pages.push({
        ...prior,
        id, route: `/handbooks/${handbook.labCode.toLowerCase()}?page=${index + 1}`,
        role: "Learner; assigned facilitator in read-only learner experience",
        module: handbook.labCode, edition, page: page.key, title: page.label,
        semanticStepId: page.id, source, sourceContentVersion: handbook.contentVersion,
        sourceHash: createHash("sha256").update(bytes).digest("hex"),
        problem: prior?.problem ?? findings,
        correction: prior?.correction ?? "Shared presentation retains authored text and response keys; session context is disclosed, repeated publication headings are hidden, decorative heading markers are hidden, and embedded paper labels are separated after checklist creation. No source package is edited.",
        verification: prior?.verification ?? ["tests/browser/reader-hardening.spec.ts", "tests/browser/programme-journey.spec.ts", "tests/fixtures/handbook-response-identities.json"],
        manualVisualStatus: prior?.manualVisualStatus ?? "PENDING; automated rendering is a separate check",
        releaseStatus: prior?.releaseStatus ?? "IN_BRANCH; FULL CERTIFICATION OPEN",
        outstanding: prior?.outstanding ?? ["Manual reading/language review for this exact page and edition.", "Assigned-facilitator variant and production live verification remain within UAT-ALL-STATES and LIVE-ROLES."],
      });
    }
  }
}
await writeFile(registerPath, JSON.stringify({ ...previous, generatedAt: new Date().toISOString(), coverageBoundary: "195 accepted source page/edition variants. Source inventory and fixture rendering do not imply every live publication, role or state has been manually reviewed.", pages }, null, 2) + "\n");
console.log(`Mapped ${pages.length} page/edition variants; retained page review and release evidence.`);
