import { expect, test } from '@playwright/test';

test.describe('Leap9 programme experience v2', () => {
  test('keeps guidance collapsible and the full responsive journey usable', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/experience/')) errors.push(String(response.status()) + ' ' + response.url());
    });

    await page.goto('/experience/leap9/v2');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('See the programme move.');
    expect(await page.locator('.experience-v2-hero-panel>div').first().evaluate(element => parseFloat(getComputedStyle(element).paddingLeft))).toBeGreaterThanOrEqual(22);
    const welcomeHeading = page.locator('.experience-v2-hero-panel h2');
    expect(await welcomeHeading.evaluate(element => element.getBoundingClientRect().left - element.parentElement!.getBoundingClientRect().left)).toBeGreaterThanOrEqual(22);
    const notice = page.locator('.experience-v2-disclosure');
    await expect(notice).not.toHaveAttribute('open', '');
    await expect(page.locator('.experience-v2-perspectives, .experience-v2-arc')).toHaveCount(0);

    await page.getByRole('button', { name: 'Begin with Naledi' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Participant journey');
    await expect(notice).not.toHaveAttribute('open', '');

    await page.getByLabel('How much control does Naledi report').selectOption('3');
    await page.getByLabel('What tends to start the pattern?').fill('After a difficult commute');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Real-world test');
    await page.getByLabel('There was no opportunity', { exact: true }).check();
    await expect(page.getByText(/in 3 of 5 opportunities/)).toBeVisible();
    await page.getByLabel('Share evidence summary with facilitator', { exact: false }).check();
    await page.getByLabel('Ask for human support', { exact: false }).check();
    await page.getByRole('button', { name: 'See the facilitator view' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Facilitator view');
    await expect(page.getByText('20', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Acknowledge support request', exact: true }).click();
    await page.getByLabel('Facilitator review note').fill('Shared evidence supports a follow-up about the smaller first action.');
    await page.getByRole('button', { name: 'Record illustrative review', exact: true }).click();

    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Evidence profile');
    await expect(page.getByText(/rated her control 3 points higher/)).toBeVisible();
    await expect(page.locator('.experience-v2-evidence-chain')).toHaveCount(0);
    await expect(page.getByText('Shared evidence supports a follow-up about the smaller first action.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'See programme outcomes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Programme outcomes');
    await expect(page.getByText('Are participants following through more often?')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What can we say about readiness for the next opportunity?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download illustrative report' })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('leap9-v2-' + testInfo.project.name + '.png'), fullPage: true });
    expect(errors).toEqual([]);
  });

  test('browser history returns to the previous experience stage', async ({ page }) => {
    await page.goto('/experience/leap9/v2');
    await page.getByRole('button', { name: 'Begin with Naledi' }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page).toHaveURL(/#experiment$/);
    await page.goBack();
    await expect(page).toHaveURL(/#participant$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Participant journey');
  });
});
