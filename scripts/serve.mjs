import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const root = resolve('dist');
const host = '127.0.0.1', port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.map': 'application/json; charset=utf-8' };
const server = createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}:${port}`).pathname); }
  catch { response.writeHead(400).end('Invalid URL'); return; }
  if (pathname === '/') { response.writeHead(302, { Location: '/circuits/' }).end(); return; }
  if (!pathname.startsWith('/circuits/')) { response.writeHead(404).end('Not found'); return; }
  const relative = pathname.slice('/circuits/'.length) || 'index.html';
  const path = resolve(root, relative);
  if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403).end('Forbidden'); return; }
  try {
    const data = await readFile(path);
    const extension = path.slice(path.lastIndexOf('.'));
    response.writeHead(200, { 'Content-Type': types[extension] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(port, host, () => process.stdout.write(`Circuits Unfolded: http://${host}:${port}/circuits/\n`));
