import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { buildStatic } from '../scripts/build-pages.mjs';

const feed = {
  updatedAt: '2026-11-16T22:00:00Z',
  incidents: [{ id: '3710', line: 'tram 3', opened: '2026-09-12T23:40:00Z', closed: null, what: 'board reset', author: 'on-call' }],
};

async function temporaryBuild(t) {
  await mkdir('private', { recursive: true });
  const path = await mkdtemp(join('private', 'pages-test-'));
  t.after(() => rm(path, { recursive: true }));
  return path;
}

test('Pages builds matching HTML and JSON snapshots with project-relative links', async (t) => {
  const outDir = await temporaryBuild(t);
  let calls = 0;
  await buildStatic({ outDir, fetchFeed: async () => { calls++; return Response.json(feed); } });
  assert.equal(calls, 1);
  const html = await readFile(join(outDir, 'index.html'), 'utf8');
  const json = JSON.parse(await readFile(join(outDir, 'status.json'), 'utf8'));
  assert.equal(json.updatedAt, feed.updatedAt);
  assert.ok(html.includes(json.updatedAt));
  assert.ok(html.includes('Published snapshot'));
  assert.ok(html.includes('href="./status.json"'));
  assert.ok(!html.includes('href="/status.json"'));
  assert.deepEqual((await readdir(outDir)).sort(), ['.nojekyll', 'index.html', 'status.json']);
});

test('failed upstream does not generate a misleading Pages artifact', async (t) => {
  const outDir = await temporaryBuild(t);
  await assert.rejects(buildStatic({ outDir, fetchFeed: async () => new Response('unavailable', { status: 503 }) }));
  assert.deepEqual(await readdir(outDir), []);
});
