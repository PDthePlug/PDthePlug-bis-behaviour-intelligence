import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

const session = await stagingSession();
await session.browserState("/tmp/bis-hardening-admin-storage.json");
const prepared = JSON.parse(await readFile("/tmp/bis-hardening-prepared.json", "utf8"));
const browser = await chromium.launch();
const context = await browser.newContext({storageState:"/tmp/bis-hardening-admin-storage.json"});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => { if(response.status()>=400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
await mkdir("/tmp/bis-hardening-evidence", {recursive:true});
const rows = [];
try {
  for (const lab of prepared) for (const width of [360,430,1280]) for(let step=1;step<=9;step++) {
    await page.setViewportSize({width,height:900});
    const route=`/content-studio/preview/${encodeURIComponent(lab.versionId)}/runtime?kind=LAB&code=${lab.code}&step=${step}`;
    await page.goto(session.base+route);
    await page.getByRole("heading",{name:"Before you begin"}).waitFor();
    await page.getByRole("checkbox").check();
    await page.getByRole("button",{name:/^Open .* Lab/}).click();
    await page.locator(".universal-package-lab").waitFor();
    await page.waitForLoadState("networkidle");
    const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,unlabelled:[...document.querySelectorAll("textarea,input:not([type=hidden]),select")].filter(element=>!element.labels?.length&&!element.getAttribute("aria-label")&&!element.getAttribute("aria-labelledby")).map(element=>element.outerHTML.slice(0,100))}));
    const row={code:lab.code,versionId:lab.versionId,step,width,...geometry,headings:await page.getByRole("heading").allTextContents(),errors:[...errors]};
    rows.push(row);
    await page.screenshot({path:`/tmp/bis-hardening-evidence/${lab.code}-I${step}-${width}.png`,fullPage:true});
    await writeFile("/tmp/bis-hardening-preview-audit.json",JSON.stringify(rows,null,2));
    console.log({code:lab.code,step,width,overflow:geometry.overflow,unlabelled:geometry.unlabelled.length,errors:errors.length});
  }
} finally {await browser.close();}
