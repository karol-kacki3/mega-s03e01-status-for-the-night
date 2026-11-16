import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FEED_URL, normalizeFeed, renderPage } from '../src/worker.mjs';

export async function buildStatic({ outDir = 'dist', fetchFeed = fetch } = {}) {
  const response = await fetchFeed(FEED_URL, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Ops feed returned HTTP ${response.status}; refusing to publish`);
  const data = normalizeFeed(await response.json());
  // Both files come from one upstream response. Never replace updatedAt with build time.
  const html = renderPage(data, { snapshot: true });
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outDir, 'index.html'), html),
    writeFile(resolve(outDir, 'status.json'), `${JSON.stringify(data, null, 2)}\n`),
    writeFile(resolve(outDir, '.nojekyll'), ''),
  ]);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const data = await buildStatic();
    console.log(`Built Pages snapshot: ${data.incidents.length} incidents, feed updatedAt ${data.updatedAt}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
