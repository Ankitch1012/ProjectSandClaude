const express = require('express');
const {
  FIXTURES,
  STATIONS,
  fixtureById,
  isAllowed,
  publicFixture,
} = require('./catalog');
const {
  createProof,
  recordFreeSpin,
  recordPaper,
} = require('./proof-session');
const { proofView } = require('./view-model');

const app = express();
const sessions = new Map();

app.use(express.json());

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function sendState(res, session, delayMs = 0) {
  const fixture = fixtureById(session.fixtureId);
  const view = proofView(session, fixture);
  setTimeout(() => res.json(view), delayMs);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/fixtures', (_req, res) => {
  res.json({ fixtures: FIXTURES.map(publicFixture) });
});

app.post('/api/start', (req, res) => {
  const { sessionId, fixtureId } = req.body || {};
  const fixture = fixtureById(fixtureId);
  if (!sessionId || !fixture) {
    res.status(400).json({ error: 'A session and cutting-unit plate are required.' });
    return;
  }
  const session = createProof(fixtureId);
  sessions.set(sessionId, session);
  sendState(res, session);
});

app.post('/api/result', (req, res) => {
  const { sessionId, blade, station, mode, outcome } = req.body || {};
  const session = getSession(sessionId);
  const fixture = session && fixtureById(session.fixtureId);
  const validStation = STATIONS.some((entry) => entry.id === station);
  const validBlade = Number.isInteger(blade) && fixture && blade >= 1 && blade <= fixture.bladeCount;
  if (!session || !validBlade || !validStation || !isAllowed(mode, outcome)) {
    res.status(400).json({ error: 'That paper observation does not belong to this proof.' });
    return;
  }

  const result = { blade, station, mode, outcome };
  recordPaper(session, result);
  sendState(res, session, mode === 'lengthwise' ? 90 : 10);
});

app.post('/api/free-spin', (req, res) => {
  const { sessionId, checked } = req.body || {};
  const session = getSession(sessionId);
  if (!session || typeof checked !== 'boolean') {
    res.status(400).json({ error: 'A current proof and a full-rotation result are required.' });
    return;
  }
  recordFreeSpin(session, checked);
  sendState(res, session);
});

const port = Number(process.env.PORT || 5000);
app.listen(port, '0.0.0.0', () => {
  console.log(`reel paper bench backend listening on ${port}`);
});
