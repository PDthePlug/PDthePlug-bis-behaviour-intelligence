import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createExplorationSession,explorationHref} from '../lib/experience/exploration-session.mjs';
import {availableLabPrompts} from '../lib/lab-interaction-contract.mjs';
const content=JSON.parse(await readFile(new URL('../lib/experience/exploration-content.json',import.meta.url)));
const report={cohort:{},learningSummary:{},metrics:{example:20}};
const create=history=>createExplorationSession(content,report,history);
const post=(session,role,path,body)=>session.request(role,path,{method:'POST',body:JSON.stringify(body)});
function pass(stage,day=1){return availableLabPrompts(content.lab,stage,day).filter(p=>!p.readOnly).map(p=>({semanticFieldId:p.id,responseStatus:'PASS',value:''}));}
test('explorer is authored from the canonical Habit source and complete handbook',async()=>{
 assert.equal(content.sourceSha256,createHash('sha256').update(await readFile(new URL('../content/sources/volume-1.docx',import.meta.url))).digest('hex'));
 assert.equal(content.lab.investigations.length,9);assert.equal(new Set(content.programme.treatment.pages.filter(p=>p.programmeDay).map(p=>p.programmeDay)).size,10);
});
test('example transport rejects privileged requests and cross-role writes without a network fallback',async()=>{
 const session=create();for(const [role,path] of [['owner','/api/universal-lab'],['facilitator','/api/profile'],['learner','/api/staff'],['learner','https://other.invalid/api/private'],['owner','/api/content-studio']])assert.equal((await session.request(role,path)).status,403);
 assert.equal((await post(session,'owner','/api/universal-lab',{action:'openLab',consent:true})).status,400);assert.equal(session.labSnapshot().enrolment,null);
});
test('example Lab uses canonical validation, saves privately and replays without changing fixed programme results',async()=>{
 const session=create();session.execute('learner','/api/universal-lab',{action:'openLab',consent:true});
 assert.equal((await post(session,'learner','/api/universal-lab',{action:'saveInvestigation',investigation:5,items:[]})).status,400);
 session.execute('learner','/api/universal-lab',{action:'saveInvestigation',investigation:0,items:pass(0)});
 for(let stage=1;stage<=6;stage++)session.execute('learner','/api/universal-lab',{action:'saveInvestigation',investigation:stage,items:pass(stage)});
 assert.equal(session.labSnapshot().enrolment.currentInvestigation,7);
 session.execute('learner','/api/universal-lab',{action:'saveInvestigation',investigation:7,items:pass(7)});
 session.execute('learner','/api/universal-lab',{action:'nextExampleDay'});assert.equal(session.labSnapshot().experimentTiming.availableDay,2);
 const resumed=create(session.state.actions);assert.equal(resumed.labSnapshot().experimentTiming.availableDay,2);assert.deepEqual(resumed.labSnapshot().responses,session.labSnapshot().responses,Object.entries(session.labSnapshot().responses).map(([id,row])=>id+row.value).join(','));
 assert.deepEqual(session.state.sponsor.cohorts[0].metrics,{example:20});
 const review=await(await session.request('facilitator','/api/evidence-engine?view=workspace')).json();assert.equal(review.submissions.length,0);
});
test('example class plans, attendance and support are local and survive replay',async()=>{
 const session=create();session.execute('facilitator','/api/class-operations',{action:'session',day:3,date:'2026-10-07',status:'HELD',note:'Prepare the separate Lab handover'});
 session.execute('facilitator','/api/class-operations',{action:'attendance',sessionId:'class-0',learnerId:'example-0',attendance:'PRESENT'});
 session.execute('facilitator','/api/staff',{action:'addFacilitatorNote',learnerUserId:'example-0',category:'CHECK_IN',content:'Agree the next observation'});
 const resumed=create(session.state.actions);assert.equal(resumed.state.classes.attendance[0].attendance,'PRESENT');assert.equal(resumed.state.facilitator.notes[0].content,'Agree the next observation');
});
test('platform navigation stays inside the account-free explorer',()=>{
 for(const path of ['/labs/hab?step=8','/habit-lab/experiment','/learn','/handbooks/hab','/profile#evidence-portfolio'])assert.match(explorationHref(path),/^\/explore\?role=learner/);
 assert.match(explorationHref('/labs/hab?step=8'),/step=8/);assert.equal(explorationHref('/sign-in'),'/sign-in');
});
test('selected shared evidence can be reviewed; a revision removes the previous review from the queue',async()=>{
 const session=create();session.execute('learner','/api/universal-lab',{action:'openLab',consent:true});session.execute('learner','/api/universal-lab',{action:'saveInvestigation',investigation:0,items:pass(0)});
 const prompt=availableLabPrompts(content.lab,1).find(p=>p.type==='TEXT'&&!p.readOnly&&p.sensitivity!=='P3');const items=pass(1).map(item=>item.semanticFieldId===prompt.id?{...item,responseStatus:'ANSWERED',value:'Private fictional observation'}:item);
 session.execute('learner','/api/universal-lab',{action:'saveInvestigation',investigation:1,items});
 assert.equal((await(await session.request('facilitator','/api/evidence-engine?view=workspace')).json()).submissions.length,0);
 session.execute('learner','/api/evidence-engine',{action:'share',title:'Fictional observation',evidenceIds:[prompt.id]});
 session.execute('facilitator','/api/evidence-engine',{action:'assess',submissionId:'shared-0',feedback:'Check the next opportunity',disposition:'REVIEWED'});
 const resumed=create(session.state.actions);assert.equal((await(await resumed.request('facilitator','/api/evidence-engine?view=workspace')).json()).submissions[0].reviews[0].feedback,'Check the next opportunity');
 resumed.execute('learner','/api/universal-lab',{action:'saveInvestigation',investigation:1,items:items.map(item=>item.semanticFieldId===prompt.id?{...item,value:'Revised fictional observation'}:item)});
 assert.equal((await(await resumed.request('facilitator','/api/evidence-engine?view=workspace')).json()).submissions.length,0);
});
