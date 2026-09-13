'use strict';

const http = require('http');

const passageLib = require('./lib/passage');
const { CHAMBERS, LADDER, POUNDS, riseInches, riseLabel } = require('./lib/flight');
const { allowanceCuFt, lockfulCuFt } = require('./lib/water');
const { clearPassage, passageFor, resetAll, setBoatName, store } = require('./lib/store');

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
  res.writeHead(status, headers());
  res.end(JSON.stringify(payload));
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

function gaugeBook() {
  return {
    flight: 'The Marsden Flight',
    ladder: LADDER,
    operations: passageLib.OPERATIONS,
    chambers: CHAMBERS.map((chamber) => ({
      id: chamber.id,
      name: chamber.name,
      riseFt: chamber.riseFt,
      riseIn: chamber.riseIn,
      riseInches: riseInches(chamber),
      riseLabel: riseLabel(chamber),
      areaSqFt: chamber.areaSqFt,
      lockfulCuFt: lockfulCuFt(chamber),
      above: chamber.above,
      below: chamber.below
    })),
    pounds: Object.keys(POUNDS).map((id) => ({
      id,
      name: POUNDS[id].name,
      banded: POUNDS[id].banded,
      surfaceSqFt: POUNDS[id].surfaceSqFt,
      permittedDrawIn: POUNDS[id].permittedDrawIn,
      allowanceCuFt: allowanceCuFt(POUNDS[id])
    }))
  };
}

function passageView(passage) {
  return Object.assign({ passage: passage.id, boatName: store.boatName, plan: passage.plan },
    passageLib.render(passage.plan));
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
    send(res, 200, { ok: true, app: 'bywash' });
    return;
  }

  if (method === 'GET' && path === '/api/flight') {
    send(res, 200, gaugeBook());
    return;
  }

  if (method === 'POST' && path === '/api/test/reset') {
    resetAll();
    send(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && path === '/api/test/boat-name') {
    const body = await readBody(req);
    send(res, 200, { boatName: setBoatName(body.name) });
    return;
  }

  // Writes a whole plan onto a passage at once, so a scenario can be set out
  // without adding every step by hand.
  if (method === 'POST' && path === '/api/test/plan') {
    const body = await readBody(req);
    const passage = passageFor(body.passage);
    passage.plan = Array.isArray(body.steps) ? body.steps.slice() : [];
    send(res, 200, passageView(passage));
    return;
  }

  if (segments[0] === 'api' && segments[1] === 'passages' && segments[2]) {
    const passage = passageFor(segments[2]);
    const action = segments[3] || '';

    if (method === 'GET' && !action) {
      send(res, 200, passageView(passage));
      return;
    }

    if (method === 'POST' && action === 'steps') {
      const body = await readBody(req);
      if (passageLib.OPERATIONS.indexOf(String(body.operation)) === -1) {
        send(res, 400, { error: 'no-such-operation' });
        return;
      }
      passage.plan.push({ chamber: body.chamber || null, operation: body.operation });
      send(res, 200, passageView(passage));
      return;
    }

    if (method === 'POST' && action === 'undo') {
      passage.plan.pop();
      send(res, 200, passageView(passage));
      return;
    }

    if (method === 'POST' && action === 'clear') {
      send(res, 200, passageView(clearPassage(segments[2])));
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
  console.log(`Bywash flight service listening on ${PORT}`);
});
