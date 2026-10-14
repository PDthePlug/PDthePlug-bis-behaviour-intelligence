import { expect, test } from '@playwright/test';

test.describe('Leap9 programme experience v2', () => {
  test('keeps guidance collapsible and the full development-intelligence journey usable', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/experience/')) errors.push(String(response.status()) + ' ' + response.url());
    });

    await page.goto('/experience/leap9/v2');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('See development become evidence.');
    await expect(page.getByText('Development Intelligence Experience', { exact: true })).toBeVisible();
    expect(await page.locator('.experience-v2-hero-panel>div').first().evaluate(element => parseFloat(getComputedStyle(element).paddingLeft))).toBeGreaterThanOrEqual(22);
    const welcomeHeading = page.locator('.experience-v2-hero-panel h2');
    expect(await welcomeHeading.evaluate(element => element.getBoundingClientRect().left - element.parentElement!.getBoundingClientRect().left)).toBeGreaterThanOrEqual(22);
    const notice = page.locator('.experience-v2-disclosure');
    await expect(notice).not.toHaveAttribute('open', '');
    await expect(page.getByText('My Development Portfolio', { exact: true })).toBeVisible();
    await expect(page.getByText('Learner Development Intelligence', { exact: true })).toBeVisible();
    await expect(page.getByText('Cohort Development Report', { exact: true })).toBeVisible();
    await expect(page.getByText('Programme Outcomes & Impact Report', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Follow one participant' }).click();
    await expect(page).toHaveURL(/#participant$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Participant journey');
    await expect(notice).not.toHaveAttribute('open', '');

    await page.getByLabel('How much control does Naledi report').selectOption('3');
    await page.getByLabel('What tends to start the pattern?').fill('After a difficult commute');
    await page.getByLabel('What smaller response will Naledi try instead?').fill('Complete one field first');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page).toHaveURL(/#practice$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practice & evidence');
    await page.getByLabel('There was no opportunity', { exact: true }).check();
    await page.getByLabel('What does Naledi think the experiment revealed?').fill('PRIVATE_LEAP9_PRACTICE_REFLECTION');
    await page.getByLabel('Share this practice evidence with facilitator', { exact: false }).check();
    await page.getByLabel('Ask for human support', { exact: false }).check();
    await page.getByRole('button', { name: 'See how evidence is governed' }).click();

    await expect(page).toHaveURL(/#review$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Human review');
    await expect(page.getByText('A response is not automatically a capability.', { exact: true })).toBeVisible();
    await expect(page.getByText('PRIVATE_LEAP9_PRACTICE_REFLECTION', { exact: true })).toBeVisible();
    await page.getByLabel('Facilitator review note').fill('Shared evidence supports a follow-up about the smaller first action.');
    await page.getByRole('button', { name: 'Record illustrative review', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Illustrative review recorded', exact: true })).toBeDisabled();

    await page.getByRole('button', { name: 'Open the development portfolio' }).click();
    await expect(page).toHaveURL(/#portfolio$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Development portfolio');
    await expect(page.getByText('My Development Portfolio · fixed fictional example', { exact: true })).toBeVisible();
    await expect(page.getByText('Repeated independent application', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page).toHaveURL(/#facilitator$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Facilitator intelligence');
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Support without surveillance.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Acknowledge support request', exact: true }).click();

    await page.getByRole('button', { name: 'See the cohort picture' }).click();
    await expect(page).toHaveURL(/#cohort$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cohort development');
    await expect(page.getByText('Where should the programme focus support?', { exact: true })).toBeVisible();
    await expect(page.getByText('Without comparable reviewed history:', { exact: false }).first()).toBeVisible();

    await page.getByRole('button', { name: 'See partner outcomes' }).click();
    await expect(page).toHaveURL(/#outcomes$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Programme outcomes');
    await expect(page.getByText('What development is evidenced — and what should happen next?', { exact: true })).toBeVisible();
    await expect(page.getByText('AI attainment decisions', { exact: true })).toBeVisible();
    await expect(page.getByText('Global learner maturity score', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download Habit evidence sample' })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('leap9-v2-' + testInfo.project.name + '.png'), fullPage: true });
    expect(errors).toEqual([]);
  });

  test('browser history returns to the previous development-intelligence stage', async ({ page }) => {
    await page.goto('/experience/leap9/v2');
    await page.getByRole('button', { name: 'Follow one participant' }).click();
    await expect(page).toHaveURL(/#participant$/);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page).toHaveURL(/#practice$/);
    await page.goBack();
    await expect(page).toHaveURL(/#participant$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Participant journey');
  });
});