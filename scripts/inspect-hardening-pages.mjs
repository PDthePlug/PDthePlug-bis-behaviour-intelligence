import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { previewProtection, stagingSession } from "./hardening-staging-session.mjs";

const axes = await readFile(process.env.BIS_HARDENING_AXE_FILE || "/tmp/bis-hardening-axe.min.js", "utf8");
const browser = await chromium.launch();
const group = JSON.parse(await readFile("/tmp/bis-hardening-group.json", "utf8"));
const defaultRoleRoutes = {
  LEARNER: ["/", "/habit", "/learn", "/labs", "/labs/hab?step=7", "/labs/mon", "/labs/rsk", "/labs/zzz", "/handbooks/dec", "/handbooks/mon", "/handbooks/rsk", "/handbooks/idn", "/handbooks/att", "/learning", "/learning/hab", "/learning/habit", "/habit-lab", "/habit-lab/experiment", "/decision", "/money", "/settings", "/profile", "/portfolio", "/experience", "/commercial", "/workspace"],
  FACILITATOR: ["/workspace?view=facilitator&section=class", "/workspace?view=facilitator&section=participants", "/workspace?view=facilitator&section=review", "/workspace?view=facilitator&section=learning", "/workspace?view=facilitator&section=experiment", "/workspace?view=facilitator&section=notes", "/workspace?view=admin", "/content-studio"],
  SPONSOR_VIEWER: ["overview", "journey", "evidence", "reports", "decisions"].map(section=>`/workspace?view=outcomes&section=${section}&group=${group.id}`),
  SYSTEM_ADMIN: ["overview", "access", "groups", "assessment"].map(section=>`/workspace?view=admin&section=${section}`).concat(["/content-studio", "/commercial"]),
  SAFEGUARDING_OFFICER: ["/workspace?view=facilitator", "/workspace?view=outcomes"],
  PUBLIC: ["/sign-in", "/forgot-password", "/reset-password", "/experience/leap9", "/experience/leap9/v2", "/qa-handbooks"],
};
const roleRoutes=process.env.BIS_HARDENING_PAGE_MATRIX_FILE?JSON.parse(await readFile(process.env.BIS_HARDENING_PAGE_MATRIX_FILE,"utf8")):defaultRoleRoutes;
const output=process.env.BIS_HARDENING_PAGE_AUDIT_FILE||"/tmp/bis-hardening-page-audit.json";
const rows=[];
await mkdir("/tmp/bis-hardening-evidence/pages",{recursive:true});
try {
 for(const [role,routes] of Object.entries(roleRoutes)) {
  let storageState;
  if(role!=="PUBLIC") {const session=await stagingSession(role);const file=`/tmp/bis-hardening-${role}-storage.json`;await session.browserState(file);storageState=file;}
  const context=await browser.newContext({storageState});
  if(role==="PUBLIC")await context.addCookies(await previewProtection(process.env.BIS_STAGING_BASE_URL||"http://127.0.0.1:3200"));
  const page=await context.newPage();let errors=[];
  page.on("pageerror",error=>errors.push({kind:"pageerror",message:error.message}));
  page.on("response",response=>{if(response.status()>=400)errors.push({kind:"http",status:response.status(),path:new URL(response.url()).pathname});});
  for(const width of [360,430,1280]) for(const route of routes) {
   errors=[];
   await page.setViewportSize({width,height:900});
   const response=await page.goto((process.env.BIS_STAGING_BASE_URL||"http://127.0.0.1:3200")+route);
   await page.waitForLoadState("networkidle");
   await page.addScriptTag({content:axes});
   const accessibility=await page.evaluate(async()=>{const result=await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}});return result.violations.map(item=>({id:item.id,impact:item.impact,description:item.description,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));});
   const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,unlabelled:[...document.querySelectorAll("textarea,input:not([type=hidden]),select")].filter(element=>!element.labels?.length&&!element.getAttribute("aria-label")&&!element.getAttribute("aria-labelledby")).map(element=>element.outerHTML.slice(0,150))}));
   const screenshot=`pages/${role}-${rows.length}-${width}.png`;
   await page.screenshot({path:`/tmp/bis-hardening-evidence/${screenshot}`,fullPage:true});
   const row={role,route,width,status:response?.status(),finalPath:new URL(page.url()).pathname+new URL(page.url()).search,headings:await page.getByRole("heading").allTextContents(),...geometry,accessibility,errors:[...errors],screenshot};
   rows.push(row);await writeFile(output,JSON.stringify(rows,null,2));
   console.log({role,route,width,status:row.status,overflow:row.overflow,unlabelled:row.unlabelled.length,accessibility:accessibility.map(v=>v.id),errors:errors.length});
  }
  await context.close();
 }
} finally {await browser.close();}
