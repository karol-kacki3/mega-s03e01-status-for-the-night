# status for the night

Public, read-only sched-prod status page and `/status.json`, built as a Cloudflare Worker. No framework, browser JavaScript, tracking, cookies, or runtime dependencies.

```sh
npm test
npm run dev
```

The Worker reads the live ops feed for each request. HTML and JSON use the same transformation, newest incidents first. JSON has permissive read-only CORS, UTC `updatedAt` copied from the feed, and a 60-second cache lifetime. Upstream failures return 503 rather than invented status.

## Requirements decisions

Product answered: **keep the week. R-L3R holds, R-L8Z goes: older rows stay on the page.** All rows supplied by the live feed are retained.

Product has not resolved month-first versus day-first dates, or the missing operator for incident 3715. The page labels these open questions, uses unambiguous ISO dates temporarily, and does not invent an operator. Per-line summaries and newest-first incident details are both shown.

The banner uses screenshot pixel color `#6f55c9`. The exact heading, footer, and tram-board message are included. User-wide intake skill: `~/.agents/skills/capture/SKILL.md`.

## GitHub Pages alternative

At the student's request, `.github/workflows/pages.yml` publishes a static alternative on pushes to `main`, manual dispatch, and a five-minute schedule. Each build fetches the ops feed once and generates matching HTML and JSON. `updatedAt` remains the feed's timestamp, not the build time. Failed fetches fail the deployment, leaving the last published snapshot in place. The page labels itself as a snapshot.

```sh
npm run build
```

Only `dist/` is uploaded as the Pages artifact. Links are relative so `/status.json` sits beside the page under the repository URL.

**Known deviations from the Challenge:** GitHub Pages is not the requested Cloudflare Workers host; it cannot fetch the feed on each request or configure the requested HTTP cache lifetime. GitHub may delay scheduled builds. A failed build leaves an older snapshot online. The course has not accepted this alternative.

## Cloudflare deployment (not performed)

`wrangler.jsonc` targets a separate Worker named `status-for-the-night`; it must not replace the student's existing MCP Worker. Deployment requires explicit approval and the student's Cloudflare account. No deployment has occurred merely by creating these files.

Source material, transcripts, course receipts and logs are ignored under `site-data/` and `private/`. Do not publish those directories.
