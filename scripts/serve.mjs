import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const root = resolve(process.env.SITE_DIR || 'dist');
const host = '127.0.0.1';
const explicitPort = process.env.PORT !== undefined;
const port = explicitPort ? Number(process.env.PORT) : 4173;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write('PORT must be an integer from 1 to 65535.\n');
  process.exit(1);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.map': 'application/json; charset=utf-8' };
const server = createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}`).pathname); }
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
let triedAvailablePort = false;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && !explicitPort && !triedAvailablePort) {
    triedAvailablePort = true;
    process.stderr.write(`Port ${port} is occupied; choosing an available local port.\n`);
    server.listen(0, host);
    return;
  }
  process.stderr.write(error.code === 'EADDRINUSE'
    ? `Port ${port} is occupied. Choose another with PORT=4188 npm run dev.\n`
    : `Preview server failed: ${error.message}\n`);
  process.exitCode = 1;
});
server.on('listening', () => {
  const address = server.address();
  if (address && typeof address !== 'string') process.stdout.write(`Circuits Unfolded: http://${host}:${address.port}/circuits/\n`);
});
server.listen(port, host);
