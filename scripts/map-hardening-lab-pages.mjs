import { readFile, writeFile } from "node:fs/promises";

const path = "docs/hardening/lab-page-register.json";
let previous;
try { previous = JSON.parse(await readFile(path, "utf8")); } catch { previous = { pages: [] }; }
const retained = new Map(previous.pages.map(page => [page.id, page]));
const published = JSON.parse(await readFile("docs/hardening/production-takeover-metric-register.json", "utf8"));
const names = ["Baseline and consent", "Hook", "Pattern", "Revelation", "Mapping", "Equation", "Contract", "Experiment", "Evidence Review", "Profile"];
const pages = published.labs.flatMap(lab => names.map((name, stage) => {
  const id = `${lab.code}:${lab.version}:${stage}`;
  const prior = retained.get(id);
  return { ...prior, id, route: `/labs/${lab.code.toLowerCase()}${stage ? `?step=${stage}` : ""}`,
    role: "Learner; SYSTEM_ADMIN in isolated Content Studio preview", variant: stage ? "Investigation" : "Baseline/consent state before investigation entry",
    labCode: lab.code, version: lab.version, investigation: stage, title: name,
    definitionSnapshotSha256: lab.definitionSnapshotSha256,
    problem: prior?.problem ?? "Exact responsive/role/state manual review remains open; shared runtime and current published source contracts are separately verified.",
    correction: prior?.correction ?? "Shared reading canvas, control hierarchy, missing/calculation disclosures and centred opaque Menu. Preserve immutable package, semantic response IDs, calendar and private evidence boundaries.",
    versionFindingIds: published.findings.filter(finding => finding.code === lab.code && finding.version === lab.version).map(finding => finding.indicator ?? finding.fieldId),
    evidenceFindingsReport: "production-takeover-metric-register.json",
    verification: prior?.verification ?? ["production-takeover-metric-register.json", "tests/browser/lab-journey.spec.ts", "tests/browser/evidence-calendar.spec.ts"],
    manualVisualStatus: prior?.manualVisualStatus ?? "PENDING; definition inventory and fixture journeys do not establish exact live page review",
    releaseStatus: prior?.releaseStatus ?? "ACCEPTED EXISTING PUBLICATION; SHARED CHROME CORRECTION IN BRANCH; FULL CERTIFICATION OPEN",
    outstanding: prior?.outstanding ?? ["Exact page/role visual and contextual language review.", "Loading, error, withdrawn/revoked, evidence/missing and calendar variants remain in UAT-ALL-STATES.", ...(published.findings.some(finding => finding.code === lab.code) ? ["Unbound version-level indicators require governed binding/publication review; values remain unavailable."] : [])],
  };
}));
await writeFile(path, JSON.stringify({ generatedAt: new Date().toISOString(), basis: "Actual current published production definitions; no content or enrolment is changed", boundary: "32 published versions, 288 investigations and 32 baseline/consent states. Page inventory is not manual certification. Preserve prior reviews when regenerated.", pages }, null, 2) + "\n");
console.log({ publishedLabs: published.labs.length, investigationPages: pages.filter(page => page.investigation).length, baselineStates: pages.filter(page => !page.investigation).length });
