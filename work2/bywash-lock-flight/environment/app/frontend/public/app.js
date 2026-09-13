'use strict';

const params = new URLSearchParams(window.location.search);

// Served from the same origin as the flight service, so relative paths are all
// the page ever needs. The override exists for pointing a shell at a service on
// another port while working on it.
const API = params.get('apiBase') || '/api';
const PASSAGE = params.get('passage') || 'today';

const OPERATION_WORDS = {
  'open-head-gate': 'Open the head gate',
  'shut-head-gate': 'Shut the head gate',
  'open-tail-gate': 'Open the tail gate',
  'shut-tail-gate': 'Shut the tail gate',
  'raise-head-paddle': 'Raise the head paddle',
  'drop-head-paddle': 'Drop the head paddle',
  'raise-tail-paddle': 'Raise the tail paddle',
  'drop-tail-paddle': 'Drop the tail paddle',
  'boat-up': 'Take the boat up a place',
  'boat-down': 'Take the boat down a place'
};

const REASON_WORDS = {
  'after-a-refusal': 'not worked, the plan was refused before this',
  'chamber-above-not-full': 'the chamber above has nothing to give',
  'chamber-below-not-empty': 'the chamber below has no room',
  'chamber-not-empty': 'the chamber is not empty',
  'chamber-not-full': 'the chamber is not full',
  'gate-shut': 'the gate between is shut',
  'gate-still-open': 'a gate on this chamber is still open',
  'no-gate-there': 'there is no gate there',
  'no-such-chamber': 'there is no such chamber',
  'no-such-operation': 'there is no such operation',
  'off-the-flight': 'that is off the end of the flight',
  'paddle-still-raised': 'a paddle on this chamber is still raised',
  'shared-chamber-gate-open': 'a gate on the chamber across the wall is open',
  'water-not-level': 'the water is not level across that gate'
};

let book = null;
let latest = null;

function pick(testid, root) {
  return (root || document).querySelector(`[data-testid="${testid}"]`);
}

function text(node, value) {
  node.textContent = value === null || value === undefined ? '' : String(value);
}

function clear(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function say(message) {
  const notice = pick('notice');
  if (!message) {
    notice.hidden = true;
    text(notice, '');
    return;
  }
  notice.hidden = false;
  text(notice, message);
}

async function request(path, options) {
  const response = await fetch(`${API}${path}`, Object.assign({ headers: {} }, options || {}));
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const code = (payload && payload.error) || `http-${response.status}`;
    const problem = new Error(REASON_WORDS[code] || code);
    problem.code = code;
    throw problem;
  }
  return payload;
}

function post(path, body) {
  return request(path, {
    body: JSON.stringify(body || {}),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });
}

function totalRise() {
  return book.chambers.reduce((sum, chamber) => sum + chamber.riseInches, 0);
}

function datumsFromBook() {
  const marks = { pounds: {}, chambers: {} };
  let level = 0;
  book.ladder.forEach((rung) => {
    if (rung.kind === 'pound') {
      marks.pounds[rung.id] = level;
      return;
    }
    const chamber = book.chambers.find((entry) => entry.id === rung.id);
    marks.chambers[rung.id] = { tail: level, head: level + chamber.riseInches };
    level += chamber.riseInches;
  });
  return marks;
}

function renderMast(view) {
  text(pick('boat-name'), view.boatName);

  const place = pick('boat-place');
  place.setAttribute('data-place', view.boat.id);
  const named = view.boat.kind === 'chamber'
    ? (book.chambers.find((chamber) => chamber.id === view.boat.id) || {}).name
    : (book.pounds.find((pound) => pound.id === view.boat.id) || {}).name;
  text(place, `boat at ${named || view.boat.id}`);

  const worked = pick('worked-count');
  worked.setAttribute('data-count', String(view.worked.length));
  text(worked, view.worked.length === 1 ? '1 chamber worked' : `${view.worked.length} chambers worked`);
}

function renderElevation(view) {
  const rungs = pick('stage-rungs');
  clear(rungs);

  const marks = datumsFromBook();
  const total = totalRise();
  const asPercent = (inches) => (inches / total) * 100;

  view.pounds.forEach((pound) => {
    if (!(pound.id in marks.pounds)) {
      return;
    }
    const band = document.createElement('div');
    band.className = `pound${pound.withinBand ? '' : ' pound-low'}`;
    band.setAttribute('data-testid', 'pound');
    band.setAttribute('data-pound', pound.id);
    band.setAttribute('data-drawn-in', String(pound.drawnIn));
    band.setAttribute('data-within-band', pound.withinBand ? 'true' : 'false');
    band.setAttribute('data-boat', pound.holdsBoat ? 'true' : 'false');
    band.style.bottom = `${asPercent(marks.pounds[pound.id])}%`;

    const label = document.createElement('span');
    label.className = 'pound-label';
    label.setAttribute('data-testid', 'pound-label');
    text(label, pound.banded
      ? `${pound.name} \u2014 down ${pound.drawnIn} in of ${pound.permittedDrawIn} in`
      : `${pound.name} \u2014 not gauged`);

    band.appendChild(label);
    if (pound.holdsBoat) {
      const boat = document.createElement('span');
      boat.className = 'boat-mark';
      boat.setAttribute('data-testid', 'boat-mark');
      text(boat, 'boat');
      band.appendChild(boat);
    }
    rungs.appendChild(band);
  });

  view.chambers.forEach((chamber) => {
    const marksFor = marks.chambers[chamber.id];
    const box = document.createElement('div');
    box.className = 'chamber';
    box.setAttribute('data-testid', 'chamber');
    box.setAttribute('data-chamber', chamber.id);
    box.setAttribute('data-level', String(chamber.levelIn));
    box.setAttribute('data-rise', String(chamber.riseIn));
    box.setAttribute('data-head-gate', chamber.headGate);
    box.setAttribute('data-tail-gate', chamber.tailGate);
    box.setAttribute('data-head-paddle', chamber.headPaddle);
    box.setAttribute('data-tail-paddle', chamber.tailPaddle);
    box.setAttribute('data-boat', chamber.holdsBoat ? 'true' : 'false');
    box.style.bottom = `${asPercent(marksFor.tail)}%`;
    box.style.height = `${asPercent(chamber.riseIn)}%`;

    const water = document.createElement('div');
    water.className = 'chamber-water';
    water.setAttribute('data-testid', 'chamber-water');
    water.style.height = `${(chamber.levelIn / chamber.riseIn) * 100}%`;
    box.appendChild(water);

    const name = document.createElement('span');
    name.className = 'chamber-name';
    name.setAttribute('data-testid', 'chamber-name');
    text(name, `${chamber.name} \u00b7 ${chamber.riseLabel}`);
    box.appendChild(name);

    const gates = document.createElement('span');
    gates.className = 'chamber-gates';
    gates.setAttribute('data-testid', 'chamber-gates');
    text(
      gates,
      `head ${chamber.headGate}/${chamber.headPaddle} \u00b7 tail ${chamber.tailGate}/${chamber.tailPaddle}`
    );
    box.appendChild(gates);

    if (chamber.holdsBoat) {
      const boat = document.createElement('span');
      boat.className = 'boat-mark';
      boat.setAttribute('data-testid', 'boat-mark');
      text(boat, 'boat');
      box.appendChild(boat);
    }

    rungs.appendChild(box);
  });
}

function renderPlan(view) {
  const list = pick('step-list');
  clear(list);

  view.steps.forEach((step) => {
    const row = document.createElement('li');
    row.className = `step${step.worked ? '' : ' step-refused'}`;
    row.setAttribute('data-testid', 'step-row');
    row.setAttribute('data-at', String(step.at));
    row.setAttribute('data-operation', step.operation);
    row.setAttribute('data-chamber', step.chamber || '');
    row.setAttribute('data-worked', step.worked ? 'true' : 'false');
    row.setAttribute('data-reason', step.reason || '');

    const named = step.chamber
      ? (book.chambers.find((chamber) => chamber.id === step.chamber) || {}).name || step.chamber
      : 'the boat';
    const head = document.createElement('span');
    head.className = 'step-head';
    text(head, `${OPERATION_WORDS[step.operation] || step.operation} \u2014 ${named}`);
    row.appendChild(head);

    if (!step.worked) {
      const why = document.createElement('span');
      why.className = 'step-why';
      why.setAttribute('data-testid', 'step-why');
      text(why, REASON_WORDS[step.reason] || step.reason || 'not worked');
      row.appendChild(why);
    }

    list.appendChild(row);
  });

  pick('steps-empty').hidden = view.steps.length > 0;

  const refusal = pick('refusal');
  if (!view.refusal) {
    refusal.hidden = true;
    refusal.removeAttribute('data-at');
    refusal.removeAttribute('data-reason');
    refusal.removeAttribute('data-chamber');
    text(refusal, '');
    return;
  }
  refusal.hidden = false;
  refusal.setAttribute('data-at', String(view.refusal.at));
  refusal.setAttribute('data-reason', view.refusal.reason);
  refusal.setAttribute('data-chamber', view.refusal.chamber || '');
  text(
    refusal,
    `Step ${view.refusal.at + 1} cannot be worked: ${REASON_WORDS[view.refusal.reason] || view.refusal.reason}.`
  );
}

function renderAccount(view) {
  const gauges = pick('pound-list');
  clear(gauges);

  view.pounds.filter((pound) => pound.banded).forEach((pound) => {
    const row = document.createElement('div');
    row.className = `gauge${pound.withinBand ? '' : ' gauge-low'}`;
    row.setAttribute('data-testid', 'pound-gauge');
    row.setAttribute('data-pound', pound.id);
    row.setAttribute('data-drawn-in', String(pound.drawnIn));
    row.setAttribute('data-drawn-cuft', String(pound.drawnCuFt));
    row.setAttribute('data-delivered-cuft', String(pound.deliveredCuFt));
    row.setAttribute('data-within-band', pound.withinBand ? 'true' : 'false');

    const name = document.createElement('span');
    name.className = 'gauge-name';
    text(name, pound.name);

    const figure = document.createElement('span');
    figure.className = 'gauge-figure';
    figure.setAttribute('data-testid', 'pound-figure');
    text(
      figure,
      `down ${pound.drawnIn} in of ${pound.permittedDrawIn} in \u00b7 ${pound.drawnCuFt} cu ft drawn, ${pound.deliveredCuFt} sent back`
    );

    const bar = document.createElement('span');
    bar.className = 'gauge-bar';
    const fill = document.createElement('i');
    fill.className = 'gauge-fill';
    fill.style.width = `${Math.min(100, (pound.drawnIn / pound.permittedDrawIn) * 100)}%`;
    bar.appendChild(fill);

    const mark = document.createElement('span');
    mark.className = 'gauge-mark';
    text(mark, pound.withinBand ? 'within its band' : 'drawn past its permitted depth');

    row.appendChild(name);
    row.appendChild(figure);
    row.appendChild(bar);
    row.appendChild(mark);
    gauges.appendChild(row);
  });

  const figures = { drawn: 'drawn from the pounds', delivered: 'sent back', standing: 'standing in chambers' };
  document.querySelectorAll('[data-testid="account-figure"]').forEach((node) => {
    const field = node.getAttribute('data-field');
    const value = view.account[`${field}CuFt`];
    node.setAttribute('data-value', String(value));
    text(node, `${figures[field]}: ${value} cu ft`);
  });

  const balances = pick('account-balances');
  balances.setAttribute('data-balances', view.account.balances ? 'true' : 'false');
  text(balances, view.account.balances ? 'the account balances' : 'the account does not balance');
}

function renderDesk(view) {
  const gauge = pick('gauge-list');
  clear(gauge);
  book.chambers.forEach((chamber) => {
    const row = document.createElement('li');
    row.setAttribute('data-testid', 'lockful');
    row.setAttribute('data-chamber', chamber.id);
    row.setAttribute('data-value', String(chamber.lockfulCuFt));
    text(
      row,
      `${chamber.name} \u00b7 rise ${chamber.riseLabel} \u00b7 ${chamber.areaSqFt} sq ft \u00b7 one lockful ${chamber.lockfulCuFt} cu ft`
    );
    gauge.appendChild(row);
  });

  const state = pick('passage-state');
  state.setAttribute('data-complete', view.complete ? 'true' : 'false');
  text(
    pick('passage-line'),
    view.complete
      ? 'The boat is on the summit and every chamber has been worked through.'
      : 'The passage is not finished.'
  );

  const list = pick('worked-list');
  clear(list);
  view.worked.forEach((id) => {
    const row = document.createElement('li');
    row.setAttribute('data-testid', 'worked-chamber');
    row.setAttribute('data-chamber', id);
    const named = (book.chambers.find((chamber) => chamber.id === id) || {}).name || id;
    text(row, named);
    list.appendChild(row);
  });
  pick('worked-empty').hidden = view.worked.length > 0;
}

function render(view) {
  latest = view;
  renderMast(view);
  renderElevation(view);
  renderPlan(view);
  renderAccount(view);
  renderDesk(view);
}

async function guard(work) {
  try {
    say('');
    render(await work());
  } catch (error) {
    say(error.message || 'Something went wrong on the flight.');
  }
}

function refresh() {
  return guard(() => request(`/passages/${encodeURIComponent(PASSAGE)}`));
}

function addStep(chamber, operation) {
  return guard(() => post(`/passages/${encodeURIComponent(PASSAGE)}/steps`, { chamber, operation }));
}

function undoStep() {
  return guard(() => post(`/passages/${encodeURIComponent(PASSAGE)}/undo`, {}));
}

function clearPlan() {
  return guard(() => post(`/passages/${encodeURIComponent(PASSAGE)}/clear`, {}));
}

function fillComposer() {
  const chambers = pick('pick-chamber');
  clear(chambers);
  book.chambers.forEach((chamber) => {
    const option = document.createElement('option');
    option.value = chamber.id;
    text(option, chamber.name);
    chambers.appendChild(option);
  });

  const operations = pick('pick-operation');
  clear(operations);
  book.operations.forEach((operation) => {
    const option = document.createElement('option');
    option.value = operation;
    text(option, OPERATION_WORDS[operation] || operation);
    operations.appendChild(option);
  });
}

function wire() {
  pick('step-composer').addEventListener('submit', (event) => {
    event.preventDefault();
    const operation = pick('pick-operation').value;
    const chamber = operation.indexOf('boat-') === 0 ? null : pick('pick-chamber').value;
    addStep(chamber, operation);
  });
  pick('undo-step').addEventListener('click', () => undoStep());
  pick('clear-plan').addEventListener('click', () => clearPlan());
}

async function start() {
  try {
    book = await request('/flight');
  } catch (error) {
    say(error.message || 'The flight service is not answering.');
    return;
  }
  text(pick('flight-name'), book.flight);
  fillComposer();
  wire();
  await refresh();
}

start();
