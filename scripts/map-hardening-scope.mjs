import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
let existing;
try { existing = JSON.parse(await readFile(path.join(root,"docs/hardening/route-register.json"),"utf8")); } catch { existing = {routes:[]}; }
const reviews = new Map(existing.routes.map(route=>[route.route,route]));
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const roles = route => route.startsWith("/api/") ? "Authenticated API; role checked in handler/RLS"
  : route.startsWith("/content-studio") ? "SYSTEM_ADMIN"
    : route === "/workspace" ? "FACILITATOR, SPONSOR_VIEWER, PROGRAMME_OWNER, SYSTEM_ADMIN, SAFEGUARDING_OFFICER"
      : route === "/commercial" ? "SYSTEM_ADMIN, commercial roles"
        : /^\/(sign-in|forgot-password|reset-password|auth\/|experience\/leap9|qa-handbooks|programmes\/)/.test(route) ? "Public or conditional; see source gate"
          : "Authenticated learner";
const routes = [];
for (const file of (await files(path.join(root, "app"))).filter(file => /\/(page\.tsx|route\.ts)$/.test(file)).sort()) {
  const source = await readFile(file, "utf8");
  const route = "/" + path.relative(path.join(root, "app"), path.dirname(file)).replaceAll(path.sep, "/");
  const prior=reviews.get(route);
  routes.push({ route: route === "/." ? "/" : route, kind: file.endsWith("page.tsx") ? "page" : "handler", role: prior?.role??roles(route), source: path.relative(root,file),
    methods: [...source.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)|export const (GET|POST|PUT|PATCH|DELETE)/g)].map(match => match[1] ?? match[2]),
    imports: [...source.matchAll(/from ["']([^"']+)["']/g)].map(match => match[1]),
    problem: prior?.problem??"Full route and state review pending", correction: prior?.correction??"Preserve accepted content and data; record specific changes here", verification: prior?.verification??[], releaseStatus: prior?.releaseStatus??"OPEN", outstanding:prior?.outstanding??[] });
}
await mkdir(path.join(root,"docs/hardening"),{recursive:true});
await writeFile(path.join(root,"docs/hardening/route-register.json"), JSON.stringify({ baseCommit:"d8ca307ae455024b5816240d4db08f0dddd6bf73", generatedAt:new Date().toISOString(), routes },null,2)+"\n");
console.log(`Mapped ${routes.length} route patterns; retained existing review evidence and open findings.`);
