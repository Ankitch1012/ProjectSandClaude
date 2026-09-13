'use strict';

const http = require('http');

const check = require('./lib/check');
const figures = require('./lib/figures');
const progress = require('./lib/progress');
const store = require('./lib/store');

const PORT = Number(process.env.PORT || 5000);

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 512 * 1024) {
        reject(new Error('crib too long'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const routes = {
  'GET /api/figures': (req, res) => {
    send(res, 200, {
      figures: figures.BOOK.map((entry) => ({
        bars: entry.bars,
        movement: entry.movement.kind,
        name: entry.name,
        requires: entry.requires ? entry.requires.kind : null
      })),
      progression: progress.expected()
    });
  },

  'GET /api/cribs': (req, res) => {
    send(res, 200, { cribs: store.list() });
  },

  'GET /api/health': (req, res) => {
    send(res, 200, { desk: 'cribstave', status: 'ok' });
  },

  'POST /api/check': async (req, res) => {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      send(res, 400, { error: 'unreadable-request', detail: String(error.message || error) });
      return;
    }
    if (typeof body.text !== 'string') {
      send(res, 400, { error: 'no-crib-supplied' });
      return;
    }
    send(res, 200, check.check(body.text, Number(body.bars)));
  },

  'POST /api/reset': (req, res) => {
    store.reset();
    send(res, 200, { cribs: store.list() });
  }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const key = `${req.method} ${url.pathname}`;

  if (routes[key]) {
    try {
      await routes[key](req, res);
    } catch (error) {
      send(res, 500, { error: 'desk-failed', detail: String(error.message || error) });
    }
    return;
  }

  const cribMatch = /^\/api\/cribs\/([A-Za-z0-9-]+)$/.exec(url.pathname);
  if (cribMatch) {
    const slug = cribMatch[1];

    if (req.method === 'GET') {
      const crib = store.get(slug);
      if (!crib) {
        send(res, 404, { error: 'no-such-crib', slug });
        return;
      }
      send(res, 200, { crib });
      return;
    }

    if (req.method === 'PUT') {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        send(res, 400, { error: 'unreadable-request', detail: String(error.message || error) });
        return;
      }
      const saved = store.save({
        bars: Number(body.bars),
        slug,
        text: body.text,
        title: body.title
      });
      if (!saved) {
        send(res, 400, { error: 'crib-not-saved' });
        return;
      }
      send(res, 200, { crib: saved });
      return;
    }
  }

  send(res, 404, { error: 'no-such-route', path: url.pathname });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cribstave desk listening on ${PORT}`);
});
