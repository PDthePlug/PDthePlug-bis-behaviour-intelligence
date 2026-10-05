import { expect, test } from '@playwright/test';

test('Leap9 participant → facilitator → profile → outcomes preserves answers and consent', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/experience/')) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/experience/leap9');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From learning to evidence.');
  await expect(page.locator('.canonical-shell')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('leap9-welcome.png'), fullPage: true });
  await page.getByRole('button', { name: 'Begin with Naledi' }).click();
  await page.getByLabel('How much control does Naledi report').selectOption('3');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Episode 1: The Boy Who Kept Losing R20' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('What tends to start the pattern?').fill('After a long taxi trip');
  await page.reload();
  await expect(page.getByLabel('What tends to start the pattern?')).toHaveValue('After a long taxi trip');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('After a long taxi trip →', { exact: false })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Habit mapping');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('There was no opportunity', { exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('60%', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('leap9-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'See the facilitator perspective' }).click();
  await expect(page.getByRole('heading', { name: 'The evidence stays private.' })).toBeVisible();
  await expect(page.getByText('Starting with one field helped.', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Return to sharing choice' }).click();
  await page.getByLabel('Simulate Naledi choosing to share').check();
  await page.getByLabel('Simulate Naledi requesting help').check();
  await page.getByRole('button', { name: 'See the facilitator perspective' }).click();
  await page.getByRole('button', { name: 'Acknowledge support request', exact: true }).click();
  await page.getByLabel('Facilitator review note').fill('Shared observations support a discussion about the smaller first action.');
  await page.getByRole('button', { name: 'Record illustrative review', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('3 → 6 / 10 (+3 points)', { exact: true })).toBeVisible();
  await expect(page.getByText('Shared observations support a discussion about the smaller first action.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'See programme outcomes' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Programme outcomes');
  await page.screenshot({ path: testInfo.outputPath('leap9-outcomes.png'), fullPage: true });
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download illustrative outcome report' }).click();
  const report = await download;
  expect(report.suggestedFilename()).toBe('Leap9-BIS-Illustrative-Outcome-Report.pdf');
  await report.saveAs(testInfo.outputPath('leap9-report.pdf'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Restart experience', exact: true }).click();
  await page.getByRole('button', { name: 'Clear and restart', exact: true }).click();
  await page.getByRole('button', { name: /08.*Facilitator/ }).click();
  await expect(page.getByRole('heading', { name: 'The evidence stays private.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('report is a labelled fixed simulation without visitor responses', async ({ request }) => {
  const response = await request.get('/experience/leap9/report');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  const bytes = await response.body();
  expect(bytes.subarray(0,4).toString()).toBe('%PDF');
  const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await getDocument({data:new Uint8Array(bytes)}).promise;
  let body = '';
  for (let index=1; index<=pdf.numPages; index++) {
    const content=await (await pdf.getPage(index)).getTextContent();
    const text=content.items.filter(item=>'str' in item).map(item=>item.str).join(' ');
    expect(text).toContain('ILLUSTRATIVE SIMULATION'); body += text;
  }
  expect(body).not.toContain('Naledi');
  expect(body).not.toContain('Starting with one field');
  await pdf.cleanup();
});

test('storage failure leaves the experience usable and explains persistence', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage unavailable'); } });
  });
  await page.goto('/experience/leap9#starting-point');
  await expect(page.getByText('This browser cannot keep your practice answers', { exact: false })).toBeVisible();
  await page.getByLabel('How much control does Naledi report').selectOption('2');
  await expect(page.getByRole('status')).toContainText('could not be kept after refresh');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Learning');
});

test('editing shared evidence invalidates a simulated review', async ({ page }) => {
  await page.goto('/experience/leap9#review');
  await page.getByLabel('Simulate Naledi choosing to share').check();
  await page.getByRole('button', { name: 'See the facilitator perspective' }).click();
  await page.getByLabel('Facilitator review note').fill('Illustrative review of the original record');
  await page.getByRole('button', { name: 'Record illustrative review', exact: true }).click();
  await page.getByRole('button', { name: /07.*Evidence review/ }).click();
  await page.getByLabel('What does Naledi think the experiment revealed?').fill('A revised fictional interpretation.');
  await page.getByRole('button', { name: /09.*Evidence profile/ }).click();
  await expect(page.getByText('No illustrative review recorded', { exact: true })).toBeVisible();
  await expect(page.getByText('Illustrative review of the original record', { exact: true })).toHaveCount(0);
});
