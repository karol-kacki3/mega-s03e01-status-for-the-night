import test from 'node:test';
import assert from 'node:assert/strict';
import { BANNER_COLOR, FEED_URL, createWorker, normalizeFeed } from '../src/worker.mjs';

const feed = {
  updatedAt: '2026-11-16T21:54:00Z',
  incidents: [
    { id: '3710', line: 'bus 14', opened: '2026-09-12T23:40:00Z', closed: '2026-09-12T23:52:00Z', what: 'depot sensor reset', author: 'night shift' },
    { id: '3714', line: 'tram 3', opened: '2026-09-14T02:35:00Z', closed: '2026-09-14T02:49:00Z', what: 'platform display lag', author: 'night shift' },
    { id: '3715', line: 'sched-prod', opened: '2026-09-14T03:46:00Z', closed: '2026-09-14T04:04:00Z', what: 'schedule rebuild', author: '—' },
    { id: '3712', line: 'night bus N2', opened: '2026-09-14T00:15:00Z', closed: null, what: 'rota sync retries', author: 'on-call' },
  ],
};
const request = (path = '/', method = 'GET') => new Request(`https://status.example${path}`, { method });
const worker = () => createWorker(async () => Response.json(feed));

test('JSON keeps older rows, sorts newest first and preserves live updatedAt and author', async () => {
  const response = await worker().fetch(request('/status.json'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  const json = await response.json();
  assert.equal(json.updatedAt, feed.updatedAt);
  assert.deepEqual(json.incidents.map((row) => row.id), ['3715', '3714', '3712', '3710']);
  assert.equal(json.incidents[0].author, '—');
  assert.deepEqual(feed.incidents.map((row) => row.id), ['3710', '3714', '3715', '3712']);
});

test('reads ops feed anew, rather than hard-coding an updatedAt snapshot', async () => {
  let count = 0;
  const instance = createWorker(async (url, options) => {
    assert.equal(url, FEED_URL);
    assert.equal(options.cache, 'no-store');
    count++;
    return Response.json({ ...feed, updatedAt: `2026-11-16T22:0${count}:00Z` });
  });
  const first = await (await instance.fetch(request('/status.json'))).json();
  const second = await (await instance.fetch(request('/status.json'))).json();
  assert.notEqual(first.updatedAt, second.updatedAt);
  assert.equal(count, 2);
});

test('page renders all accepted text, lines and incidents without inventing an operator', async () => {
  const html = await (await worker().fetch(request())).text();
  for (const text of ['<h1>status for the night</h1>', 'all times UTC', 'read on every tram 3 board', 'tram 3', 'bus 14', 'night bus N2', '2026-09-12', feed.updatedAt, '— (not provided)', BANNER_COLOR, 'Awaiting product clarification']) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.indexOf('data-incident-id="3715"') < html.indexOf('data-incident-id="3710"'));
  assert.equal((html.match(/data-incident-id=/g) ?? []).length, feed.incidents.length);
  assert.equal((html.match(/<th scope="row">tram 3<\/th>/g) ?? []).length, 2);
  assert.ok(!html.includes('<script'));
});

test('HTML and JSON reflect the same snapshot', async () => {
  const instance = worker();
  const json = await (await instance.fetch(request('/status.json'))).json();
  const html = await (await instance.fetch(request())).text();
  assert.ok(html.includes(json.updatedAt));
  for (const row of json.incidents) assert.ok(html.includes(`data-incident-id="${row.id}"`));
});

test('untrusted feed strings are escaped in HTML', async () => {
  const instance = createWorker(async () => Response.json({ ...feed, incidents: [{ ...feed.incidents[0], line: '<img src=x onerror=alert(1)>', what: '<script>bad()</script>', author: 'A & B' }] }));
  const html = await (await instance.fetch(request())).text();
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.ok(!html.includes('<img src=x'));
});

test('HEAD and CORS preflight work', async () => {
  const head = await worker().fetch(request('/status.json', 'HEAD'));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const preflight = await worker().fetch(request('/status.json', 'OPTIONS'));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
});

test('unknown paths and write methods are rejected', async () => {
  assert.equal((await worker().fetch(request('/missing'))).status, 404);
  assert.equal((await worker().fetch(request('/', 'POST'))).status, 405);
});

test('upstream failures return 503 without fabricated timestamps or stale data', async () => {
  for (const fetcher of [async () => { throw new Error('offline'); }, async () => new Response('bad', { status: 500 }), async () => Response.json({ incidents: [] })]) {
    const response = await createWorker(fetcher).fetch(request('/status.json'));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.deepEqual(await response.json(), { error: 'Ops feed unavailable' });
  }
});

test('rejects invalid timestamps and duplicate identifiers', () => {
  assert.throws(() => normalizeFeed({ ...feed, updatedAt: '2026-11-16T21:54:00+01:00' }));
  assert.throws(() => normalizeFeed({ ...feed, incidents: [feed.incidents[0], feed.incidents[0]] }));
});
