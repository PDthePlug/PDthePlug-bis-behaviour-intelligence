import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NextRequest } from 'next/server.js';
import ts from 'typescript';

// Exercise the actual proxy with an observable session boundary. Nothing calls
// a backend, and unrelated or similarly named routes must reach that boundary.
const dir = await mkdtemp(new URL('../.experience-boundary-', import.meta.url));
const session = join(dir, 'session.mjs');
await writeFile(session, 'export const calls = []; export async function updateSession(request) { calls.push(request.nextUrl.pathname); return new Response("session boundary"); }');
const source = await readFile(new URL('../proxy.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('"next/server"', '"next/server.js"')
  .replace('"./lib/supabase/proxy"', JSON.stringify(pathToFileURL(session).href));
await writeFile(join(dir, 'proxy.mjs'), code);
const { proxy } = await import(pathToFileURL(join(dir, 'proxy.mjs')).href);
const { calls } = await import(pathToFileURL(session).href);
test.after(() => rm(dir, { recursive: true, force: true }));

test('the fictional DGMT journey, report and video bypass session refresh precisely', async () => {
  for (const path of ['/explore', '/experience/dgmt', '/experience/dgmt/report', '/experience/dgmt-overview.mp4', '/experience/dgmt-overview.vtt', '/experience/leap9', '/experience/leap9/v2', '/experience/leap9/report']) {
    const response = await proxy(new NextRequest('https://bis.example' + path));
    assert.equal(response.headers.get('x-middleware-next'), '1');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
  assert.equal(calls.length, 0);
  for (const path of ['/experience', '/explore/admin', '/api/explore', '/experience/dgmt/admin', '/experience/dgmt/report/private', '/api/staff', '/profile']) {
    const response = await proxy(new NextRequest('https://bis.example' + path));
    assert.equal(await response.text(), 'session boundary');
  }
  assert.deepEqual(calls, ['/experience', '/explore/admin', '/api/explore', '/experience/dgmt/admin', '/experience/dgmt/report/private', '/api/staff', '/profile']);
});
