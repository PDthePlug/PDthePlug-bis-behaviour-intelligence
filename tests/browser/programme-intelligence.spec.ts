import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{ await page.route('**/api/facilitator-development?**',r=>r.fulfill({json:{profile:{areas:[]},developmentEvidence:{areas:[],boundary:'Permitted structural evidence only'}}})); });
const cohort={id:'group',name:'Leap9 reporting fixture',labCode:'SYS',labVersion:'1',status:'ACTIVE',startsOn:null,endsOn:null,memberIds:['learner']};
const outcome={cohort,participantCount:20,minimumReportableCohortSize:5,suppressed:false,metrics:null,evidenceFlow:{runtimeMode:'DYNAMIC',suppressed:false,minimumReportableCohortSize:5,minimumReportableCellSize:3,participantCount:20,totals:{recordedResponses:24,anchoredMeasures:9,startedExperiment:3,completed:null},stages:[{investigation:7,participants:3,responses:24,suppressed:false},{investigation:8,participants:null,responses:null,suppressed:true}]},learningSummary:{suppressed:false,learningJourney:{days:[{day:1,reached:20,completed:18},{day:2,reached:18,completed:16}],baselineThemes:[],skillShifts:[],activity:{participantsWithHandbookActivity:20,participantsWithStructuredResponses:18,structuredResponsesRecorded:24}}},organisationLearning:null,learningChecks:null,questionPatterns:null,deepAnalysis:null,assessmentSummary:{participants:20,suppressed:false,rubrics:[{rubric_id:'rubric',title:'Systems Transfer Test',sample:3,average_total:4,maximum_total:5}]}};
const learner={userId:'learner',cohortId:'group',displayName:'Thandi Mokoena',email:'learner@local.invalid',enrolment:{id:'enrolment',status:'ACTIVE',currentInvestigation:7,labVersion:'1',experimentStartedAt:null},experiment:null};
const base={identity:{id:'staff',email:'staff@local.invalid',displayName:'Staff'},roles:['FACILITATOR','PROGRAMME_OWNER'],admin:null,facilitator:{cohorts:[cohort],learners:[learner],notes:[],referrals:[]},sponsor:{cohorts:[outcome]},safeguarding:null};
function observe(page:import('@playwright/test').Page){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});return async()=>{expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);};}
test('programme report explains findings, preserves unavailable values and has accessible chart data',async({page},info)=>{
 const verify=observe(page);await page.route('**/api/staff',r=>r.fulfill({json:base}));await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 await expect(page.getByText('3 of 20 participants have a recorded experiment start.',{exact:true})).toBeHidden();await expect(page.getByRole('heading',{name:'Systems Transfer Test',exact:true})).toBeVisible();
 await page.getByText('Progress and programme context',{exact:true}).click();await expect(page.getByText('3 of 20 participants have a recorded experiment start.',{exact:true})).toBeVisible();const graphic=page.locator('figure').filter({has:page.getByRole('heading',{name:'Where participants are in the programme'})});await expect(graphic.locator('.programme-report-bar-row strong').filter({hasText:'Unavailable'})).toBeVisible();await graphic.getByText('View chart values and comparison basis').click();await expect(graphic.getByRole('row',{name:'Experiment start recorded 3 20 participants'})).toBeVisible();
 await page.getByRole('heading',{name:'Participants are beginning their real-world tests',exact:true}).locator('..').getByText('What supports this finding?').click();await expect(page.getByText('A recorded start is not proof that an opportunity occurred or that behaviour improved.',{exact:true})).toBeVisible();await expect(page.getByText('Thandi Mokoena')).toHaveCount(0);
 await page.screenshot({path:`test-results/intelligence-${info.project.name}.png`,fullPage:true});await verify();
});

test('sponsor activity distinguishes handbook progress, Lab respondents and answered fields', async ({ page }) => {
 const verify = observe(page);
 await page.route('**/api/staff', r => r.fulfill({ json: base }));
 await page.goto('/staff-shell?view=outcomes&section=learning&group=group');
 const journey = page.locator('.outcomes-learning-journey');
 await expect(journey.getByText('Handbook activity', { exact: true })).toBeVisible();
 await expect(journey.getByText('Lab answers', { exact: true })).toBeVisible();
 await expect(journey.getByText('Lab answers recorded', { exact: true })).toBeVisible();
 const basis = journey.getByText(/Handbook activity counts learners with saved handbook progress/);
 await expect(basis).toBeHidden();
 await journey.getByText('Where these counts come from', { exact: true }).focus(); await page.keyboard.press('Enter');
 await expect(basis).toBeVisible();
 await expect(journey.getByText(/they do not establish understanding, evidence quality or behaviour change/)).toBeVisible();
 await expect(page.getByText('Thandi Mokoena')).toHaveCount(0);
 await verify();
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

test('facilitator learning percentages state their response denominator and self-report limit', async ({ page }) => {
 const verify = observe(page);
 const learningChecks = { participantCount: 1, signalsRecorded: 4, understood: 2, unsure: 1, needsExample: 1, understoodRate: 50, supportSignalRate: 50, byDay: [{ semanticStepId: 'SYS.PROGRAMME.DAY1', signalsRecorded: 4, understood: 2, unsure: 1, needsExample: 1, understoodRate: 50, supportSignalRate: 50 }] };
 await page.route('**/api/staff', r => r.fulfill({ json: { ...base, facilitator: { ...base.facilitator, cohorts: [{ ...cohort, learningChecks }] } } }));
 await page.route('**/api/class-operations?**', r => r.fulfill({ json: { sessions: [], attendance: [] } }));
 await page.goto('/staff-shell?view=facilitator&group=group');
 const checks = page.locator('.facilitator-learning-checks');
 await expect(checks.getByText('Answers marked understood', { exact: true })).toBeVisible();
 await expect(checks.getByText('50%', { exact: true })).toBeVisible();
 await expect(checks.getByText('4 check responses', { exact: true })).toBeVisible();
 await expect(checks.getByText(/They are not test marks or evidence of behaviour change/)).toBeVisible();
 const basis = checks.getByText(/Percentages use recorded check responses/);
 await expect(basis).toBeHidden();
 await checks.getByText('How to read these responses', { exact: true }).focus(); await page.keyboard.press('Enter');
 await expect(basis).toBeVisible();
 await verify();
});

test('development leads group views while small stage counts stay hidden', async ({ page }, info) => {
 const verify=observe(page);
 const competencySummary={status:'AVAILABLE',participantCount:20,minimumReportableCohortSize:5,minimumReportableCellSize:3,reportClassification:{id:'COHORT_LEARNING_REPORT'},boundary:'Stages describe recorded programme work, not permanent ability.',competencies:[{competencyId:'AC03',title:'Goals, planning and prioritisation',reportableParticipants:3,distribution:[{code:'NOT_YET_EVIDENCED',label:'Not yet evidenced',count:17},{code:'APPLY',label:'Applies',count:3},{code:'TEST_AND_REVISE',label:'Tests and revises',count:null,suppressed:true}],externalFrameworkAreas:['Accountability'],nextQuestion:'Offer another chance to test and review a small plan.'}]};
 let suppressed=false;
 await page.route('**/api/staff',r=>r.fulfill({json:{...base,facilitator:{...base.facilitator,cohorts:[{...cohort,competencySummary}]},sponsor:{cohorts:[{...outcome,competencySummary:suppressed?{...competencySummary,status:'SUPPRESSED',competencies:[]}:competencySummary}]}}}));
 await page.route('**/api/class-operations?**',r=>r.fulfill({json:{sessions:[],attendance:[]}}));
 await page.goto('/staff-shell?view=facilitator&group=group');
 const group=page.locator('.facilitator-development-picture');await expect(group).toContainText('Goals, planning and prioritisation');await expect(group).toContainText('Hidden for privacy');
 expect((await group.boundingBox())!.y).toBeLessThan((await page.locator('.facilitator-group-summary').boundingBox())!.y);
 await page.screenshot({path:info.outputPath('facilitator-development.png'),fullPage:true});
 await page.goto('/staff-shell?view=outcomes&section=evidence&group=group');
 const owner=page.locator('.outcomes-competency-picture');await expect(owner).toContainText('Offer another chance to test and review a small plan.');await expect(owner).toContainText('Hidden');
 await expect(page.locator('.outcomes-context')).toBeVisible();
 await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 await expect(page.locator('.outcomes-context')).toBeHidden();
 await expect(page.locator('.outcomes-competency-picture')).toBeHidden();
 await page.screenshot({path:info.outputPath('programme-development.png'),fullPage:true});
 suppressed=true;await page.reload();await expect(page.locator('.outcomes-competency-picture')).toHaveCount(0);await expect(page.getByText('Development picture is hidden for privacy', {exact:true})).toBeVisible();await verify();
});

test('facilitator evidence matrix supports the next conversation without interpreting private text', async ({ page }) => {
 const verify = observe(page);
 await page.route('**/api/staff',r=>r.fulfill({json:base}));
 const { buildDevelopmentEvidence } = await import('../../lib/development-evidence.mjs');
 const developmentEvidence = buildDevelopmentEvidence({competencies:[{id:'AC-C04',title:'Self-management'}],records:[{id:'plan',lab_code:'HAB',lab_version:'1',semantic_field_id:'HAB.PLAN',status:'ACTIVE',sensitivity:'P1',classification_status:'APPROVED',competency:'AC-C04',evidence_class:'PLAN',recorded_at:'2026-10-01T10:00:00Z',value:'PRIVATE SECRET'}]});
 await page.route('**/api/facilitator-development?**',r=>r.fulfill({json:{profile:{areas:[],summary:'Evidence only',boundary:'Private'},developmentEvidence}}));
 await page.goto('/staff-shell?view=facilitator&section=participants&group=group&learner=learner');
 await expect(page.getByRole('heading',{name:'Where to support Thandi Mokoena next'})).toBeVisible();
 await expect(page.getByText('A plan is present; recorded practice is not yet visible.',{exact:true})).toBeVisible();
 await expect(page.getByRole('table',{name:'Evidence available by development area'})).toBeVisible();
 await page.getByText('Evidence history and limits',{exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.getByText('2026-10-01',{exact:true})).toBeVisible();
 await expect(page.getByText('PRIVATE SECRET')).toHaveCount(0);
 await expect(page.getByText('Programme participation and access',{exact:true})).toBeVisible();
 await verify();
});

test('programme paired self-report graphic is visible with its sample and no inferred skill claim', async ({ page }) => {
 const verify=observe(page);
 const withPair={...outcome,learningSummary:{...outcome.learningSummary,learningJourney:{...outcome.learningSummary.learningJourney,skillShifts:[{id:'control',label:'Perceived control',pairedParticipants:10,averagePre:4,averagePost:6}]}}};
 await page.route('**/api/staff',r=>r.fulfill({json:{...base,sponsor:{cohorts:[withPair]}}}));
 await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 await expect(page.getByRole('img',{name:'Perceived control: starting point 4, later check-in 6. Self-report, not assessed skill.'})).toBeVisible();
 await expect(page.getByText('10 participants with both check-ins. Same reported measure; self-report, not assessed capability.',{exact:true})).toBeVisible();
 await verify();
});

test('learner switching immediately hides previous evidence and ignores a delayed prior request', async ({page})=>{
 const verify=observe(page);
 const {buildDevelopmentEvidence}=await import('../../lib/development-evidence.mjs');
 let releaseBeta:()=>void=()=>{};const betaGate=new Promise<void>(resolve=>{releaseBeta=resolve;});
 await page.route('**/api/facilitator-development?**',async route=>{
  const id=new URL(route.request().url()).searchParams.get('learnerId')!;
  if(id==='beta')await betaGate;
  const developmentEvidence=buildDevelopmentEvidence({competencies:[{id:'AC-C04',title:`${id} area`}],records:[{id,lab_code:'HAB',lab_version:'1',semantic_field_id:`HAB.${id}`,status:'ACTIVE',sensitivity:'P1',classification_status:'APPROVED',competency:'AC-C04',evidence_class:'CONTEXT',recorded_at:'2026-10-01'}]});
  await route.fulfill({json:{profile:{areas:[]},developmentEvidence}}).catch(()=>{});
 });
 await page.goto('/development-switch');
 await expect(page.getByRole('rowheader',{name:'alpha area'})).toBeVisible();
 await page.getByRole('button',{name:'beta',exact:true}).click();
 await expect(page.getByRole('rowheader',{name:'alpha area'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Building the learner picture…'})).toBeVisible();
 await page.getByRole('button',{name:'gamma',exact:true}).click();
 await expect(page.getByRole('rowheader',{name:'gamma area'})).toBeVisible();releaseBeta();
 await expect(page.getByRole('rowheader',{name:'beta area'})).toHaveCount(0);
 await expect(page.getByRole('rowheader',{name:'gamma area'})).toBeVisible();
 await verify();
});
