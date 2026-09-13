'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 5000);
const ROOT = path.join(__dirname, 'public');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

// The page always asks for /api/... on its own origin, so the shell forwards
// those requests to the flight service. Opening the app needs nothing but the
// address it is served from.
function proxyToService(req, res) {
  const upstream = http.request(
    {
      headers: Object.assign({}, req.headers, { host: `${BACKEND_HOST}:${BACKEND_PORT}` }),
      host: BACKEND_HOST,
      method: req.method,
      path: req.url,
      port: BACKEND_PORT
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on('error', (error) => {
    res.writeHead(502, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'season-service-unreachable', detail: String(error.message || error) }));
  });

  req.pipe(upstream);
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(ROOT, 'index.html'), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': CONTENT_TYPES['.html'] });
        res.end(fallback);
      });
      return;
    }

    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream'
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    proxyToService(req, res);
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Bywash shell listening on ${PORT}, flight service at ${BACKEND_HOST}:${BACKEND_PORT}`);
});
