import http from 'node:http';
import worker from '../src/worker.mjs';

const port = Number(process.env.PORT ?? 8787);
http.createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('Local preview failed');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port}`));
