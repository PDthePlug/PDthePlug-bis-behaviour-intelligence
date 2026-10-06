import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { stagingSession } from "./hardening-staging-session.mjs";

if(process.env.BIS_STAGING_ALLOW_MUTATIONS!=="true")throw new Error("Explicit staging mutation acknowledgement required.");

const owner=await stagingSession("LEARNER",0), stranger=await stagingSession("LEARNER",1);
await owner.browserState("/tmp/bis-hardening-photo-owner-storage.json");
const browser=await chromium.launch();
try {
 const context=await browser.newContext({storageState:"/tmp/bis-hardening-photo-owner-storage.json",viewport:{width:360,height:900}});
 const page=await context.newPage();let objectPath;
 // Actual authenticated upstream requests, transported through the environment proxy.
 await page.route("https://lbmhkddrkhtmkcvfmumd.supabase.co/**",async route=>{
  const request=route.request();const response=await fetch(request.url(),{method:request.method(),headers:request.headers(),body:request.postDataBuffer()??undefined});
  const headers=Object.fromEntries([...response.headers].filter(([name])=>!["content-encoding","content-length","transfer-encoding"].includes(name)));
  if(request.method()==="POST"&&new URL(request.url()).pathname.startsWith("/storage/v1/object/bis-private-evidence/"))objectPath=decodeURIComponent(new URL(request.url()).pathname.split("/bis-private-evidence/")[1]);
  await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto(owner.base+"/labs/hab?step=7");
 await expect(page.getByRole("button",{name:"Choose image",exact:true})).toBeEnabled();
 await page.getByLabel("Choose an evidence photo",{exact:true}).setInputFiles("/tmp/bis-hardening-synthetic-photo.png");
 await expect(page.getByText("Photo saved privately.",{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole("button",{name:/View photo/}).last()).toBeVisible();
 if(!objectPath)throw new Error("The scoped upload was not observed.");
 const wrongUser=await stranger.client.storage.from("bis-private-evidence").download(objectPath);
 if(wrongUser.data||!wrongUser.error)throw new Error("Cross-user photo read was allowed.");
 const wrongWrite=await stranger.client.storage.from("bis-private-evidence").upload(objectPath,new Blob(["denied"],{type:"image/jpeg"}),{upsert:false});
 if(!wrongWrite.error)throw new Error("Cross-user photo write was allowed.");
 await page.screenshot({path:"/tmp/bis-hardening-evidence/private-photo-360.png",fullPage:true});
 const count=await page.getByRole("button",{name:/View photo/}).count();
 await page.getByRole("button",{name:`Remove photo ${objectPath.match(/\/(\d)\.jpg$/)[1]}`,exact:true}).click();await expect(page.getByText("Photo removed.",{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole("button",{name:/View photo/})).toHaveCount(count-1);
 const result={upload:"PASS",refresh:"PASS",crossUserRead:"DENIED",crossUserWrite:"DENIED",remove:"PASS",removeRefresh:"PASS",project:"lbmhkddrkhtmkcvfmumd",objectPath};
 await writeFile("/tmp/bis-hardening-photo-audit.json",JSON.stringify(result,null,2));console.log(result);
} finally {await browser.close();}
