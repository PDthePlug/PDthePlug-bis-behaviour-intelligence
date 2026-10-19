import { test, expect } from '@playwright/test';

test('the facilitator can continue from the matching rubric to checked practical evidence',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const stamp='2026-10-19T09:00:00Z';
 const submission={id:'practice-submission',user_id:'learner',cohort_id:'group',title:'Shared practical work',display_name:'Fictional learner',created_at:stamp,current:true,revoked_at:null,evidence:[{id:'work',lab_code:'HAB',lab_version:'1',semantic_field_id:'HAB.PRACTICE',source_object_type:'PRACTICE_ATTEMPT',value:'A checkable fictional work trace',occurred_at:stamp}],reviews:[] as Record<string,unknown>[]};
 const rubric={id:'practical-rubric',lab_code:'HAB',lab_version:'1',title:'Use the investigation method',source_reference:'Fictional source criteria',semantic_field_ids:['HAB.PRACTICE'],criteria:[{id:'applies',label:'Uses the method in the checked work'}],scale_min:0,scale_max:1,authored_total:false};
 await page.route('**/api/evidence-engine**',async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();submission.reviews=[{id:'practical-review',rubric_version_id:rubric.id,disposition:'REVIEWED',feedback:body.feedback,criterion_scores:body.scores,created_at:stamp,supersedes_id:null}];
   return route.fulfill({json:{saved:true}});
  }
  return route.fulfill({json:{groups:[],rubrics:[rubric],submissions:[submission]}});
 });
 await page.route('**/api/development-intelligence**',r=>r.fulfill({json:{contracts:[],coverage:[]}}));
 await page.route('**/api/development-practice**',r=>r.fulfill({json:r.request().method()==='GET'?{title:rubric.title,instruction:'Check the work against its criteria',stage:'APPLY',context:'SCHOOL',basis:'REAL_WORLD',opportunity:true}:{ok:true,result:'checked-review'}}));
 await page.goto('/practical-evidence-facilitator');
 await page.getByLabel('Assessment approach').selectOption(rubric.id);
 await page.getByRole('combobox',{name:'Rating',exact:true}).selectOption('1');
 await page.getByLabel('Evidence for this rating').fill('Checked the method in this work trace.');
 await page.getByLabel('Feedback for the learner').fill('The work shows the method in this situation.');
 await page.getByRole('checkbox',{name:/I have checked/}).check();
 await page.getByRole('button',{name:'Save review',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Queue',exact:true})).toHaveValue('all');
 await expect(page.getByLabel('Evidence checked and limits')).toBeVisible();
 await page.getByLabel('Evidence checked and limits').fill('Observed the action; this check is limited to this task.');
 await page.getByRole('checkbox',{name:/Each required rubric criterion/}).check();
 await page.getByRole('button',{name:'Save checked practical stage'}).click();
 await expect(page.getByText('Checked practical evidence saved.',{exact:false})).toBeVisible();
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('dated practice, explicit sharing, refresh and checked human review keep evidence boundaries visible', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const task = { id: 'apply-task', cohortId: 'group', cohortName: 'Fictional practice group', labCode: 'HAB', labVersion: '4.5.2', stage: 'APPLY', title: 'Use the investigation method', instruction: 'Use a suitable opportunity and show the checked work.' };
  const plans: Array<Record<string, unknown>> = [];
  const writes: Array<Record<string, unknown>> = [];
  let submitFails = true;
  await page.route('**/api/development-practice**', async route => {
    const r = route.request();
    if (r.method() === 'GET') return route.fulfill({ json: new URL(r.url()).searchParams.has('submissionId') ? { stage: 'APPLY', context: 'SCHOOL', basis: 'REAL_WORLD', opportunity: true, instruction: task.instruction, title: task.title } : { tasks: [task], plans } });
    const body = r.postDataJSON(); writes.push(body);
    if (body.action === 'plan') { plans.push({ id: 'saved-plan', taskId: task.id, cohortId: 'group', context: body.context, basis: body.basis, prediction: body.prediction, createdAt: '2026-10-19T09:00:00Z', submitted: false }); return route.fulfill({ json: { ok: true, result: { id: 'saved-plan' } } }); }
    if (body.action === 'submit' && submitFails) { submitFails = false; return route.fulfill({ status: 409, json: { error: 'Retry after checking the connection. No work was shared.' } }); }
    if (body.action === 'submit') plans[0].submitted = true;
    return route.fulfill({ json: { ok: true, result: body.action === 'submit' ? { submissionId: 'practice-submission' } : 'checked-review' } });
  });
  await page.goto('/practical-evidence');
  await expect(page.getByRole('heading', { name: 'Show the method in practice' })).toBeVisible();
  await page.getByLabel('Prediction or test plan').fill('Try the authored method; inspect the resulting work.');
  await page.getByRole('button', { name: 'Save dated plan' }).click();
  await expect(page.getByLabel('Work or observation record')).toBeVisible();
  expect(writes[0]).toMatchObject({ action: 'plan', taskId: 'apply-task', cohortId: 'group', basis: 'REAL_WORLD' });
  await page.reload();
  await page.getByLabel('Continue a saved practice plan').selectOption('saved-plan');
  await expect(page.getByText('Try the authored method; inspect the resulting work.', { exact: true })).toBeVisible();
  await page.getByLabel('Did a suitable opportunity occur?').selectOption('no');
  await expect(page.getByText('No opportunity is valid evidence.', { exact: false })).toBeVisible();
  await page.getByLabel('Did a suitable opportunity occur?').selectOption('yes');
  await page.getByLabel('Work or observation record').fill('An observable fictional performance trace.');
  await page.getByLabel('Comparison, adjustment and limits').fill('The evidence supports this task only.');
  const shareButton = page.getByRole('button', { name: 'Share selected work for review' });
  await expect(shareButton).toBeDisabled();
  await page.getByRole('checkbox', { name: /I choose to share this plan/ }).check();
  await shareButton.click();
  await expect(page.getByRole('alert')).toContainText('No work was shared.');
  await expect(page.getByLabel('Work or observation record')).toHaveValue('An observable fictional performance trace.');
  await shareButton.click();
  await expect(page.getByText('This work has been shared for review.', { exact: false })).toBeVisible();
  expect(writes.filter(x => x.action === 'submit').at(-1)).toMatchObject({ opportunity: true, share: true, planId: 'saved-plan' });
  expect(writes.some(x => x.action === 'permission')).toBe(false);
  const reviewButton = page.getByRole('button', { name: 'Save checked practical stage' });
  await expect(reviewButton).toBeDisabled();
  await page.getByLabel('How did you check the action or work?').selectOption('CHECKED_ARTEFACT');
  await page.getByLabel('Evidence checked and limits').fill('Inspected the fictional trace against the source criteria.');
  await page.getByRole('checkbox', { name: /supports independent use/ }).check();
  await page.getByRole('checkbox', { name: /Each required rubric criterion/ }).check();
  await reviewButton.click();
  await expect(page.getByText('Checked practical evidence saved.', { exact: false })).toBeVisible();
  expect(writes.at(-1)).toMatchObject({ action: 'review', assessmentId: 'practice-assessment', basis: 'CHECKED_ARTEFACT', independent: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('missing access, failed loads, simulations and absent opportunities do not become independent outcomes', async ({ page }) => {
  let failures = true;
  await page.route('**/api/development-practice**', async route => {
    if (failures) return route.fulfill({ status: 403, json: { error: 'Unavailable' } });
    return route.fulfill({ json: new URL(route.request().url()).searchParams.has('submissionId') ? { stage: 'APPLY', context: 'SCHOOL', basis: 'SIMULATION', opportunity: false, instruction: 'Fictional example', title: 'Simulation' } : { tasks: [], plans: [] } });
  });
  await page.goto('/practical-evidence');
  await expect(page.getByRole('button', { name: 'Retry practical evidence' })).toBeVisible();
  failures = false;
  await page.getByRole('button', { name: 'Retry practical evidence' }).click();
  await page.getByRole('button', { name: 'Retry task requirements' }).click();
  await expect(page.getByText('No practical tasks are available', { exact: false })).toBeVisible();
  await expect(page.getByText('No suitable opportunity was recorded.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save checked practical stage' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
