import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { dgmtDemonstration as slides } from '../lib/experience/dgmt-demonstration.mjs';

// Run against the fictional browser harness, never a live participant account:
// BIS_DEMO_BASE_URL=http://127.0.0.1:3100 node scripts/create-dgmt-demonstration.mjs
const base = process.env.BIS_DEMO_BASE_URL ?? 'http://127.0.0.1:3100';
const output = join(process.cwd(), 'public/experience');
const narration = join(process.cwd(), 'content/media/dgmt/narration.m4a');
const narrationCaptions = await readFile(join(process.cwd(), 'content/media/dgmt/narration.vtt'), 'utf8');
const scratch = await mkdtemp(join(tmpdir(), 'bis-dgmt-demo-'));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
try {
  await mkdir(output, { recursive: true });
  const demo = await browser.newPage({ viewport: { width: 860, height: 900 }, deviceScaleFactor: 1 });
  const frame = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const list = [];
  for (const [index, slide] of slides.entries()) {
    await demo.goto(`${base}/experience/dgmt#${slide.stage}`);
    await demo.locator('.experience-v2-loading').waitFor({ state: 'hidden' });
    await demo.addStyleTag({ content: '.experience-v2-first-view { display: none; }' });
    if (slide.stage === 'experiment') await demo.getByLabel('There was no opportunity', { exact: true }).check();
    await demo.locator(slide.capture).scrollIntoViewIfNeeded();
    const screenshot = await demo.screenshot();
    await frame.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:#eef1ed;color:#18333b;font:21px/1.55 Arial,sans-serif}
      main{display:grid;grid-template-columns:490px 1fr;height:720px}article{padding:40px 36px;background:#fff}
      .brand{font-size:18px;font-weight:bold;color:#2f8276;letter-spacing:.03em}h1{font:600 43px/1.13 Georgia,serif;margin:34px 0 24px}
      p{margin:0 0 20px}figure{margin:28px 28px 70px;overflow:hidden;border:1px solid #dfe4df;background:#fff}
      img{display:block;width:100%;height:auto}footer{position:fixed;bottom:0;width:100%;background:#173f35;color:#fff;padding:17px 36px;font-size:14px;display:flex;justify-content:space-between}
      </style><main><article><div class="brand">BIS for DGMT · Short demonstration</div><h1>${escape(slide.title)}</h1>${slide.copy.map(text => `<p>${escape(text)}</p>`).join('')}</article><figure><img src="data:image/png;base64,${screenshot.toString('base64')}" alt="Fictional BIS experience"></figure></main><footer><span>Behaviour Intelligence Series™ · Applied Commerce®</span><span>Fictional example · ${index + 1} / ${slides.length}</span></footer></html>`);
    await frame.locator('img').evaluate(image => image.decode());
    const path = join(scratch, `frame-${index}.png`);
    await frame.screenshot({ path });
    if (index === 0) await frame.screenshot({ path: join(output, 'dgmt-overview.jpg'), type: 'jpeg', quality: 90 });
    list.push(`file '${path}'\nduration 18`);
  }
  list.push(`file '${join(scratch, 'frame-4.png')}'`);
  await writeFile(join(scratch, 'frames.txt'), list.join('\n'));
  await writeFile(join(output, 'dgmt-overview.vtt'), narrationCaptions);
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', join(scratch, 'frames.txt'), '-i', narration, '-map', '0:v:0', '-map', '1:a:0', '-t', '90', '-vf', 'fps=10,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'copy', '-movflags', '+faststart', join(output, 'dgmt-overview.mp4')], { stdio: ['ignore', 'ignore', 'pipe'] });
  console.log('Created narrated 90-second DGMT demonstration, poster and timed English captions.');
} finally {
  await browser.close();
  await rm(scratch, { recursive: true, force: true });
}
