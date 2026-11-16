export const FEED_URL = 'https://hq.mega.dev/challenges/status-for-the-night/api/incidents/2b04e228c66a';
export const BANNER_COLOR = '#6f55c9';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const date = (value) => new Date(value).toISOString().slice(0, 10);
const time = (value) => value ? new Date(value).toISOString().slice(11, 16) : 'Open';
const timestamp = (value) => value
  ? `<time datetime="${escape(value)}">${date(value)} ${time(value)}</time>`
  : 'Open';

export function normalizeFeed(feed) {
  if (!feed || typeof feed.updatedAt !== 'string'
    || !/Z$/.test(feed.updatedAt) || !Number.isFinite(Date.parse(feed.updatedAt))
    || !Array.isArray(feed.incidents)) {
    throw new Error('Invalid ops feed');
  }
  const ids = new Set();
  for (const row of feed.incidents) {
    if (!row || typeof row.id !== 'string' || ids.has(row.id)
      || typeof row.line !== 'string' || typeof row.what !== 'string'
      || typeof row.author !== 'string' || !Number.isFinite(Date.parse(row.opened))
      || (row.closed !== null && !Number.isFinite(Date.parse(row.closed)))) {
      throw new Error('Invalid incident');
    }
    ids.add(row.id);
  }
  // Product: keep the week. Do not remove older feed rows based on the machine's date.
  return {
    updatedAt: feed.updatedAt,
    incidents: [...feed.incidents].sort((a, b) => Date.parse(b.opened) - Date.parse(a.opened)),
  };
}

function shell(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><title>${escape(title)}</title>
<style>
:root{font:16px/1.6 system-ui,sans-serif;color:#20232b;background:#f5f4f0}*{box-sizing:border-box}body{margin:0}a{color:#493395}a:focus-visible{outline:3px solid #6f55c9;outline-offset:4px}.banner{background:${BANNER_COLOR};color:white;padding:16px max(24px,calc((100vw - 1060px)/2));font-weight:600}.container{max-width:1108px;margin:auto;padding:32px 24px}header{margin-bottom:36px}.eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:.75rem;font-weight:700;color:#5a536d}h1{font-size:clamp(2rem,6vw,3rem);line-height:1.15;letter-spacing:-.04em;margin:10px 0 16px}h2{font-size:1.25rem;margin:0}p{margin:8px 0}section{margin:28px 0}.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px}.muted{color:#575b67}.small{font-size:.875rem}.table-wrap{overflow-x:auto;background:white;border:1px solid #dedde3;border-radius:8px}table{border-collapse:collapse;width:100%;text-align:left;white-space:nowrap}th,td{padding:13px 16px;border-bottom:1px solid #ecebf0;vertical-align:top}th{font-size:.8rem;color:#575b67;background:#faf9fc;font-weight:600}tbody tr:last-child td,tbody tr:last-child th{border-bottom:0}tbody th{font-size:1rem;background:white;color:#20232b}td.description{white-space:normal;min-width:180px}.notice{padding:16px 20px;background:#eeebf7;border-left:3px solid ${BANNER_COLOR};border-radius:0 6px 6px 0}.notice ul{margin:8px 0;padding-left:22px}.pill{display:inline-block;font-size:.8rem;border:1px solid #ddd7ee;border-radius:20px;padding:1px 9px;background:#f6f3fd}.source-gap{color:#65606b}footer{margin-top:40px;padding-top:20px;border-top:1px solid #dedde3;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}code{font-size:.9em}@media(max-width:600px){.container{padding:24px 16px}th,td{padding:10px 12px}.banner{padding:12px 16px}}
</style></head><body>${body}</body></html>`;
}

export function renderPage(data, { snapshot = false } = {}) {
  const lines = new Map();
  for (const row of data.incidents) {
    if (!lines.has(row.line)) lines.set(row.line, row);
  }
  const lineRows = [...lines].map(([line, row]) => `<tr><th scope="row">${escape(line)}</th><td><span class="pill">${row.closed ? 'No open incident in feed' : 'Incident open'}</span></td><td class="description">${escape(row.what)}</td><td>${timestamp(row.opened)}</td></tr>`).join('');
  const incidentRows = data.incidents.map((row) => `<tr data-incident-id="${escape(row.id)}"><td>${escape(row.id)}</td><th scope="row">${escape(row.line)}</th><td>${timestamp(row.opened)}</td><td>${timestamp(row.closed)}</td><td class="description">${escape(row.what)}</td><td>${row.author.trim() && row.author !== '—' ? escape(row.author) : '<span class="source-gap" title="The ops feed does not name this operator">— (not provided)</span>'}</td></tr>`).join('');
  return shell('status for the night', `
<div class="banner">Some services had problems overnight.</div>
<main class="container"><header><p class="eyebrow">sched-prod · public status</p>
<h1>status for the night</h1><p>What happened during the night, with the whole week kept in view.</p>
<p class="muted small">Ops feed updated <time datetime="${escape(data.updatedAt)}">${escape(data.updatedAt)}</time> · <a href="./status.json">Read status.json</a></p>
${snapshot ? '<p class="muted small">Published snapshot · scheduled refresh about every 5 minutes; GitHub may delay updates. This is not a request-time live feed.</p>' : ''}</header>
<section aria-labelledby="lines"><div class="section-head"><h2 id="lines">By line</h2><span class="muted small">Latest incident reported for each line</span></div>
<div class="table-wrap"><table><caption class="small">Transit lines and services in the ops feed</caption><thead><tr><th scope="col">Line</th><th scope="col">Incident state</th><th scope="col">Last incident</th><th scope="col">Opened (UTC)</th></tr></thead><tbody>${lineRows || '<tr><td colspan="4">No incidents reported.</td></tr>'}</tbody></table></div></section>
<section aria-labelledby="incidents"><div class="section-head"><h2 id="incidents">This week’s incidents</h2><span class="muted small">Newest first · ${data.incidents.length} records</span></div>
<div class="table-wrap"><table><caption class="small">All incidents supplied by the live ops feed; older rows stay</caption><thead><tr><th scope="col">ID</th><th scope="col">Line</th><th scope="col">Opened (UTC)</th><th scope="col">Closed (UTC)</th><th scope="col">What happened</th><th scope="col">Operator</th></tr></thead><tbody>${incidentRows || '<tr><td colspan="6">No incidents reported.</td></tr>'}</tbody></table></div></section>
<section class="notice" aria-labelledby="pending"><h2 id="pending">Awaiting product clarification</h2><ul><li>The screenshot asks for month-first dates; the spec asks for day-first dates. Until product resolves this, dates are unambiguous ISO format (YYYY-MM-DD).</li><li>The spec asks for a named operator on every incident. A missing name is shown as supplied, not guessed.</li></ul></section>
<footer class="muted small"><span>all times UTC</span><span>read on every tram 3 board</span><a href="./status.json">Machine-readable status</a></footer></main>`);
}

const commonHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

export function createWorker(fetchFeed = (...args) => fetch(...args)) {
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      const isJson = pathname === '/status.json';
      const headers = {
        ...commonHeaders,
        'Cache-Control': 'public, max-age=60',
        ...(isJson ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' } : {}),
      };
      if (pathname !== '/' && !isJson) return new Response('Not found', { status: 404, headers });
      if (request.method === 'OPTIONS' && isJson) return new Response(null, { status: 204, headers });
      if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: isJson ? 'GET, HEAD, OPTIONS' : 'GET, HEAD' } });
      }
      try {
        const upstream = await fetchFeed(FEED_URL, {
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        if (!upstream.ok) throw new Error('Ops feed unavailable');
        const data = normalizeFeed(await upstream.json());
        const body = isJson ? JSON.stringify(data) : renderPage(data);
        return new Response(request.method === 'HEAD' ? null : body, {
          headers: { ...headers, 'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8' },
        });
      } catch {
        const body = isJson ? JSON.stringify({ error: 'Ops feed unavailable' })
          : shell('Status temporarily unavailable', '<main class="container"><h1>Status temporarily unavailable</h1><p>We could not read the live ops feed. Please try again shortly.</p><p>No cached status is being presented as current.</p><a href="/">Try again</a></main>');
        return new Response(request.method === 'HEAD' ? null : body, {
          status: 503,
          headers: { ...headers, 'Cache-Control': 'no-store', 'Retry-After': '60', 'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8' },
        });
      }
    },
  };
}

export default createWorker();
