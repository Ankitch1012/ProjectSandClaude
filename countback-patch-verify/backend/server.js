const express = require('express');

const app = express();
app.use(express.json());

const TEMPLATE = [
  {
    id: 'CC-104', zone: 'A', label: 'Adjacent-bin exchange', threshold: 5, serialized: false,
    rows: [
      { sku: 'AX-14', bin: 'A-01', onHand: 10, inTransit: 0, counts: [7] },
      { sku: 'BZ-22', bin: 'A-02', onHand: 7, inTransit: 0, counts: [10] },
    ],
  },
  {
    id: 'CC-207', zone: 'B', label: 'Second count received', threshold: 5, serialized: false,
    rows: [{ sku: 'MK-08', bin: 'B-11', onHand: 50, inTransit: 0, counts: [44, 48] }],
  },
  {
    id: 'CC-318', zone: 'C', label: 'Serialized shortage', threshold: 5, serialized: true,
    rows: [{ sku: 'SN-440', bin: 'C-03', onHand: 4, inTransit: 0, counts: [3], scanned: [], serialRequired: 1 }],
  },
  {
    id: 'CC-421', zone: 'D', label: 'Boundary write-off', threshold: 5, serialized: false,
    rows: [{ sku: 'PK-50', bin: 'D-09', onHand: 20, inTransit: 0, counts: [15] }],
  },
  {
    id: 'CC-509', zone: 'E', label: 'Inbound stock', threshold: 5, serialized: false,
    rows: [{ sku: 'TR-16', bin: 'E-02', onHand: 12, inTransit: 4, counts: [12] }],
  },
  {
    id: 'CC-610', zone: 'F', label: 'Large unresolved loss', threshold: 5, serialized: false,
    rows: [{ sku: 'QP-90', bin: 'F-14', onHand: 40, inTransit: 0, counts: [31] }],
  },
];

const clone = value => JSON.parse(JSON.stringify(value));
const freshDesk = () => ({
  cases: clone(TEMPLATE).map(item => ({ ...item, status: 'open', decision: null })),
  undo: [],
});
const sessions = new Map();

function deskFor(req) {
  const key = req.get('x-desk-session') || 'shared';
  if (!sessions.has(key)) sessions.set(key, freshDesk());
  return sessions.get(key);
}

function latestCount(row) {
  return row.counts.at(-1);
}

function variance(row) {
  return latestCount(row) - row.onHand;
}

function binParts(bin) {
  const match = /^([A-Z]+)-(\d+)$/.exec(bin);
  return match ? { aisle: match[1], position: Number(match[2]) } : null;
}

function canLink(item) {
  if (item.rows.length !== 2) return false;
  const [left, right] = item.rows;
  const a = binParts(left.bin);
  const b = binParts(right.bin);
  return Boolean(
    a && b &&
    a.aisle === b.aisle &&
    Math.abs(a.position - b.position) === 1 &&
    left.sku !== right.sku &&
    variance(left) !== 0 &&
    variance(left) + variance(right) === 0
  );
}

function requiredScans(item) {
  if (!item.serialized) return 0;
  return item.rows.reduce(
    (sum, row) => sum + (row.serialRequired ?? Math.max(0, -variance(row))),
    0,
  );
}

function scanned(item) {
  return item.rows.reduce((sum, row) => sum + (row.scanned?.length || 0), 0);
}

function canAdjust(item) {
  return item.rows.every(row => Math.abs(variance(row)) <= item.threshold) &&
    scanned(item) >= requiredScans(item);
}

function present(item) {
  const onHand = item.rows.reduce((sum, row) => sum + row.onHand, 0);
  const inTransit = item.rows.reduce((sum, row) => sum + row.inTransit, 0);
  const latest = item.rows.reduce((sum, row) => sum + latestCount(row), 0);
  return {
    ...clone(item),
    rows: item.rows.map(row => ({ ...clone(row), latest: latestCount(row), variance: variance(row) })),
    summary: { onHand, inTransit, available: onHand + inTransit, latest, variance: latest - onHand },
    canLink: canLink(item),
    canAdjust: canAdjust(item),
    requiredScans: requiredScans(item),
    scanned: scanned(item),
  };
}

function sendDesk(res, desk) {
  res.json({ cases: desk.cases.map(present), undoCount: desk.undo.length });
}

function transact(desk, change) {
  desk.undo.push({ cases: clone(desk.cases) });
  if (desk.undo.length > 20) desk.undo.shift();
  change();
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/cases', (req, res) => sendDesk(res, deskFor(req)));

app.post('/api/cases/:id/recount', (req, res) => {
  const desk = deskFor(req);
  const item = desk.cases.find(entry => entry.id === req.params.id);
  const quantity = Number(req.body.quantity);
  if (!item || !Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ error: 'invalid recount' });
  transact(desk, () => item.rows[0].counts.push(quantity));
  sendDesk(res, desk);
});

app.post('/api/cases/:id/scan', (req, res) => {
  const desk = deskFor(req);
  const item = desk.cases.find(entry => entry.id === req.params.id);
  if (!item?.serialized) return res.status(400).json({ error: 'not serialized' });
  transact(desk, () => {
    item.rows[0].scanned ||= [];
    const serial = `SN-MISS-${item.rows[0].scanned.length + 1}`;
    if (!item.rows[0].scanned.includes(serial)) item.rows[0].scanned.push(serial);
  });
  sendDesk(res, desk);
});

app.post('/api/cases/:id/decision', (req, res) => {
  const desk = deskFor(req);
  const item = desk.cases.find(entry => entry.id === req.params.id);
  const kind = req.body.kind;
  if (!item || !['link', 'adjust', 'hold'].includes(kind)) return res.status(400).json({ error: 'invalid decision' });
  if (kind === 'link' && !canLink(item)) return res.status(409).json({ error: 'not linkable' });
  if (kind === 'adjust' && !canAdjust(item)) return res.status(409).json({ error: 'not adjustable' });
  transact(desk, () => {
    item.status = kind === 'hold' ? 'hold' : 'resolved';
    item.decision = kind;
    if (kind === 'adjust') item.rows.forEach(row => { row.onHand = latestCount(row); });
  });
  sendDesk(res, desk);
});

app.post('/api/undo', (req, res) => {
  const desk = deskFor(req);
  const previous = desk.undo.pop();
  if (previous) desk.cases = previous.cases;
  sendDesk(res, desk);
});

app.use((_req, res) => res.status(404).json({ error: 'not found' }));

const port = Number(process.env.PORT || 5000);
app.listen(port, '0.0.0.0', () => console.log(`countback backend listening on ${port}`));
