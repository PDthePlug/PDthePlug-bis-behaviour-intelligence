import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../lib/commercial-intelligence.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { buildCommercialBrief, deterministicCommercialAnswer, fingerprintCommercialInput } = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const now = new Date('2026-10-07T12:00:00Z');
const fixture = () => ({ organisations: [{ id:'org', name:'Example Foundation' }], contacts: [], proposals: [], tasks: [], activities: [], opportunities: [{id:'opp',code:'EX-1',organisation_id:'org',opportunity_name:'Example youth programme',stage:'CONTACTED',priority:'HIGH',wave:'WAVE_1',commercial_thesis:'Practical learning in the youth programme.',next_action:'Agree a short discussion',next_action_due:null,last_activity_at:null}] });
const activity = (id, date, direction='OUTBOUND', type='EMAIL') => ({id,opportunity_id:'opp',direction,activity_type:type,occurred_at:date,body:'Recorded commercial context only.'});
test('day-three follow-ups preserve incoming replies and meetings needing follow-through', () => {
 const input=fixture(); input.activities=[activity('first','2026-10-04T08:00:00Z')];
 assert.ok(buildCommercialBrief(input,now).recommendations.some(item=>item.kind==='FOLLOW_UP'));
 input.activities.push(activity('reply','2026-10-06T08:00:00Z','INBOUND'));
 const reply=buildCommercialBrief(input,now).recommendations;
 assert.ok(reply.some(item=>item.kind==='REPLY_DUE'));assert.ok(!reply.some(item=>item.kind==='FOLLOW_UP'));
 input.activities.push(activity('meeting','2026-10-06T10:00:00Z','INTERNAL','MEETING'));
 assert.ok(buildCommercialBrief(input,now).recommendations.some(item=>item.kind==='MEETING_FOLLOW_UP'));
 input.activities.push(activity('note','2026-10-07T10:00:00Z','INTERNAL','NOTE'));
 assert.ok(buildCommercialBrief(input,now).recommendations.some(item=>item.kind==='MEETING_FOLLOW_UP'),'an internal note does not erase a missing meeting follow-up');
});
test('unanswered sequences recommend pausing and open tasks remain visible', () => {
 const input=fixture();input.activities=[1,2,3].map(n=>activity('a'+n,`2026-09-${20+n}T08:00:00Z`));
 input.tasks=[{id:'task',opportunity_id:'opp',title:'Confirm the programme date',status:'OPEN',due_at:'2026-10-05T08:00:00Z'}];
 const brief=buildCommercialBrief(input,now);
 assert.match(brief.recommendations.find(item=>item.kind==='FOLLOW_UP').recommendedAction,/pause or nurture/);
 assert.ok(brief.recommendations.some(item=>item.kind==='TASK_OVERDUE'));
 input.opportunities[0].stage='HOLD';assert.equal(buildCommercialBrief(input,now).recommendations.length,0);
});
test('prospect-specific questions use recorded memory and edited notes invalidate stale briefs', () => {
 const input=fixture();input.activities=[{...activity('meeting','2026-10-06T10:00:00Z','INTERNAL','MEETING'),body:'The team asked for a short demonstration before discussing dates.'}];
 const brief=buildCommercialBrief(input,now);const answer=deterministicCommercialAnswer('Prepare me for Example Foundation',brief,input);
 assert.match(answer,/short demonstration before discussing dates/);assert.match(answer,/No verified direct contact/);assert.match(answer,/Practical learning in the youth programme/);
 const fingerprint=fingerprintCommercialInput(input);input.activities[0].body='Updated meeting context.';assert.notEqual(fingerprintCommercialInput(input),fingerprint);
});

test('recent human decisions are remembered until the supporting evidence changes', () => {
 const input=fixture();input.opportunities[0].stage='QUALIFIED';
 const initial=buildCommercialBrief(input,now);const item=initial.recommendations[0];
 const decisions=[{signal_key:item.signalKey,status:'DISMISSED',evidence:item.evidence}];
 assert.equal(buildCommercialBrief(input,now,decisions).recommendations.length,0);
 input.opportunities[0].contact_status='NEEDS_VERIFICATION';
 assert.ok(buildCommercialBrief(input,now,decisions).recommendations.length>0,'changed evidence makes the suggestion reviewable again');
});

test('unapproached priorities rank recorded access and omit paused or already contacted prospects', () => {
 const input=fixture();input.opportunities[0].stage='QUALIFIED';
 input.organisations.push({id:'ready-org',name:'Ready Programme'},{id:'held-org',name:'Paused Programme'});
 input.opportunities.push({...input.opportunities[0],id:'ready',code:'EX-2',organisation_id:'ready-org',opportunity_name:'Ready opportunity'},{...input.opportunities[0],id:'held',code:'EX-3',organisation_id:'held-org',opportunity_name:'Paused opportunity',stage:'HOLD'},{...input.opportunities[0],id:'contacted',code:'EX-4',opportunity_name:'Already contacted opportunity',stage:'CONTACTED'});
 input.contacts=[{id:'contact',organisation_id:'ready-org',verification_status:'VERIFIED',email:'lead@example.invalid',full_name:'Recorded Lead'}];
 const answer=deterministicCommercialAnswer('Find the five strongest opportunities we have not approached.',buildCommercialBrief(input,now),input);
 assert.match(answer,/1\. Ready Programme/);assert.doesNotMatch(answer,/Paused opportunity|Already contacted opportunity/);assert.match(answer,/not a forecast of a sale/);
});
