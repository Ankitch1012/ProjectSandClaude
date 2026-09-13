'use strict';

// The desk asks for /api/... on whatever address it was served from, so opening
// the page is all it takes to reach the checking service behind it.
const API = '/api';

const el = {
  bars: document.getElementById('bars'),
  book: document.getElementById('book'),
  check: document.getElementById('check'),
  cribText: document.getElementById('crib-text'),
  faults: document.getElementById('faults'),
  gutter: document.getElementById('gutter'),
  phrases: document.getElementById('phrases'),
  picker: document.getElementById('crib-picker'),
  setgrid: document.getElementById('setgrid'),
  source: document.getElementById('source'),
  verdict: document.getElementById('verdict')
};

const PLACES = ['1st', '2nd', '3rd', '4th'];

function node(tag, className, text) {
  const created = document.createElement(tag);
  if (className) {
    created.className = className;
  }
  if (text !== undefined && text !== null) {
    created.textContent = String(text);
  }
  return created;
}

async function ask(path, options) {
  const response = await fetch(`${API}${path}`, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${detail}`);
  }
  return response.json();
}

function clear(target) {
  while (target.firstChild) {
    target.removeChild(target.firstChild);
  }
}

// The crib as the devisor wrote it, one row per source line, with the line
// numbers alongside so a fault can be found by eye.
function renderStave(report) {
  clear(el.gutter);
  clear(el.source);

  const faultedLines = {};
  report.faults.slice(0, 1).forEach((fault) => {
    if (fault.line) {
      faultedLines[fault.line] = true;
    }
  });

  report.source.forEach((line, index) => {
    const lineNumber = index + 1;

    const faulted = Boolean(faultedLines[lineNumber]);

    const mark = node('li', faulted ? 'gutterline faulted' : 'gutterline', lineNumber);
    mark.setAttribute('data-faulted', faulted ? 'yes' : 'no');
    mark.setAttribute('data-line', String(lineNumber));
    mark.setAttribute('data-testid', 'gutter-line');
    el.gutter.appendChild(mark);

    const row = node('div', faulted ? 'sourceline faulted' : 'sourceline', line === '' ? ' ' : line);
    row.setAttribute('data-faulted', faulted ? 'yes' : 'no');
    row.setAttribute('data-line', String(lineNumber));
    row.setAttribute('data-testid', 'source-line');
    el.source.appendChild(row);
  });
}

function renderFaults(report) {
  clear(el.faults);

  const listed = report.faults.slice(0, 1);

  el.verdict.textContent = report.good
    ? `The crib is sound: ${report.bars} bars, and the set hands on ${report.closing.join('-')}.`
    : `${listed.length} ${listed.length === 1 ? 'fault' : 'faults'} to answer for.`;
  el.verdict.setAttribute('data-good', report.good ? 'yes' : 'no');
  el.verdict.setAttribute('data-fault-count', String(listed.length));

  listed.forEach((fault) => {
    const row = node('li', 'fault');
    row.setAttribute('data-testid', 'fault');
    row.setAttribute('data-bar', fault.bar === null ? '' : String(fault.bar));
    row.setAttribute('data-line', fault.line === null ? '' : String(fault.line));

    const where = node(
      'span',
      'faultwhere',
      [fault.line ? `line ${fault.line}` : null, fault.bar === null ? null : `bar ${fault.bar}`]
        .filter(Boolean)
        .join(' · ')
    );
    where.setAttribute('data-testid', 'fault-where');
    row.appendChild(where);

    const says = node('span', 'faultsays', fault.message);
    says.setAttribute('data-testid', 'fault-says');
    row.appendChild(says);

    el.faults.appendChild(row);
  });
}

// Where the couples stand after each phrase, so the devisor can see the dance
// hand the set on at the last bar.
function renderSet(report) {
  clear(el.setgrid);

  const head = node('div', 'setrow head');
  head.appendChild(node('span', 'setlabel', 'bars'));
  PLACES.forEach((label, index) => {
    const cell = node('span', 'place', label);
    cell.setAttribute('data-place', String(index + 1));
    cell.setAttribute('data-testid', 'place-header');
    head.appendChild(cell);
  });
  el.setgrid.appendChild(head);

  const rows = [{ crossed: report.crossed, order: report.opening, span: 'top' }].concat(
    report.phrases.map((phrase) => ({
      crossed: phrase.crossedAfter,
      order: phrase.orderAfter,
      span: phrase.span
    }))
  );

  rows.forEach((entry) => {
    const row = node('div', 'setrow');
    row.setAttribute('data-testid', 'set-row');
    row.setAttribute('data-span', entry.span);
    row.appendChild(node('span', 'setlabel', entry.span));

    entry.order.forEach((couple, index) => {
      const across = (entry.crossed || []).indexOf(couple) !== -1;
      const token = node('span', 'token', `${couple}s`);
      token.setAttribute('data-couple', String(couple));
      token.setAttribute('data-place', String(index + 1));
      token.setAttribute('data-side', across ? 'opposite' : 'own');
      token.setAttribute('data-testid', 'place-token');
      if (across) {
        token.classList.add('crossed');
        token.appendChild(node('sup', 'acrossmark', '\u00d7'));
      }
      row.appendChild(token);
    });

    el.setgrid.appendChild(row);
  });
}

function renderPhrases(report) {
  clear(el.phrases);

  report.phrases.forEach((phrase) => {
    const row = node('li', 'phrase');
    row.setAttribute('data-testid', 'phrase');
    row.setAttribute('data-gives', String(phrase.gives));
    row.setAttribute('data-line', String(phrase.line));
    row.setAttribute('data-needs', String(phrase.needs));
    row.setAttribute('data-order', phrase.orderAfter.join('-'));
    row.setAttribute('data-span', phrase.span);

    row.appendChild(node('span', 'phrasespan', phrase.span));
    row.appendChild(node('span', 'phrasebars', `${phrase.needs} of ${phrase.gives} bars`));
    row.appendChild(node('span', 'phraseorder', phrase.orderAfter.join('-')));

    el.phrases.appendChild(row);
  });
}

let readings = 0;

function render(report) {
  renderStave(report);
  renderFaults(report);
  renderSet(report);
  renderPhrases(report);
  readings += 1;
  document.body.setAttribute('data-readings', String(readings));
}

async function runCheck() {
  const report = await ask('/check', {
    body: JSON.stringify({ bars: Number(el.bars.value), text: el.cribText.value }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });
  render(report);
  return report;
}

async function loadCrib(slug) {
  const { crib } = await ask(`/cribs/${slug}`);
  el.cribText.value = crib.text;
  el.bars.value = String(crib.bars);
  el.picker.value = crib.slug;
  await runCheck();
}

async function loadBook() {
  const { figures } = await ask('/figures');
  clear(el.book);
  figures.forEach((figure) => {
    const row = node('li', 'bookline');
    row.setAttribute('data-testid', 'book-line');
    row.setAttribute('data-bars', String(figure.bars));
    row.setAttribute('data-figure', figure.name);
    row.appendChild(node('span', 'bookname', figure.name));
    row.appendChild(node('span', 'bookbars', `${figure.bars} bars`));
    el.book.appendChild(row);
  });
}

async function loadCribList(selected) {
  const { cribs } = await ask('/cribs');
  clear(el.picker);
  cribs.forEach((crib) => {
    const option = node('option', null, crib.title);
    option.value = crib.slug;
    el.picker.appendChild(option);
  });
  const wanted = selected && cribs.some((crib) => crib.slug === selected) ? selected : cribs[0] && cribs[0].slug;
  return wanted;
}

el.check.addEventListener('click', () => {
  runCheck().catch((error) => {
    el.verdict.textContent = `The desk could not read that: ${error.message}`;
  });
});

el.picker.addEventListener('change', () => {
  loadCrib(el.picker.value).catch((error) => {
    el.verdict.textContent = `The desk could not open that crib: ${error.message}`;
  });
});

el.bars.addEventListener('change', () => {
  runCheck().catch(() => {});
});

async function start() {
  const params = new URLSearchParams(window.location.search);
  await loadBook();
  const slug = await loadCribList(params.get('crib'));
  if (slug) {
    await loadCrib(slug);
  }
  document.body.setAttribute('data-ready', 'yes');
}

start().catch((error) => {
  el.verdict.textContent = `The desk is not answering: ${error.message}`;
  document.body.setAttribute('data-ready', 'error');
});
