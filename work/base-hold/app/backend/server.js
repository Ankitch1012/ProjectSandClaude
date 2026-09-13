'use strict';

const http = require('http');

const notebook = require('./lib/notebook');
const season = require('./lib/season');
const { OPENING, RECORDS, SCALE_MAX, STOCKS, VISITS } = require('./lib/story');
const { handFor, resetAll, restart, setHandName, store } = require('./lib/store');

const PORT = Number(process.env.PORT || 5000);

function headers() {
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, headers());
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        raw = raw.slice(0, 1e6);
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        resolve({});
      }
    });
  });
}

function handView(session) {
  return season.render(session, season.seasonOf(session), {
    handName: store.handName,
    pages: notebook.pageList(store)
  });
}

function seasonSheet() {
  return {
    opening: OPENING,
    scaleMax: SCALE_MAX,
    stocks: Object.keys(STOCKS).map((stock) => ({
      stock,
      label: STOCKS[stock].label,
      scion: STOCKS[stock].scion
    })),
    visits: VISITS.map((visit) => ({
      id: visit.id,
      title: visit.title,
      day: visit.day,
      light: visit.light
    })),
    records: RECORDS.map((record) => ({
      id: record.id,
      title: record.title,
      blurb: record.blurb
    }))
  };
}

function failed(res, outcome) {
  send(res, outcome.status || 400, { error: outcome.error });
}

async function route(req, res, url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method || 'GET';
  const segments = path.split('/').filter(Boolean);

  if (method === 'OPTIONS') {
    res.writeHead(204, headers());
    res.end();
    return;
  }

  if (method === 'GET' && path === '/api/health') {
    send(res, 200, { ok: true, app: 'cleftwood' });
    return;
  }

  if (method === 'GET' && path === '/api/season') {
    send(res, 200, seasonSheet());
    return;
  }

  if (method === 'GET' && path === '/api/pages') {
    send(res, 200, { pages: notebook.pageList(store) });
    return;
  }

  if (method === 'POST' && path === '/api/test/reset') {
    resetAll();
    send(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && path === '/api/test/hand-name') {
    const body = await readBody(req);
    send(res, 200, { handName: setHandName(body.name) });
    return;
  }

  // Walks a season forward through the same write-up the visit panel uses, so a
  // scenario can be put in place without clicking every visit by hand.
  if (method === 'POST' && path === '/api/test/script') {
    const body = await readBody(req);
    const session = handFor(body.hand);
    const steps = Array.isArray(body.steps) ? body.steps : [];
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const outcome = season.completeVisit(session, step.visit, step.option, { forced: true });
      if (outcome.error) {
        send(res, outcome.status || 400, { error: outcome.error, step: index });
        return;
      }
    }
    send(res, 200, handView(session));
    return;
  }

  if (segments[0] === 'api' && segments[1] === 'hands' && segments[2]) {
    const session = handFor(segments[2]);
    const action = segments[3] || '';

    if (method === 'GET' && !action) {
      send(res, 200, handView(session));
      return;
    }

    if (method === 'POST' && action === 'restart') {
      send(res, 200, handView(restart(segments[2])));
      return;
    }

    if (method === 'POST' && action === 'visit') {
      const body = await readBody(req);
      const outcome = season.enterVisit(session, body.visitId);
      if (outcome.error) {
        failed(res, outcome);
        return;
      }
      send(res, 200, handView(session));
      return;
    }

    if (method === 'POST' && action === 'choose') {
      const body = await readBody(req);
      const outcome = season.completeVisit(session, body.visitId, body.optionId);
      if (outcome.error) {
        failed(res, outcome);
        return;
      }
      send(res, 200, handView(session));
      return;
    }

    if (method === 'POST' && action === 'pages') {
      const body = await readBody(req);
      const outcome = notebook.savePage(store, session, body);
      if (outcome.error) {
        failed(res, outcome);
        return;
      }
      send(res, 200, handView(session));
      return;
    }

    if (method === 'POST' && action === 'load') {
      const body = await readBody(req);
      const outcome = notebook.loadPage(store, session, body.pageId);
      if (outcome.error) {
        failed(res, outcome);
        return;
      }
      send(res, 200, handView(session));
      return;
    }
  }

  send(res, 404, { error: 'no-such-route' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  route(req, res, url).catch((error) => {
    send(res, 500, { error: 'server-error', detail: String((error && error.message) || error) });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cleftwood season service listening on ${PORT}`);
});
