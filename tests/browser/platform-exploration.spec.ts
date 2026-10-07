import { expect, test, type Page } from '@playwright/test';
test.use({ actionTimeout: 15000 });
async function layout(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); }
function observe(page: Page) { const errors: string[] = [], calls: string[] = [];page.on('pageerror', e => errors.push(e.message));page.on('console', e => {if(e.type()==='error')errors.push(e.text());});page.on('request', r => { if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url()); });return ()=>{expect(errors).toEqual([]);expect(calls).toEqual([]);}; }
async function baseline(page:Page){ await expect(page.getByRole('heading',{name:'Your current behaviours'})).toBeVisible();for(const control of await page.getByRole('combobox').all()){if(await control.getAttribute('id')==='explore-role')continue;await control.click();await page.getByRole('option',{name:'Sometimes',exact:true}).click();}await page.getByRole('button',{name:'5',exact:true}).click();await page.getByRole('button',{name:'Enter Habit Lab™'}).click();}
async function passAll(page:Page){await page.getByRole('checkbox',{name:/Prefer not to answer/}).first().waitFor();for(const checkbox of await page.getByRole('checkbox',{name:/Prefer not to answer/}).all())if(!await checkbox.isChecked())await checkbox.check();}
test('sign-in opens a keyboard accessible role explorer and actual learning saves after refresh', async ({page},info)=>{
 const verify=observe(page);
 await page.goto('/sign-in');const link=page.getByRole('link',{name:'Explore BIS without an account'});
 await link.focus();
 await page.keyboard.press('Enter');
 await expect(page).toHaveURL('/explore');
 await layout(page);
 await page.getByRole('button',{name:/Learner Try a Habit Lab/}).click();
 await expect(page.getByRole('heading',{name:'Habit Lab™',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Learning',exact:true}).click();const map=page.locator('.prototype-programme-map');
 await expect(map).toBeVisible();
 await map.locator('summary').click();
 await map.getByRole('button',{name:/Day 1 Concept Studio/}).click();
 await expect(page).toHaveURL(/page=2/);const response=page.locator('.prototype-document textarea').first();
 await response.fill('I complete one fictional application field before reaching for my phone.');
 await expect(page.locator('.learner-document-status')).toHaveText('Your saved responses are up to date');
 await page.reload();
 await expect(response).toHaveValue('I complete one fictional application field before reaching for my phone.');
 await layout(page);
 await page.screenshot({path:info.outputPath('learning.png'),fullPage:true});verify();
});
test('actual Lab and portfolio keep responses private until shared and support facilitator review', async ({page},info)=>{
 test.setTimeout(180000);const verify=observe(page);
 await page.goto('/explore?role=learner&screen=lab');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Open Habit Lab'}).click();await baseline(page);
 await expect(page.locator('.universal-package-lab')).toBeVisible();
 await passAll(page);const field=page.locator('[data-prompt-id]').filter({has:page.locator('textarea')}).first();
 await field.getByRole('checkbox').uncheck();
 await field.locator('textarea').fill('PRIVATE_EXAMPLE_RESPONSE');
 await page.getByRole('button',{name:'Save and continue',exact:true}).click();
 await expect(page).toHaveURL(/step=2/);
 await layout(page);
 await page.getByLabel('Choose your view').selectOption('facilitator');
 await page.getByRole('button',{name:'Review',exact:true}).click();
 await expect(page.getByText('PRIVATE_EXAMPLE_RESPONSE',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'No shared evidence awaiting review'})).toBeVisible();
 await page.getByLabel('Choose your view').selectOption('learner');
 await page.getByRole('button',{name:'Evidence Portfolio',exact:true}).click();
 await page.locator('.portfolio-lab-group>summary').click();
 await page.locator('.portfolio-responses>summary').click();
 await expect(page.getByText('PRIVATE_EXAMPLE_RESPONSE',{exact:true})).toBeVisible();
 await page.locator('.evidence-entry').filter({hasText:'PRIVATE_EXAMPLE_RESPONSE'}).getByRole('checkbox',{name:/Select evidence:/}).check();
 await page.getByLabel('Submission title').fill('Example habit reflection');
 await page.getByRole('checkbox',{name:/I choose to share/}).check();
 await page.getByRole('button',{name:'Share selected evidence',exact:true}).click();
 await page.getByLabel('Choose your view').selectOption('facilitator');
 await page.getByRole('button',{name:'Review',exact:true}).click();
 await expect(page.getByText('PRIVATE_EXAMPLE_RESPONSE',{exact:true})).toBeVisible();
 await page.getByLabel('Feedback for the learner').fill('Use this observation to agree the next small experiment.');
 await page.getByRole('checkbox',{name:/I have checked/}).check();
 await page.getByRole('button',{name:'Save review',exact:true}).click();
 await page.getByRole('combobox',{name:'Queue',exact:true}).selectOption('all');
 await expect(page.getByText('Use this observation to agree the next small experiment.',{exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('combobox',{name:'Queue',exact:true}).selectOption('all');
 await expect(page.getByText('Use this observation to agree the next small experiment.',{exact:true})).toBeVisible();
 await layout(page);
 await page.screenshot({path:info.outputPath('shared-review.png'),fullPage:true});verify();
});
test('facilitator records a class and programme owner can save and review a decision',async({page},info)=>{
 const verify=observe(page);
 await page.goto('/explore?role=facilitator&section=cohort');
 await page.getByText('Class sessions and attendance',{exact:true}).click();
 await page.getByLabel('Programme day').selectOption('3');
 await expect(page.getByText(/separate 90-minute Phase A/)).toBeVisible();
 await page.getByLabel('Session state').selectOption('HELD');
 await page.getByLabel('Preparation and follow-up').fill('Prepare the Habit Lab handover.');
 await page.getByRole('button',{name:'Save class session'}).click();
 await expect(page.getByText('Class record saved.',{exact:true})).toBeVisible();
 await page.getByLabel('Attendance for Naledi Mokoena').selectOption('PRESENT');
 await page.reload();
 await page.getByText('Class sessions and attendance',{exact:true}).click();
 await page.getByText('Saved class sessions (1)',{exact:true}).click();
 await page.getByRole('button',{name:/Day 3 · held/}).click();
 await expect(page.getByLabel('Attendance for Naledi Mokoena')).toHaveValue('PRESENT');
 await layout(page);
 await page.getByLabel('Choose your view').selectOption('owner');
 await expect(page.getByText('Naledi Mokoena',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Decisions',exact:true}).click();
 await page.getByLabel('What did your team decide?', {exact:true}).fill('Offer a check-in before the next practical task.');
 await page.getByLabel('What do we expect to observe next?', {exact:true}).fill('More participants record a relevant opportunity.');
 await page.getByLabel('Result or pattern',{exact:true}).fill('Five participants asked for support.');await page.getByLabel('What we saw',{exact:true}).fill('Five of twenty fictional participants requested a check-in.');
 await page.getByRole('button',{name:'Record decision',exact:true}).click();
 await expect(page.getByText('Offer a check-in before the next practical task.',{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByText('Offer a check-in before the next practical task.',{exact:true})).toBeVisible();
 await layout(page);
 await page.screenshot({path:info.outputPath('programme-decisions.png'),fullPage:true});
 await page.getByRole('button',{name:'Restart example',exact:true}).click();
 await page.getByRole('button',{name:'Clear and restart'}).click();
 await page.getByRole('button',{name:'Decisions',exact:true}).click();
 await expect(page.getByText('Offer a check-in before the next practical task.',{exact:true})).toHaveCount(0);verify();
});
test('wide desktops show complete role navigation and direct DGMT actions without jargon',async({page},info)=>{
 test.skip(info.project.name!=='desktop');for(const width of [1440,1920]){await page.setViewportSize({width,height:1080});
 await page.goto('/experience/dgmt');const action=page.getByRole('link',{name:'Choose a role and explore'});expect((await action.boundingBox())!.y).toBeLessThan(900);
 await action.click();for(const role of ['learner','facilitator','owner']){await page.goto(`/explore?role=${role}`);
 await expect(page.getByLabel('Choose your view')).toBeVisible();
 await expect(page.locator('.explore-workspace')).not.toContainText(/compiled|Supabase|Postgres|runtime version|Published version|source artifact|production deployment|architecture/);
 await layout(page);
 await page.screenshot({path:info.outputPath(`${role}-${width}.png`),fullPage:true});}}});

test('the complete nine-stage Lab works across example days without authenticated requests',async({page})=>{
 test.setTimeout(180000);const verify=observe(page);
 await page.goto('/explore?role=learner&screen=lab');
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Open Habit Lab'}).click();
 await baseline(page);
 await expect(page.locator('.universal-package-lab')).toBeVisible();
 for(let stage=1;stage<=6;stage++){
  await passAll(page);await page.getByRole('button',{name:'Save and continue',exact:true}).click();await expect(page).toHaveURL(new RegExp(`step=${stage+1}`));await layout(page);
 }
 for(let day=1;day<=7;day++){
  await passAll(page);await page.getByRole('button',{name:'Save today’s evidence',exact:true}).click();await page.getByRole('button',{name:'Try the next example day'}).click();
 }
 await page.getByRole('button',{name:'Continue to evidence review',exact:true}).click();await expect(page).toHaveURL(/step=8/);
 await page.reload();await expect(page.locator('.universal-package-lab')).toBeVisible();
 await passAll(page);await page.getByRole('button',{name:'Save and continue',exact:true}).click();await expect(page).toHaveURL(/step=9/);
 await passAll(page);await page.getByRole('button',{name:'Complete Lab',exact:true}).click();await expect(page.getByText('Naledi, your nine-investigation evidence trail is complete.')).toBeVisible();await page.reload();await expect(page.getByText('Naledi, your nine-investigation evidence trail is complete.')).toBeVisible();await layout(page);verify();
});
