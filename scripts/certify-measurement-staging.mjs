import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,relative} from 'node:path';
import {chromium} from '@playwright/test';
import {stagingSession} from './hardening-staging-session.mjs';

const ref='lbmhkddrkhtmkcvfmumd';
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,`${ref}.supabase.co`);
assert.equal(process.env.BIS_STAGING_ALLOW_MUTATIONS,'true','Explicit staging acknowledgement is required for report-export audit records.');
const output=resolve(process.env.BIS_MEASUREMENT_AUDIT_FILE);
assert.ok(relative(process.cwd(),output).startsWith('..'),'Keep QA results outside the repository; publish only the reviewed certification summary.');
const port=Number(process.env.BIS_STAGING_APP_PORT||3200);
const base=process.env.BIS_STAGING_BASE_URL||`http://127.0.0.1:${port}`;
let server,browser,serverErrors='';
const result={projectRef:ref,sourceCommit:'f35cfdd9bdb9638396af0214dd473ae81fda049d',checks:[],viewports:[],sourceAudit:null};
const record=name=>{result.checks.push({name,status:'PASS'});console.log(`PASS: ${name}`);};
try {
 if(!process.env.BIS_STAGING_BASE_URL){
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:process.env});
  // Never forward request logs or credentials into certification output.
  server.stdout.resume();server.stderr.on('data',chunk=>{serverErrors=(serverErrors+chunk.toString()).slice(-8000);});
  let ready=false;
  for(let attempt=0;attempt<120;attempt++){
   if(server.exitCode!==null)throw Error('Local staging application exited before its identity check.');
   try {const r=await fetch(`${base}/api/staging-certification/environment`);const identity=await r.json();if(r.ok&&identity.projectRef===ref&&identity.stagingCertificationAllowed){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'The exact staging application must be ready before authentication.');
 }
 const identity=await(await fetch(`${base}/api/staging-certification/environment`)).json();
 assert.equal(identity.projectRef,ref);assert.equal(identity.stagingCertificationAllowed,true);record('application backend identity');
 const sponsor=await stagingSession('SPONSOR_VIEWER'),facilitator=await stagingSession('FACILITATOR'),learner=await stagingSession('LEARNER'),admin=await stagingSession('SYSTEM_ADMIN');
 record('real Auth sign-in for four dedicated QA roles');
 const report=await sponsor.request('/api/staff');
 assert.equal(report.sponsor.cohorts.length,1);
 const group=report.sponsor.cohorts[0];assert.equal(group.cohort.name,'BIS hardening synthetic cohort 20261006');
 assert.equal(group.participantCount,20);assert.equal(group.suppressed,false);
 assert.equal(group.learningSummary.participantCount,20);
 assert.equal(group.evidenceFlow.participantCount,20);
 assert.doesNotMatch(JSON.stringify(report.sponsor),/PRIVATE-HARDENING-REFLECTION|SYNTHETIC-HARDENING-EVIDENCE|fullscope-20261006-\d+@/);
 record('scoped sponsor API populations and private-value exclusion');
 const dev=await facilitator.request(`/api/facilitator-development?cohortId=${encodeURIComponent(group.cohort.id)}&learnerId=${encodeURIComponent(learner.account.id)}`);
 assert.equal(dev.privacy.structuralOnly,true);assert.equal(dev.privacy.privateResponseValuesIncluded,false);assert.equal(dev.privacy.p3EvidenceIncluded,false);
 assert.doesNotMatch(JSON.stringify(dev),/PRIVATE-HARDENING-REFLECTION|SYNTHETIC-HARDENING-EVIDENCE/);
 record('facilitator development structural evidence boundary');
 const states={};
 for(const [role,session] of Object.entries({sponsor,facilitator,learner,admin})){
  const file=resolve(output+`.${role}.private.json`);await session.browserState(file);states[role]=JSON.parse(await readFile(file,'utf8'));
 }
 browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const sponsorContext=await browser.newContext({storageState:states.sponsor});
 const denied=await sponsorContext.request.get(`${base}/api/staff?report=pdf&cohortId=00000000-0000-0000-0000-000000000099`);assert.equal(denied.status(),403);record('wrong programme export denied');
 const pdf=await sponsorContext.request.get(`${base}/api/staff?report=pdf&cohortId=${encodeURIComponent(group.cohort.id)}`);assert.equal(pdf.status(),200);assert.match(pdf.headers()['content-type'],/application\/pdf/);assert.match(pdf.headers()['cache-control'],/private/);assert.equal((await pdf.body()).subarray(0,4).toString(),'%PDF');record('authenticated institutional PDF export');
 const learnerContext=await browser.newContext({storageState:states.learner});
 assert.equal((await learnerContext.request.get(`${base}/api/staff`)).status(),403);
 assert.equal((await learnerContext.request.get(`${base}/api/content-studio`)).status(),403);
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(`${base}/api/staff`)).status(),401);record('learner role and anonymous access denied');
 const adminContext=await browser.newContext({storageState:states.admin});
 const volume=await adminContext.request.post(`${base}/api/content-studio/volume-audit`,{multipart:{file:{name:'volume-1.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await readFile('content/sources/volume-1.docx')},volume:'1',version:'measurement-staging-20261013',stage:'0'}});
 assert.equal(volume.status(),200);const audited=await volume.json();
 assert.equal(audited.labs.length,12);assert.ok(audited.labs.every(lab=>lab.measurementReadiness&&lab.stageStatus==='NOT_REQUESTED'));
 result.sourceAudit={labs:audited.labs.length,rateBindingsNeedingReview:audited.labs.reduce((n,lab)=>n+lab.measurementReadiness.issues.filter(issue=>issue.code==='RATE_BINDING_REQUIRED').length,0),staged:false};record('authenticated read-only measurement readiness audit');
 const page=await sponsorContext.newPage();
 for(const width of [360,430,1280]){
  await page.setViewportSize({width,height:900});await page.goto(`${base}/workspace?view=sponsor`);await page.waitForLoadState('networkidle');
  assert.ok(await page.locator('.programme-outcomes').count(),'Programme outcomes must render.');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1,`Page overflow at ${width}px`);
  result.viewports.push({width,status:'PASS'});
 }
 record('real sponsor page at three viewports');
 result.status='PASS';result.observedAt=new Date().toISOString();
 await writeFile(output,JSON.stringify(result,null,2),{mode:0o600});
 console.log(JSON.stringify({status:result.status,checks:result.checks.length,viewports:result.viewports,sourceAudit:result.sourceAudit}));
} catch(error) {
 console.error(`Staging app failure: ${error.name}; server exit ${server?.exitCode}, signal ${server?.signalCode}`);
 console.error(serverErrors.replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted token]'));
 throw error;
} finally {await browser?.close();if(server){server.kill('SIGTERM');}}
