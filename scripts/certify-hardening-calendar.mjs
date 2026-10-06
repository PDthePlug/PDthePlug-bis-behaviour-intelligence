import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";

if(process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://lbmhkddrkhtmkcvfmumd.supabase.co"||process.env.BIS_STAGING_ALLOW_MUTATIONS!=="true")throw new Error("Explicit BIS staging certification only.");
if(process.env.BIS_STAGING_BASE_URL&&process.env.BIS_STAGING_BASE_URL!=="http://127.0.0.1:3200")throw new Error("The controlled clock requires the local development server.");
async function certify(mode) {
 const job=spawn(process.execPath,["scripts/certify-hardening-lab.mjs",mode],{env:{...process.env,BIS_HARDENING_CONCURRENCY:"4"},stdio:"inherit"});
 const [code]=await once(job,"exit");if(code!==0)throw new Error(`Staging ${mode} certification failed.`);
}
for(let day=3;day<=7;day++) {
 const clock=`2026-10-${String(5+day).padStart(2,"0")}T08:00:00Z`;
 const server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3200"],{env:{...process.env,BIS_STAGING_CERTIFICATION_CLOCK_ISO:clock},stdio:["ignore","ignore","inherit"],detached:true});
 try {
  let ready=false;
  for(let attempt=0;attempt<60;attempt++) {
   try {const response=await fetch("http://127.0.0.1:3200/api/staging-certification/environment");const identity=await response.json();if(identity.projectRef==="lbmhkddrkhtmkcvfmumd"&&identity.stagingCertificationAllowed){ready=true;break;}}catch{}
   await setTimeout(500);
  }
  if(!ready)throw new Error("The staging development server did not start.");
  console.log({phase:"calendar",day,clock});await certify("calendar");
  if(day===7)await certify("finish");
 } finally {
  process.kill(-server.pid,"SIGTERM");await once(server,"exit");
 }
}
