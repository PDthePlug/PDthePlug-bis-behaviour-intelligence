import { expect, test } from '@playwright/test';

const partners = [
  ['vodacom', 'Vodacom Foundation'],
  ['sasol', 'Sasol Foundation'],
  ['primestars', 'Primestars'],
  ['jasa', 'JA South Africa'],
  ['momentum', 'Momentum Group Foundation'],
  ['tutuwa', 'Standard Bank Tutuwa Community Foundation'],
] as const;

test('outreach experiences keep identity, eight stages, reports and practice state isolated', async ({ page, request }) => {
  const errors: string[] = [];
  const writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', req => { if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method())) writes.push(req.url()); });
  for (const [partner, organisation] of partners) {
    await page.goto('/experience/' + partner + '/v2');
    await expect(page.getByRole('link', { name: organisation + ' × BIS Programme Experience home' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('See development become evidence.');
    await page.getByRole('button', { name: 'Follow one participant' }).click();
    await expect(page.getByLabel('What tends to start the pattern?')).toHaveValue('After arriving home from the taxi rank');
    await page.getByLabel('What tends to start the pattern?').fill(partner + ' private practice');
    await page.reload();
    await expect(page.getByLabel('What tends to start the pattern?')).toHaveValue(partner + ' private practice');
    for (const [stage, title] of [
      ['review', 'Human review'], ['portfolio', 'Development portfolio'],
      ['facilitator', 'Facilitator intelligence'], ['cohort', 'Cohort development'],
      ['outcomes', 'Programme outcomes'],
    ]) {
      await page.goto('/experience/' + partner + '/v2#' + stage);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await expect(page.getByRole('link', { name: 'Download Habit evidence sample' })).toHaveAttribute('href', '/experience/' + partner + '/report');
    const report = await request.get('/experience/' + partner + '/report');
    expect(report.status()).toBe(200);
    expect(report.headers()['content-type']).toBe('application/pdf');
    expect(report.headers()['cache-control']).toBe('no-store');
    expect(report.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect((await report.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }
  for (const [partner] of partners) {
    await page.goto('/experience/' + partner + '/v2#participant');
    await expect(page.getByLabel('What tends to start the pattern?')).toHaveValue(partner + ' private practice');
  }
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});
