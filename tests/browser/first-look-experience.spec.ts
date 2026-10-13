import { expect, test } from '@playwright/test';

test('BIS First Look is neutral, no-login and shows the governed learner-to-programme evidence chain', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/experience/')) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) writes.push(request.url()); });

  const checkLayout = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  await page.goto('/experience/first-look');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('See what happens after learning.');
  await expect(page.getByText('No account required', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /School/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Emerging Adult/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Workplace/ })).toBeVisible();
  await expect(page.getByText(/DGMT/i)).toHaveCount(0);
  await checkLayout();
  await page.screenshot({ path: testInfo.outputPath('first-look-gateway.png'), fullPage: true });

  await page.getByRole('button', { name: /School/ }).click();
  await expect(page.getByText('BIS First Look · School lens · 14–18', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'How does learning become usable evidence?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The information changes shape, not meaning.' })).toBeVisible();
  await expect(page.getByText('Participant portfolio', { exact: true })).toBeVisible();
  await expect(page.getByText('Facilitator development view', { exact: true })).toBeVisible();
  await expect(page.getByText('Programme evidence', { exact: true })).toBeVisible();
  await expect(page.getByText(/does not claim.*later submission proves improvement/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Illustrative outcome report/ })).toHaveAttribute('href', '/experience/first-look/report');
  await expect(page.getByText('This First Look keeps one fictional worked example constant', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Your organisation × BIS Programme Experience home' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'See the programme move.' })).toBeVisible();
  await expect(page.getByText(/DGMT/i)).toHaveCount(0);
  await checkLayout();

  await page.getByRole('button', { name: 'Switch context', exact: false }).click();
  await page.getByRole('button', { name: /Workplace/ }).click();
  await expect(page.getByText('BIS First Look · Workplace lens · 25+', { exact: true })).toBeVisible();
  await expect(page.getByText('Can development move beyond attendance and self-report', { exact: false })).toBeVisible();
  await checkLayout();
  await page.screenshot({ path: testInfo.outputPath('first-look-workplace.png'), fullPage: true });

  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('First Look practice and context storage stay isolated from DGMT and Leap9', async ({ page }) => {
  await page.goto('/experience/first-look');
  await page.getByRole('button', { name: /Emerging Adult/ }).click();
  await page.getByRole('button', { name: 'Begin with Naledi' }).click();
  await page.getByLabel('What tends to start the pattern?').fill('First Look practice only');

  await page.goto('/experience/dgmt#participant');
  await expect(page.getByLabel('What tends to start the pattern?')).toHaveValue('After arriving home from the taxi rank');
  await page.getByLabel('What tends to start the pattern?').fill('DGMT practice only');

  await page.goto('/experience/first-look#participant');
  await expect(page.getByText('BIS First Look · Emerging Adult lens · 18–25', { exact: true })).toBeVisible();
  await expect(page.getByLabel('What tends to start the pattern?')).toHaveValue('First Look practice only');

  await page.goto('/experience/leap9/v2#participant');
  await expect(page.getByLabel('What tends to start the pattern?')).toHaveValue('After arriving home from the taxi rank');
});

test('First Look report is neutral, aggregate-only and non-indexable', async ({ request }) => {
  const response = await request.get('/experience/first-look/report');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response.headers()['content-disposition']).toContain('BIS-First-Look-Illustrative-Outcome-Report.pdf');

  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await getDocument({ data: new Uint8Array(await response.body()) }).promise;
  let text = '';
  for (let index = 1; index <= pdf.numPages; index++) {
    const content = await (await pdf.getPage(index)).getTextContent();
    const items = content.items.filter(item => 'str' in item);
    const body = items.map(item => item.str).join(' ');
    expect(body).toContain('ILLUSTRATIVE SIMULATION');
    for (const item of items) expect(item.transform[4] + item.width).toBeLessThanOrEqual(548);
    text += body;
  }
  expect(text).toContain('BIS First Look');
  expect(text).not.toMatch(/DGMT|Leap9|PRIVATE_FICTIONAL|REVISED_PRIVATE/);
  await pdf.cleanup();
});
