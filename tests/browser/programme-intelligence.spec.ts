import {test,expect} from '@playwright/test';
const cohort={id:'group',name:'Leap9 reporting fixture',labCode:'SYS',labVersion:'1',status:'ACTIVE',startsOn:null,endsOn:null,memberIds:['learner']};
const outcome={cohort,participantCount:20,minimumReportableCohortSize:5,suppressed:false,metrics:null,evidenceFlow:{runtimeMode:'DYNAMIC',suppressed:false,minimumReportableCohortSize:5,minimumReportableCellSize:3,participantCount:20,totals:{recordedResponses:24,anchoredMeasures:9,startedExperiment:3,completed:null},stages:[{investigation:7,participants:3,responses:24,suppressed:false},{investigation:8,participants:null,responses:null,suppressed:true}]},learningSummary:{suppressed:false,learningJourney:{days:[{day:1,reached:20,completed:18},{day:2,reached:18,completed:16}],baselineThemes:[],skillShifts:[],activity:{participantsWithHandbookActivity:20,participantsWithStructuredResponses:18,structuredResponsesRecorded:24}}},organisationLearning:null,learningChecks:null,questionPatterns:null,deepAnalysis:null,assessmentSummary:{participants:20,suppressed:false,rubrics:[{rubric_id:'rubric',title:'Systems Transfer Test',sample:3,average_total:4,maximum_total:5}]}};
const learner={userId:'learner',cohortId:'group',displayName:'Thandi Mokoena',email:'learner@local.invalid',enrolment:{id:'enrolment',status:'ACTIVE',currentInvestigation:7,labVersion:'1',experimentStartedAt:null},experiment:null};
const base={identity:{id:'staff',email:'staff@local.invalid',displayName:'Staff'},roles:['FACILITATOR','PROGRAMME_OWNER'],admin:null,facilitator:{cohorts:[cohort],learners:[learner],notes:[],referrals:[]},sponsor:{cohorts:[outcome]},safeguarding:null};
function observe(page:import('@playwright/test').Page){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});return async()=>{expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);};}
test('programme report explains findings, preserves unavailable values and has accessible chart data',async({page},info)=>{
 const verify=observe(page);await page.route('**/api/staff',r=>r.fulfill({json:base}));await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 await expect(page.getByText('3 of 20 participants have a recorded experiment start.',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Systems Transfer Test',exact:true})).toBeVisible();
 await page.getByText('Progress and programme context',{exact:true}).click();const graphic=page.locator('figure').filter({has:page.getByRole('heading',{name:'Where participants are in the programme'})});await expect(graphic.locator('.programme-report-bar-row strong').filter({hasText:'Unavailable'})).toBeVisible();await graphic.getByText('View chart values and comparison basis').click();await expect(graphic.getByRole('row',{name:'Experiment start recorded 3 20 participants'})).toBeVisible();
 await page.getByText('What supports this finding?').first().click();await expect(page.getByText('A recorded start is not proof that an opportunity occurred or that behaviour improved.',{exact:true})).toBeVisible();await expect(page.getByText('Thandi Mokoena')).toHaveCount(0);
 await page.screenshot({path:`test-results/intelligence-${info.project.name}.png`,fullPage:true});await verify();
});
test('facilitator can act on a check-in suggestion and return with browser Back',async({page},info)=>{
 const verify=observe(page);await page.route('**/api/staff',r=>r.fulfill({json:base}));await page.route('**/api/class-operations?**',r=>r.fulfill({json:{sessions:[],attendance:[]}}));await page.goto('/staff-shell?view=facilitator&group=group');
 await expect(page.getByRole('heading',{name:'Where a check-in could help'})).toBeVisible();await page.getByText('Thandi Mokoena · Reached experiment preparation; no start is recorded.',{exact:true}).click();await expect(page.getByText('Reached experiment preparation; no start is recorded.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Open participant · Thandi Mokoena'}).click();await expect(page).toHaveURL(/learner=learner/);await expect(page.getByRole('heading',{name:'Thandi Mokoena',exact:true})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'Where a check-in could help'})).toBeVisible();await page.screenshot({path:`test-results/facilitator-intelligence-${info.project.name}.png`,fullPage:true});await verify();
});
test('institutional PDF route really renders embedded fonts with the production renderer',async({request})=>{
 const response=await request.get('/experience/leap9/report');expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('application/pdf');const bytes=await response.body();expect(bytes.subarray(0,4).toString()).toBe('%PDF');expect(bytes.length).toBeGreaterThan(20000);
});

test('facilitator groups missing observations into one keyboard accessible check-in', async ({ page }) => {
 const verify = observe(page);
 const learners = ['Nandi Zulu', 'Musa Mkhize', 'Keitumetse Seabi'].map((displayName, index) => ({ ...learner, userId: `learner-${index}`, displayName, experiment: { recordedDays: 0, opportunityCount: 0 }, enrolment: { ...learner.enrolment, experimentStartedAt: '2026-10-01T00:00:00Z' } }));
 await page.route('**/api/staff', r => r.fulfill({ json: { ...base, facilitator: { ...base.facilitator, learners } } }));
 await page.route('**/api/class-operations?**', r => r.fulfill({ json: { sessions: [], attendance: [] } }));
 await page.goto('/staff-shell?view=facilitator&group=group');
 const summary = page.getByText('3 learners · No observations yet', { exact: true });
 await expect(summary).toBeVisible();
 await expect(page.getByRole('button', { name: 'Open participant · Nandi Zulu' })).toBeHidden();
 await summary.focus(); await page.keyboard.press('Enter');
 await expect(page.getByText('The experiment period has started; no observation is recorded yet.', { exact: true })).toHaveCount(1);
 await expect(page.getByRole('button', { name: 'Open participant · Nandi Zulu' })).toBeVisible();
 await page.getByRole('button', { name: 'Open participant · Musa Mkhize' }).click();
 await expect(page.getByRole('heading', { name: 'Musa Mkhize', exact: true })).toBeVisible();
 await page.goBack(); await expect(summary).toBeVisible(); await verify();
});

test('privacy-limited reports keep explanation collapsed without exposing results', async ({ page }) => {
 const verify = observe(page);
 await page.route('**/api/staff', r => r.fulfill({ json: { ...base, sponsor: { cohorts: [{ ...outcome, participantCount: 2, suppressed: true }] } } }));
 await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 const summary = page.getByText('Group results are not available yet', { exact: true });
 await expect(summary).toBeVisible();
 await expect(page.getByText(/This group has 2 learners/)).toBeHidden();
 await summary.focus(); await page.keyboard.press('Enter');
 await expect(page.getByText(/This group has 2 learners/)).toBeVisible();
 await expect(page.getByRole('heading', { name: 'Systems Transfer Test', exact: true })).toHaveCount(0);
 await expect(page.getByText('Thandi Mokoena')).toHaveCount(0); await verify();
});
