import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{ await page.route('**/api/facilitator-development?**',r=>r.fulfill({json:{profile:{areas:[]},developmentEvidence:{areas:[],boundary:'Permitted structural evidence only'}}})); });
const cohort={id:'group',name:'Leap9 reporting fixture',labCode:'SYS',labVersion:'1',status:'ACTIVE',startsOn:null,endsOn:null,memberIds:['learner']};
const outcome={cohort,participantCount:20,minimumReportableCohortSize:5,suppressed:false,metrics:null,evidenceFlow:{runtimeMode:'DYNAMIC',suppressed:false,minimumReportableCohortSize:5,minimumReportableCellSize:3,participantCount:20,totals:{recordedResponses:24,anchoredMeasures:9,startedExperiment:3,completed:null},stages:[{investigation:7,participants:3,responses:24,suppressed:false},{investigation:8,participants:null,responses:null,suppressed:true}]},learningSummary:{suppressed:false,learningJourney:{days:[{day:1,reached:20,completed:18},{day:2,reached:18,completed:16}],baselineThemes:[],skillShifts:[],activity:{participantsWithHandbookActivity:20,participantsWithStructuredResponses:18,structuredResponsesRecorded:24}}},organisationLearning:null,learningChecks:null,questionPatterns:null,deepAnalysis:null,assessmentSummary:{participants:20,suppressed:false,rubrics:[{rubric_id:'rubric',title:'Systems Transfer Test',sample:3,average_total:4,maximum_total:5}]}};
const learner={userId:'learner',cohortId:'group',displayName:'Thandi Mokoena',email:'learner@local.invalid',enrolment:{id:'enrolment',status:'ACTIVE',currentInvestigation:7,labVersion:'1',experimentStartedAt:null},experiment:null};
const base={identity:{id:'staff',email:'staff@local.invalid',displayName:'Staff'},roles:['FACILITATOR','PROGRAMME_OWNER'],admin:null,facilitator:{cohorts:[cohort],learners:[learner],notes:[],referrals:[]},sponsor:{cohorts:[outcome]},safeguarding:null};
test('an authorised initial report renders without a second load and hides results when refresh loses access',async({page})=>{
 let requests=0;
 await page.route('**/api/staff',route=>{requests++;return route.fulfill({status:403,json:{error:'Scope withdrawn'}});});
 await page.goto('/preloaded-operations');
 await expect(page.getByRole('heading',{name:'Results',exact:true})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Group',exact:true})).toContainText('Already-authorised group');
 expect(requests).toBe(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('heading',{name:'Operations could not open.'})).toBeVisible();
 await expect(page.locator('.programme-outcomes')).toHaveCount(0);
 expect(requests).toBe(1);
});
function observe(page:import('@playwright/test').Page){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});return async()=>{expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);};}
test('programme report explains findings, preserves unavailable values and has accessible chart data',async({page},info)=>{
 const verify=observe(page);await page.route('**/api/staff',r=>r.fulfill({json:base}));await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 await page.getByText('How we reached these conclusions · full evidence report',{exact:true}).click();
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

test('privacy-limited reports explain eligibility visibly without exposing results', async ({ page }) => {
 const verify = observe(page);
 await page.route('**/api/staff', r => r.fulfill({ json: { ...base, sponsor: { cohorts: [{ ...outcome, participantCount: 2, suppressed: true }] } } }));
 await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 const summary = page.getByText('Group results are not available yet', { exact: true });
 await expect(summary).toBeVisible();
 await expect(page.getByRole('region',{name:'Reporting population'}).getByText(/2 learners have current programme consent/)).toBeVisible();
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
 await page.getByText('How we reached these conclusions · full evidence report',{exact:true}).click();
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
 await page.getByText('How we reached these conclusions · full evidence report',{exact:true}).click();
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

test('paired comparisons show cohort coverage and keep small remainders withheld in every section', async ({page})=>{
 const verify=observe(page);let pairedParticipants=10;
 await page.route('**/api/staff',route=>route.fulfill({json:{...base,sponsor:{cohorts:[{...outcome,learningSummary:{...outcome.learningSummary,learningJourney:{...outcome.learningSummary.learningJourney,skillShifts:[{id:'control',label:'Perceived control',pairedParticipants,averagePre:pairedParticipants===19?123456:4,averagePost:pairedParticipants===19?234567:6,averageShift:2}]}}}]}}}));
 await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 await page.getByText('How we reached these conclusions · full evidence report',{exact:true}).click();
 const coverage=page.getByRole('table',{name:'Comparable check-ins within this programme group'});
 await expect(coverage.getByRole('row',{name:'Perceived control 10 10 20 Comparable self-report'})).toBeVisible();
 pairedParticipants=19;await page.reload();await page.getByText('How we reached these conclusions · full evidence report',{exact:true}).click();
 await expect(coverage.getByRole('row',{name:'Perceived control Unavailable Unavailable 20 Withheld for privacy'})).toBeVisible();
 await expect(page.getByRole('img',{name:/Perceived control: starting point/})).toHaveCount(0);
 await expect(page.getByText(/123456|234567/)).toHaveCount(0);
 await page.goto('/staff-shell?view=outcomes&section=learning&group=group');
 await expect(page.getByRole('button',{name:'View comparisons',exact:true})).toBeVisible();
 await expect(page.getByText(/123456|234567/)).toHaveCount(0);
 await page.getByRole('button',{name:'View comparisons',exact:true}).click();
 await expect(coverage).toBeVisible();await verify();
});

test('reviewed task coverage appears once, preserves its denominator and supports keyboard chart inspection',async({page})=>{
 const verify=observe(page);
 const reviewedDevelopment={status:'AVAILABLE',cohortId:'group',participantCount:20,evidenceBasis:'HUMAN_REVIEWED_TASK_COVERAGE',boundary:'Human review confirms shared work was reviewed; it does not establish acquired skill or transfer.',competencies:[{competencyId:'AC-C04',title:'Self-management',reviewedParticipants:6,denominator:20,achievementStatus:'NOT_ASSESSED'}]};
 await page.route('**/api/staff',r=>r.fulfill({json:{...base,sponsor:{cohorts:[{...outcome,reviewedDevelopment}]}}}));
 await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 await page.getByText('How we reached these conclusions · full evidence report',{exact:true}).click();
 await expect(page.getByRole('heading',{name:'Self-management: shared work reviewed',exact:true})).toHaveCount(1);
 await expect(page.getByText('6 of 20 participants have current human-reviewed work in this development area.',{exact:true})).toBeVisible();
 const graphic=page.locator('figure').filter({has:page.getByRole('heading',{name:'Self-management: reviewed task coverage',exact:true})});
 await graphic.getByText('View chart values and comparison basis').focus();await page.keyboard.press('Enter');
 await expect(graphic.getByRole('row',{name:'Participants with reviewed work 6 20 participants'})).toBeVisible();
 await page.getByRole('heading',{name:'Self-management: shared work reviewed',exact:true}).locator('..').getByText('What supports this finding?').click();
 await expect(page.getByText(reviewedDevelopment.boundary,{exact:true})).toBeVisible();
 await verify();
});

test('reviewed learner evidence clears on switching and late responses cannot restore the previous learner',async({page})=>{
 const verify=observe(page);
 let releaseBeta:()=>void=()=>{};const betaGate=new Promise<void>(resolve=>{releaseBeta=resolve;});
 await page.route('**/api/facilitator-development?**',async route=>{
  const id=new URL(route.request().url()).searchParams.get('learnerId')!;if(id==='beta')await betaGate;
  const reviewedEvidence={status:'AVAILABLE',boundary:'Review does not establish a stage.',areas:[{competencyId:'AC-C04',title:`Reviewed ${id}`,reviewedRecords:2,firstEvidenceAt:'2026-10-01T00:00:00Z',latestEvidenceAt:'2026-10-02T00:00:00Z',nextStep:'Agree the next authored practice.'}]};
  await route.fulfill({json:{profile:{areas:[]},developmentEvidence:{areas:[],boundary:'Structural evidence only.'},reviewedEvidence}}).catch(()=>{});
 });
 await page.goto('/development-switch');await expect(page.getByRole('heading',{name:'Reviewed alpha',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'beta',exact:true}).click();await expect(page.getByRole('heading',{name:'Reviewed alpha',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'gamma',exact:true}).click();await expect(page.getByRole('heading',{name:'Reviewed gamma',exact:true})).toBeVisible();releaseBeta();
 await expect(page.getByRole('heading',{name:'Reviewed beta',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Reviewed gamma',exact:true})).toBeVisible();await verify();
});

test('actual facilitator participant workflow shows development bars and selectable dated charts from permitted reviews',async({page},info)=>{
 const verify=observe(page);
 const {buildDevelopmentIntelligence}=await import('../../lib/development-intelligence.mjs');
 const {buildDevelopmentScenario,scenarioDefinitions}=await import('../../lib/experience/development-scenario.mjs');
 const example=buildDevelopmentScenario();let unavailable=false;
 await page.route('**/api/staff',route=>route.fulfill({json:base}));
 await page.route('**/api/development-intelligence?**',route=>{
  const url=new URL(route.request().url());
  expect(url.searchParams.get('cohortId')).toBe('group');expect(url.searchParams.get('learnerId')).toBe('learner');
  return route.fulfill({json:buildDevelopmentIntelligence(unavailable?[]:example.learners[9].facts,scenarioDefinitions,'facilitator')});
 });
 await page.goto('/staff-shell?view=facilitator&section=participants&group=group&learner=learner');
 await expect(page.getByRole('heading',{name:'Where to support Thandi Mokoena next'})).toBeVisible();
 const profile=page.locator('.development-fingerprint');await expect(profile).toBeVisible();await expect(profile.locator('.development-fingerprint-row')).toHaveCount(5);
 const history=page.getByRole('region',{name:'Development over time'});await expect(history.getByRole('img',{name:/Behaviour change and self-management: Reviewed capability over time/})).toBeVisible();
 await page.getByLabel('Capability over time',{exact:true}).selectOption('AC-C06');
 await expect(history.getByRole('img',{name:/Decision and judgement: Reviewed capability over time/})).toBeVisible();
 await history.getByText('View dated trajectory values',{exact:true}).focus();await page.keyboard.press('Enter');await expect(history.getByRole('cell',{name:'2026-10-11',exact:true})).toBeVisible();
 await page.reload();await expect(profile).toBeVisible();await profile.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('actual-facilitator-bars.png')});
 unavailable=true;await page.getByRole('button',{name:'Refresh development profile',exact:true}).click();
 await expect(profile).toHaveCount(0);await expect(history).toHaveCount(0);await expect(page.getByText('Development outcomes will appear after learner-shared work has been assessed against approved criteria.',{exact:true})).toBeVisible();
 await verify();
});

test('actual programme outcomes show capability bars, change distribution and authorised group heatmap',async({page},info)=>{
 const verify=observe(page);
 const {completeDevelopmentOutcome}=await import('./harness/development-complete-fixture');
 const outcomes=['Grade 8','Grade 9'].map((name,index)=>({...completeDevelopmentOutcome,cohort:{...completeDevelopmentOutcome.cohort,id:index?'grade9':'group',name},developmentIntelligence:{...completeDevelopmentOutcome.developmentIntelligence!,cohortId:index?'grade9':'group'}}));
 await page.route('**/api/staff',route=>route.fulfill({json:{...base,sponsor:{cohorts:outcomes}}}));
 await page.goto('/staff-shell?view=outcomes&section=overview&group=group');
 const story=page.locator('.development-report-story');await expect(story).toBeVisible();
 await expect(story.getByRole('meter',{name:'Can explain it: first review',exact:true})).toHaveAttribute('value','13');
 await expect(story.getByRole('meter',{name:'Can explain it: latest',exact:true})).toHaveAttribute('value','3');
 await expect(story.getByRole('meter',{name:'Higher later result',exact:true})).toHaveAttribute('value','6');
 const heatmap=story.getByRole('table',{name:'Most frequent reviewed stage among learners with reviewed evidence, per capability and group'});
 await expect(heatmap.getByRole('columnheader',{name:'Grade 8',exact:true})).toBeVisible();await expect(heatmap.getByRole('columnheader',{name:'Grade 9',exact:true})).toBeVisible();
 await expect(heatmap.getByRole('cell',{name:'Tests and improves the approach (6 / 20)',exact:true})).toHaveCount(2);
 await page.getByLabel('Group',{exact:true}).selectOption('grade9');await expect(story.getByText(/Grade 9 · 20 participating learners/)).toBeVisible();
 await story.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('actual-outcomes-bars.png')});
 await verify();
});

test('live-shaped group with 21 members and one eligible learner explains readiness and links to review',async({page},info)=>{
 const verify=observe(page);
 const members=Array.from({length:21},(_,i)=>({...learner,userId:`learner-${i}`,displayName:`Example learner ${i+1}`}));
 const restricted={...cohort,labCode:'HAB',labVersion:'4.5.2',memberIds:members.map(l=>l.userId),competencySummary:{status:'SUPPRESSED',participantCount:1,competencies:[],boundary:'Small groups hidden.'},assessmentReadiness:{learnerReport:false,practicalUse:false,transfer:false}};
 await page.route('**/api/staff',r=>r.fulfill({json:{...base,facilitator:{...base.facilitator,cohorts:[restricted],learners:members},sponsor:{cohorts:[{...outcome,cohort:restricted,participantCount:1,suppressed:true,competencySummary:null,developmentIntelligence:null}]}}}));
 await page.route('**/api/class-operations?**',r=>r.fulfill({json:{sessions:[],attendance:[]}}));
 await page.goto('/staff-shell?view=facilitator&section=cohort&group=group');
 await expect(page.getByText('21 learners on the group list',{exact:false})).toBeVisible();
 await expect(page.getByText(/21 learners are on the group list. 1 learner has current programme consent/)).toBeVisible();
 const next=page.getByRole('region',{name:'Prepare development reporting'});
 await expect(next.getByText(/approve assessment criteria for this group’s Lab edition/)).toBeVisible();
 await expect(next.getByRole('link',{name:'Open shared evidence review →'})).toHaveAttribute('href','/workspace?view=facilitator&section=review&group=group');
 await expect(next.getByRole('link',{name:'See a completed fictional learner report →'})).toHaveAttribute('href','/experience/development-system?scenario=habit-decision&audience=facilitator');
 await next.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('live-shaped-group-readiness.png')});
 await next.getByRole('link',{name:'See a completed fictional learner report →'}).click();
 await expect(page.getByRole('heading',{name:'Development strengths and next support',exact:true})).toBeVisible();
 await expect(page.locator('.development-fingerprint')).toBeVisible();
 await page.goBack();await expect(page.getByText(/21 learners are on the group list. 1 learner has current programme consent/)).toBeVisible();
 for(const section of ['overview','learning','evidence']){
  await page.goto(`/staff-shell?view=outcomes&section=${section}&group=group`);
  await expect(page.getByRole('region',{name:'Reporting population'}).getByText(/1 learner has current programme consent/)).toBeVisible();
  await expect(page.getByRole('link',{name:'See a completed fictional programme report →'})).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(0);
 }
 await page.getByRole('link',{name:'See a completed fictional programme report →'}).click();
 await expect(page.getByRole('table',{name:'Most frequent reviewed stage among learners with reviewed evidence, per capability and group'})).toBeVisible();
 await page.goBack();await expect(page.getByRole('region',{name:'Reporting population'}).getByText(/1 learner has current programme consent/)).toBeVisible();
 await verify();
});

test('learner missing consent receives an actionable boundary without loading a development report',async({page})=>{
 const verify=observe(page);let developmentRequests=0;
 await page.route('**/api/staff',r=>r.fulfill({json:base}));
 await page.route('**/api/facilitator-development?**',r=>r.fulfill({json:{status:'CONSENT_REQUIRED',profile:{areas:[]},developmentEvidence:{areas:[]},assessmentReadiness:{learnerReport:false,practicalUse:false,transfer:false}}}));
 await page.route('**/api/development-intelligence?**',r=>{developmentRequests++;return r.fulfill({status:403,json:{error:'Consent required'}});});
 await page.goto('/staff-shell?view=facilitator&section=participants&group=group&learner=learner');
 await expect(page.getByRole('heading',{name:'Programme consent is needed first'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Prepare development reporting'})).toBeVisible();
 await expect(page.locator('.development-fingerprint')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Refresh development profile'})).toHaveCount(0);
 expect(developmentRequests).toBe(0);await verify();
});
