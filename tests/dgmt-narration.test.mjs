import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dgmtDemonstration } from '../lib/experience/dgmt-demonstration.mjs';

test('DGMT media includes narration and captions follow every approved spoken paragraph', async () => {
  const video = await readFile(new URL('../public/experience/dgmt-overview.mp4', import.meta.url));
  assert.ok(video.includes(Buffer.from('soun')), 'video must contain an audio track');
  const captions = await readFile(new URL('../public/experience/dgmt-overview.vtt', import.meta.url), 'utf8');
  const recordedCaptions = await readFile(new URL('../content/media/dgmt/narration.vtt', import.meta.url), 'utf8');
  assert.equal(captions, recordedCaptions);
  const cues = captions.trim().split('\n\n').slice(1);
  assert.equal(cues.length, 15);
  const seconds = value => { const [hours, minutes, rest] = value.split(':'); return Number(hours)*3600+Number(minutes)*60+Number(rest); };
  let previousEnd = 0;
  for (const [index, cue] of cues.entries()) {
    const [, times, ...text] = cue.split('\n');
    const [start, end] = times.split(' --> ').map(seconds);
    assert.ok(start >= previousEnd && end > start && end <= 90);
    assert.equal(text.join('\n'), dgmtDemonstration[Math.floor(index/3)].copy[index%3]);
    previousEnd = end;
  }
  const recording = await readFile(new URL('../content/media/dgmt/narration.m4a', import.meta.url));
  assert.ok(recording.includes(Buffer.from('soun')));
});
