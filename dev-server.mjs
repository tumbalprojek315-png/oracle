// Dev-only static file server (Node built-ins only, no npm install required).
// For real deployment, any static host (GitHub Pages / Netlify / Vercel /
// Cloudflare Pages) can serve this folder as-is — there is no server logic.
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);

    // Server status for the app's LIVE / OFFLINE indicator: a tiny "are you
    // alive?" answer (the app asks with HEAD so no service worker, old or new,
    // can answer it from a cache).
    if (urlPath === '/__health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ ok: true, t: Date.now() }));
      return;
    }
    let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let stats;
    try {
      stats = await stat(filePath);
    } catch {
      res.writeHead(404).end('Not found');
      return;
    }
    if (stats.isDirectory()) filePath = path.join(filePath, 'index.html');

    const ext = path.extname(filePath);
    const body = await readFile(filePath);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (path.basename(filePath) === 'service-worker.js') headers['Cache-Control'] = 'no-store';
    else headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers).end(body);
  } catch (err) {
    res.writeHead(500).end('Server error: ' + err.message);
  }
});

// /__ws: a WebSocket the app keeps open (WebSockets never pass through a
// service worker). When this server stops — Ctrl+C, closing the window,
// taskkill — the OS drops the connection and the app shows OFFLINE at once.
// Only the opening handshake is needed; no messages are sent.
server.on('upgrade', (req, socket) => {
  socket.on('error', () => {});
  const key = req.headers['sec-websocket-key'];
  if (req.url.split('?')[0] !== '/__ws' || !key) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  const CRLF = String.fromCharCode(13, 10);
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join(CRLF));
  socket.setKeepAlive(true, 10000);
  socket.on('data', (buf) => {
    if ((buf[0] & 0x0f) === 0x8) socket.end(Buffer.from([0x88, 0x00])); // the page sent "close": answer it and hang up
  });
});

server.listen(PORT, () => {
  console.log(`Oracle dev server running at http://localhost:${PORT}`);
});
