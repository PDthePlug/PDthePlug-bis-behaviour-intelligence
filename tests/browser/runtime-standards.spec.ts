import {expect,test,type Page} from '@playwright/test';
const errors = new WeakMap<Page,string[]>();
const expectedErrors = new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));page.on('console',message=>{if(message.type()==='error')list.push(message.text());});});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual(expectedErrors.get(page) || []);});
const learner={userId:'learner',email:'fixture@example.invalid',displayName:'Browser learner',deliveryEdition:'school',mode:'PRIVATE',status:'ACTIVE',cohortId:'group',labCode:'RES',enrolment:{id:'enrolment',labVersion:'1',status:'IN_PROGRESS',currentInvestigation:7,startedAt:'2026-10-01T10:00:00Z',experimentStartedAt:'2026-10-02T10:00:00Z',updatedAt:'2026-10-02T10:00:00Z',completedAt:null},experiment:null,lastActivityAt:'2026-10-02T10:00:00Z'};
const cohort={id:'group',name:'Browser group',labCode:'RES',labVersion:'1',facilitatorEmail:'staff@example.invalid',status:'ACTIVE',startsOn:null,endsOn:null,memberIds:['learner'],memberCount:1};
const base={identity:{id:'staff',email:'staff@example.invalid',displayName:'Browser staff'},roles:['SYSTEM_ADMIN','FACILITATOR','SPONSOR_VIEWER'],privacyBoundary:{facilitatorCanSee:[],facilitatorCannotSee:[],sponsorCanSee:[],sponsorCannotSee:[]},admin:null,facilitator:null,sponsor:null,safeguarding:null};
const outcome=(responses:number)=>({...base,sponsor:{cohorts:[{cohort,participantCount:6,suppressed:false,minimumReportableCohortSize:5,metrics:null,learningSummary:null,learningChecks:null,questionPatterns:null,deepAnalysis:null,organisationLearning:null,decisionRegister:null,evidenceFlow:{runtimeMode:'DYNAMIC',participantCount:6,suppressed:false,minimumReportableCohortSize:5,minimumReportableCellSize:3,totals:{enrolled:6,startedExperiment:3,completed:null,recordedResponses:responses,anchoredMeasures:9},stages:[{investigation:7,participants:3,responses:responses,suppressed:false},{investigation:8,participants:null,responses:null,suppressed:true}],privacyNote:'Counts describe recorded evidence, not behaviour scores or proof of change.'}}],signalCoverage:[]}});
test('shared tables preserve groups, authored examples, geometry and saved answers',async({page})=>{
 await page.addInitScript(()=>{if(!sessionStorage.getItem('fixture-seeded')){sessionStorage.setItem('LDR.WB.AUTO.TABLE.9MEULY','Historic first answer');sessionStorage.setItem('fixture-seeded','1');}});
 await page.goto('/standards');const controls=page.locator('table textarea');await expect(controls).toHaveCount(2);
 const ids=await controls.evaluateAll(fields=>fields.map(field=>(field as HTMLElement).dataset.fieldId));expect(new Set(ids).size).toBe(2);expect(ids[0]).toBe('LDR.WB.AUTO.TABLE.9MEULY');await expect(controls.nth(0)).toHaveValue('Historic first answer');await expect(controls.nth(1)).toHaveValue('');
 await expect(page.getByText('Preserve this authored answer',{exact:true})).toHaveCount(2);await expect(page.locator('[colspan="2"]')).toHaveText('Combined meaning');
 await controls.nth(0).fill('First saved answer');await controls.nth(1).fill('Second saved answer');await page.reload();await expect(controls.nth(0)).toHaveValue('First saved answer');await expect(controls.nth(1)).toHaveValue('Second saved answer');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(await controls.nth(0).getAttribute('data-response-group')).toBeTruthy();
});
test('Universal outcomes refresh recorded evidence and clear revoked access',async({page})=>{
 let count=24,revoked=false;await page.route('**/api/staff',route=>route.fulfill({status:revoked?403:200,json:revoked?{error:'Programme access revoked'}:outcome(count)}));await page.goto('/outcomes');
 await expect(page.getByRole('heading',{name:'From learner evidence to programme results'})).toBeVisible();await expect(page.getByText('24',{exact:true})).toBeVisible();expect(await page.locator('.outcome-question-grid').count()).toBe(0);
 count=30;await page.getByRole('button',{name:'Refresh results'}).click();await expect(page.getByText('30',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Download PDF'})).toHaveAttribute('href',/report=pdf/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expectedErrors.set(page,['Failed to load resource: the server responded with a status of 403 (Forbidden)']);
 revoked=true;const denial=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/staff' && response.status()===403);await page.getByRole('button',{name:'Refresh results'}).click();await denial;await expect(page.getByText('Programme access revoked')).toBeVisible();await expect(page.getByText('30',{exact:true})).toHaveCount(0);
});
test('administrator creates a group for the published Universal Lab',async({page})=>{
 let saved:Record<string,unknown>|null=null;const snapshot={...base,admin:{metrics:{learners:1,completed:0,experimentActive:1,openSafeguardingCases:0,opportunityBands:{none:0,one:0,two:0,threePlus:0}},learners:[learner],roleAssignments:[],cohorts:[cohort],labAssignments:[],supportedLabVersions:[],publishedLabs:[{code:'RES',title:'Resilience Lab',version:'1',runtimeMode:'DYNAMIC'}]}};
 await page.route('**/api/staff',async route=>{if(route.request().method()==='POST')saved=route.request().postDataJSON();await route.fulfill({json:snapshot});});await page.goto('/staff');await page.getByPlaceholder('Programme · Group A').fill('Universal browser group');await page.getByRole('button',{name:'Create group',exact:true}).click();await expect.poll(()=>saved?.labCode).toBe('RES');expect((saved as Record<string,unknown>|null)?.labVersion).toBe('1');
});
test('facilitator displays Universal experiment activity without guessed legacy counts',async({page})=>{
 await page.route('**/api/staff',route=>route.fulfill({json:{...base,facilitator:{cohorts:[cohort],learners:[learner],notes:[],referrals:[]}}}));await page.goto('/staff?role=facilitator&section=participants&learner=learner');await expect(page.getByText('Browser learner',{exact:true}).first()).toBeVisible();await expect(page.getByText('Experiment started · evidence counts not available')).toBeVisible();await expect(page.getByText('Not available',{exact:true}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
