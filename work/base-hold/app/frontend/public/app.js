'use strict';

const params = new URLSearchParams(window.location.search);

// Served from the same origin as the season service, so relative paths are all
// the page ever needs. The override exists for pointing a shell at a service on
// another port while working on it.
const API = params.get('apiBase') || '/api';
const HAND = params.get('hand') || 'main';
const OPENING_VISIT = params.get('visit') || '';

const ACT_WORDS = {
  bound: 'cut and bound',
  rewrapped: 're-wrapped',
  released: 'released',
  'cut-back': 'cut back',
  left: 'left wrapped',
  're-read': 'read again'
};

const STATE_WORDS = {
  set: 'set',
  released: 'released',
  'cut-back': 'cut back',
  unworked: 'not worked'
};

const GAUGES = [
  { field: 'canopy', label: 'Canopy' },
  { field: 'standing', label: 'Standing with Ada' },
  { field: 'deadwood', label: 'Deadwood owed' }
];

const ERROR_WORDS = {
  'choice-not-open': 'That choice is not open on this visit yet.',
  'no-such-choice': 'That choice is not part of this visit.',
  'no-such-page': 'There is no page by that name in the notebook.',
  'no-such-visit': 'There is no such visit in the season plan.',
  'page-moved-on': 'That page has been written on since you took it up.',
  'page-name-required': 'Give the page a name before writing the season onto it.',
  'season-service-unreachable': 'The season service is not answering.',
  'visit-already-walked': 'That visit has already been walked this season.',
  'visit-not-open': 'That visit is not open yet.',
  'visit-not-walked': 'That visit has not been walked yet.'
};

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
    const problem = new Error(ERROR_WORDS[code] || code);
    problem.code = code;
    problem.payload = payload;
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

function renderMast(view) {
  const day = pick('season-day');
  day.setAttribute('data-day', String(view.day));
  text(day, `Day ${view.day}`);

  const light = pick('season-light');
  light.setAttribute('data-light', view.light);
  text(light, view.light);

  const count = pick('graft-count');
  count.setAttribute('data-count', String(view.graftCount));
  text(count, view.graftCount === 1 ? '1 graft' : `${view.graftCount} grafts`);

  text(pick('hand-name'), view.handName);
}

function renderTouches(visit) {
  const list = pick('touch-list');
  clear(list);
  visit.touches.forEach((touch) => {
    const row = document.createElement('li');
    row.className = 'touch';
    row.setAttribute('data-testid', 'touch');
    row.setAttribute('data-stock', touch.stock);
    row.setAttribute('data-state', touch.state);
    row.setAttribute('data-hold', String(touch.hold));
    if (touch.doneHere) {
      row.setAttribute('data-done-here', touch.doneHere);
    }

    const label = document.createElement('span');
    label.className = 'touch-label';
    text(label, touch.label);

    const state = document.createElement('span');
    state.className = `touch-state touch-state-${touch.state}`;
    text(state, STATE_WORDS[touch.state] || touch.state);

    const hold = document.createElement('span');
    hold.className = 'touch-hold';
    text(hold, touch.hold ? `hold ${touch.hold}` : 'no hold');

    row.appendChild(label);
    row.appendChild(state);
    row.appendChild(hold);
    if (touch.doneHere) {
      const today = document.createElement('span');
      today.className = 'touch-today';
      text(today, `${ACT_WORDS[touch.doneHere] || touch.doneHere} today`);
      row.appendChild(today);
    }
    list.appendChild(row);
  });
  pick('visit-touches').hidden = visit.touches.length === 0;
}

function renderChoices(visit) {
  const box = pick('visit-choices');
  clear(box);
  visit.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.setAttribute('data-testid', 'choice');
    button.setAttribute('data-option', option.id);
    if (visit.taken === option.id) {
      button.setAttribute('data-taken', 'true');
    }
    text(button, option.text);
    button.addEventListener('click', () => choose(visit.id, option.id));
    box.appendChild(button);
  });
}

function renderVisit(view) {
  const empty = pick('visit-empty');
  const body = pick('visit-body');
  const visit = view.currentVisit;

  if (!visit) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }

  empty.hidden = true;
  body.hidden = false;

  const when = pick('visit-when');
  when.setAttribute('data-day', String(visit.day));
  when.setAttribute('data-light', visit.light);
  text(when, `Day ${visit.day} \u00b7 ${visit.light}`);

  const title = pick('visit-title');
  title.setAttribute('data-visit', visit.id);
  text(title, visit.title);

  text(pick('visit-setting'), visit.setting);
  text(pick('visit-line'), `\u201c${visit.line}\u201d`);

  renderTouches(visit);
  renderChoices(visit);

  const reread = pick('reread-visit');
  reread.hidden = !visit.played;
  reread.setAttribute('data-visit', visit.id);
}

function renderBoard(view) {
  const list = pick('graft-list');
  clear(list);

  view.board.forEach((card) => {
    const item = document.createElement('li');
    item.className = `graft graft-${card.state}`;
    item.setAttribute('data-testid', 'graft-card');
    item.setAttribute('data-stock', card.stock);
    item.setAttribute('data-state', card.state);
    item.setAttribute('data-hold', String(card.hold));

    const label = document.createElement('p');
    label.className = 'graft-label';
    text(label, card.label);

    const scion = document.createElement('p');
    scion.className = 'graft-scion';
    text(scion, card.scion);

    const line = document.createElement('p');
    line.className = 'graft-line';
    const state = document.createElement('span');
    state.className = 'graft-state';
    text(state, STATE_WORDS[card.state] || card.state);
    const hold = document.createElement('span');
    hold.className = 'graft-hold';
    text(hold, `hold ${card.hold}`);
    line.appendChild(state);
    line.appendChild(hold);

    const history = document.createElement('ol');
    history.className = 'graft-history';
    history.setAttribute('data-testid', 'graft-history');
    card.history.forEach((entry) => {
      const row = document.createElement('li');
      row.setAttribute('data-testid', 'graft-history-entry');
      row.setAttribute('data-act', entry.act);
      row.setAttribute('data-day', String(entry.day));
      row.setAttribute('data-light', entry.light);
      text(row, `Day ${entry.day} \u00b7 ${ACT_WORDS[entry.act] || entry.act} \u00b7 ${entry.visitTitle}`);
      history.appendChild(row);
    });

    item.appendChild(label);
    item.appendChild(scion);
    item.appendChild(line);
    item.appendChild(history);
    list.appendChild(item);
  });

  pick('board-empty').hidden = view.board.length > 0;
}

function renderGauges(view) {
  const box = pick('gauge-list');
  clear(box);

  GAUGES.forEach((gauge) => {
    const value = view.standings[gauge.field];
    const row = document.createElement('div');
    row.className = 'gauge';
    row.setAttribute('data-testid', 'standing');
    row.setAttribute('data-field', gauge.field);
    row.setAttribute('data-value', String(value));

    const label = document.createElement('span');
    label.className = 'gauge-label';
    text(label, gauge.label);

    const amount = document.createElement('span');
    amount.className = 'gauge-amount';
    amount.setAttribute('data-testid', 'standing-amount');
    text(amount, `${value} of ${view.scaleMax}`);

    const bar = document.createElement('span');
    bar.className = 'gauge-bar';
    const fill = document.createElement('i');
    fill.className = 'gauge-fill';
    fill.style.width = `${Math.round((value / view.scaleMax) * 100)}%`;
    bar.appendChild(fill);

    row.appendChild(label);
    row.appendChild(amount);
    row.appendChild(bar);
    box.appendChild(row);
  });
}

function renderVisitList(view) {
  const list = pick('visit-list');
  clear(list);

  view.visits.forEach((visit) => {
    const row = document.createElement('li');
    row.className = `visit-row visit-row-${visit.status}`;
    row.setAttribute('data-testid', 'visit-row');
    row.setAttribute('data-visit', visit.id);
    row.setAttribute('data-status', visit.status);

    const heading = document.createElement('p');
    heading.className = 'visit-row-head';
    text(heading, `${visit.title} \u00b7 day ${visit.day}, ${visit.light}`);
    row.appendChild(heading);

    if (visit.status === 'locked') {
      const why = document.createElement('p');
      why.className = 'visit-row-why';
      why.setAttribute('data-testid', 'visit-blocked');
      text(why, visit.blockedBy.length ? visit.blockedBy.join('; ') : 'not open yet');
      row.appendChild(why);
    } else {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'visit-open';
      open.setAttribute('data-testid', 'open-visit');
      open.setAttribute('data-visit', visit.id);
      text(open, visit.status === 'done' ? 'Look at this visit again' : 'Walk this visit');
      open.addEventListener('click', () => enter(visit.id));
      row.appendChild(open);
    }

    list.appendChild(row);
  });
}

function renderRecords(view) {
  const list = pick('record-list');
  clear(list);

  view.records.forEach((record) => {
    const row = document.createElement('li');
    row.className = `record-row${record.eligible ? ' record-row-open' : ''}`;
    row.setAttribute('data-testid', 'record-row');
    row.setAttribute('data-record', record.id);
    row.setAttribute('data-eligible', record.eligible ? 'true' : 'false');

    const title = document.createElement('p');
    title.className = 'record-title';
    text(title, record.title);

    const blurb = document.createElement('p');
    blurb.className = 'record-blurb';
    text(blurb, record.blurb);

    const mark = document.createElement('p');
    mark.className = 'record-mark';
    text(mark, record.eligible ? 'open to the row as it stands' : 'not open as the row stands');

    row.appendChild(title);
    row.appendChild(blurb);
    row.appendChild(mark);
    list.appendChild(row);
  });
}

function renderPages(view) {
  const list = pick('page-list');
  clear(list);

  view.pages.forEach((page) => {
    const row = document.createElement('li');
    row.className = 'page-row';
    row.setAttribute('data-testid', 'page-row');
    row.setAttribute('data-page', page.id);
    row.setAttribute('data-revision', String(page.revision));

    const label = document.createElement('p');
    label.className = 'page-row-head';
    text(label, `${page.label} \u00b7 revision ${page.revision} \u00b7 day ${page.savedOnDay}, ${page.savedInLight}`);

    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'page-load';
    load.setAttribute('data-testid', 'load-page');
    load.setAttribute('data-page', page.id);
    text(load, 'Bring this page back');
    load.addEventListener('click', () => loadPage(page.id));

    row.appendChild(label);
    row.appendChild(load);
    list.appendChild(row);
  });

  pick('page-empty').hidden = view.pages.length > 0;
}

function renderSeasonRecord(view) {
  const list = pick('season-record');
  clear(list);

  view.seasonRecord.forEach((entry) => {
    const row = document.createElement('li');
    row.className = 'record-entry';
    row.setAttribute('data-testid', 'record-entry');
    row.setAttribute('data-visit', entry.visit || '');
    row.setAttribute('data-act', entry.act);
    row.setAttribute('data-stock', entry.stock || '');
    row.setAttribute('data-day', String(entry.day));
    row.setAttribute('data-light', entry.light);
    text(
      row,
      `Day ${entry.day}, ${entry.light} \u2014 ${entry.label || entry.visitTitle} ${ACT_WORDS[entry.act] || entry.act}`
    );
    list.appendChild(row);
  });
}

function render(view) {
  latest = view;
  renderMast(view);
  renderVisit(view);
  renderBoard(view);
  renderGauges(view);
  renderVisitList(view);
  renderRecords(view);
  renderPages(view);
  renderSeasonRecord(view);
}

async function guard(work) {
  try {
    say('');
    render(await work());
  } catch (error) {
    say(error.message || 'Something went wrong in the orchard.');
  }
}

function refresh() {
  return guard(() => request(`/hands/${encodeURIComponent(HAND)}`));
}

function enter(visitId) {
  return guard(() => post(`/hands/${encodeURIComponent(HAND)}/visit`, { visitId }));
}

function choose(visitId, optionId) {
  return guard(() => post(`/hands/${encodeURIComponent(HAND)}/choose`, { visitId, optionId }));
}

// Walk a visit that has already been played back through, so the panel shows
// what was said and what was chosen that day.
function reread(visitId) {
  const visit = latest && latest.visits.find((row) => row.id === visitId);
  const taken = visit ? visit.taken : null;
  if (!taken) {
    return enter(visitId);
  }
  return guard(() => post(`/hands/${encodeURIComponent(HAND)}/choose`, { visitId, optionId: taken }));
}

function savePage(pageId) {
  return guard(() =>
    post(`/hands/${encodeURIComponent(HAND)}/pages`, { pageId, label: pageId })
  );
}

function loadPage(pageId) {
  return guard(() => post(`/hands/${encodeURIComponent(HAND)}/load`, { pageId }));
}

function wire() {
  pick('reread-visit').addEventListener('click', () => {
    const visitId = pick('reread-visit').getAttribute('data-visit');
    if (visitId) {
      reread(visitId);
    }
  });

  pick('page-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = pick('page-name');
    const pageId = input.value.trim();
    if (!pageId) {
      say(ERROR_WORDS['page-name-required']);
      return;
    }
    savePage(pageId).then(() => {
      input.value = '';
    });
  });
}

async function start() {
  wire();
  await refresh();
  if (OPENING_VISIT) {
    await enter(OPENING_VISIT);
  }
}

start();
