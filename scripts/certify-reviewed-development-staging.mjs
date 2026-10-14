import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,relative} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {stagingSession} from './hardening-staging-session.mjs';
const ref='lbmhkddrkhtmkcvfmumd';
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,`${ref}.supabase.co`);
assert.equal(process.env.BIS_STAGING_ALLOW_MUTATIONS,'true');
assert.notEqual(process.env.BIS_EVIDENCE_AI_ENABLED,'true','Model activation is not part of this certification.');
const output=resolve(process.env.BIS_REVIEWED_AUDIT_FILE);
assert.ok(relative(process.cwd(),output).startsWith('..'));
const port=Number(process.env.BIS_STAGING_APP_PORT||3200),base=`http://127.0.0.1:${port}`;
const result={projectRef:ref,checks:[],viewports:[],modelEnabled:false};
let server,browser;
const record=name=>{result.checks.push({name,status:'PASS'});console.log(`PASS: ${name}`);};
try{
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{env:process.env,stdio:['ignore','pipe','pipe']});
 server.stdout.resume();server.stderr.resume();
 let ready=false;
 for(let n=0;n<120;n++){
  if(server.exitCode!==null)throw Error('Staging application exited.');
  try{const r=await fetch(base+'/api/staging-certification/environment');const b=await r.json();if(r.ok&&b.projectRef===ref&&b.stagingCertificationAllowed){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(ready);record('application backend identity');
 const sponsor=await stagingSession('SPONSOR_VIEWER'),facilitator=await stagingSession('FACILITATOR'),learner=await stagingSession('LEARNER');
 record('real authentication for three dedicated QA roles');
 const snapshot=await sponsor.request('/api/staff');assert.equal(snapshot.sponsor.cohorts.length,1);
 const group=snapshot.sponsor.cohorts[0];assert.equal(group.participantCount,20);assert.equal(group.suppressed,false);
 assert.equal(group.reviewedDevelopment.cohortId,group.cohort.id);assert.equal(group.reviewedDevelopment.participantCount,20);
 assert.equal(group.reviewedDevelopment.evidenceBasis,'HUMAN_REVIEWED_TASK_COVERAGE');
 assert.doesNotMatch(JSON.stringify(snapshot.sponsor),/PRIVATE-HARDENING-REFLECTION|SYNTHETIC-HARDENING-EVIDENCE|fullscope-20261006-\d+@/);
 record('programme snapshot includes exact-scope reviewed coverage without private wording');
 const development=await facilitator.request(`/api/facilitator-development?cohortId=${encodeURIComponent(group.cohort.id)}&learnerId=${encodeURIComponent(learner.account.id)}`);
 assert.equal(development.privacy.privateResponseValuesIncluded,false);assert.equal(development.privacy.p3EvidenceIncluded,false);assert.ok(development.reviewedEvidence);
 assert.notEqual(development.reviewedEvidence.status,'UNAVAILABLE');assert.doesNotMatch(JSON.stringify(development),/PRIVATE-HARDENING-REFLECTION|SYNTHETIC-HARDENING-EVIDENCE/);
 record('facilitator endpoint resolves reviewed metadata without model calls or wording');
 const humanProfile=await facilitator.request(`/api/development-intelligence?view=learner&cohortId=${encodeURIComponent(group.cohort.id)}&learnerId=${encodeURIComponent(learner.account.id)}`);
 assert.equal(humanProfile.modelVersion,'bis-development-intelligence:1');assert.ok(Array.isArray(humanProfile.areas));assert.doesNotMatch(JSON.stringify(humanProfile),/PRIVATE-HARDENING-REFLECTION|SYNTHETIC-HARDENING-EVIDENCE/);
 const humanProgramme=await sponsor.request(`/api/development-intelligence?view=programme&cohortId=${encodeURIComponent(group.cohort.id)}`);assert.notEqual(humanProgramme.status,'SUPPRESSED');assert.equal(humanProgramme.participantCount,20);
 const contracts=await facilitator.request(`/api/development-intelligence?view=contracts&cohortId=${encodeURIComponent(group.cohort.id)}`);assert.ok(Array.isArray(contracts.contracts));
 const ownReport=await learner.request('/api/evidence-engine?view=learnerReport');assert.equal(ownReport.developmentIntelligence.modelVersion,'bis-development-intelligence:1');assert.ok(Array.isArray(ownReport.developmentIntelligence.areas));
 record('real development API resolves authorised human profiles, programme evidence, authored contract workspace and owned learner export');
 const sponsorState=output+'.sponsor.private.json',learnerState=output+'.learner.private.json';
 await sponsor.browserState(sponsorState);await learner.browserState(learnerState);
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({storageState:JSON.parse(await readFile(sponsorState,'utf8'))});
 const denied=await context.request.get(`${base}/api/facilitator-development?cohortId=${encodeURIComponent(group.cohort.id)}&learnerId=${encodeURIComponent(learner.account.id)}`);assert.equal(denied.status(),403);assert.equal((await context.request.get(`${base}/api/development-intelligence?view=learner&cohortId=${encodeURIComponent(group.cohort.id)}&learnerId=${encodeURIComponent(learner.account.id)}`)).status(),403);record('sponsor cannot access learner review metadata or development facts');
 const pdf=await context.request.get(`${base}/api/staff?report=pdf&cohortId=${encodeURIComponent(group.cohort.id)}`);assert.equal(pdf.status(),200);assert.match(pdf.headers()['content-type'],/application\/pdf/);assert.equal((await pdf.body()).subarray(0,4).toString(),'%PDF');record('real institutional PDF uses the same report snapshot');
 const learnerContext=await browser.newContext({storageState:JSON.parse(await readFile(learnerState,'utf8'))});
 assert.equal((await learnerContext.request.get(`${base}/api/facilitator-development?cohortId=${encodeURIComponent(group.cohort.id)}&learnerId=${encodeURIComponent(learner.account.id)}`)).status(),403);
 assert.equal((await learnerContext.request.get(base+'/api/development-intelligence?view=learner')).status(),200);
 const anon=await browser.newContext();assert.equal((await anon.request.get(base+'/api/staff')).status(),401);assert.equal((await anon.request.get(base+'/api/development-intelligence')).status(),401);record('learner-role and anonymous reporting access denied');
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [360,430,1280]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/workspace?view=outcomes&section=overview');await expect(page.locator('.programme-outcomes')).toBeVisible({timeout:45_000});await expect(page.getByRole('heading',{name:'Results',exact:true})).toBeVisible();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
  result.viewports.push({width,status:'PASS'});
 }
 assert.deepEqual(errors,[]);record('real programme route at 360, 430 and 1280 pixels without overflow or page errors');
 await writeFile(output,JSON.stringify(result,null,2)+'\n');
}finally{await browser?.close();server?.kill('SIGTERM');}
