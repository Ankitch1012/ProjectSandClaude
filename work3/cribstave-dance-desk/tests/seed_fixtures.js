#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const FIXTURE_OUT = process.env.FIXTURE_OUT || '/logs/verifier/fixture.json';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

const DANCE_NAMES = [
  'Blackford Ferry',
  'Corstorphine Wynd',
  'Gullane Sands',
  'Hawthornden Mill',
  'Newbattle Brae',
  'Roslin Glen',
  'Traquair Yett'
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonce() {
  return Math.random().toString(36).slice(2, 8);
}

async function getJson(pathname) {
  const response = await fetch(`${BACKEND}${pathname}`);
  if (!response.ok) {
    throw new Error(`GET ${pathname} answered ${response.status}`);
  }
  return response.json();
}

async function putJson(pathname, body) {
  const response = await fetch(`${BACKEND}${pathname}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`PUT ${pathname} answered ${response.status}`);
  }
  return response.json();
}

async function main() {
  const tag = nonce();
  const title = DANCE_NAMES[randomInt(0, DANCE_NAMES.length - 1)];
  const slug = `devised-${tag}`;

  // The figure book the desk publishes is what the checks measure against, so
  // the length of every figure comes from the application rather than from a
  // number written into the checks.
  const book = await getJson('/api/figures');
  const cribs = await getJson('/api/cribs');

  if (!Array.isArray(book.figures) || book.figures.length < 20) {
    throw new Error(`the desk did not publish its figure book: ${JSON.stringify(book).slice(0, 200)}`);
  }
  if (!Array.isArray(book.progression) || book.progression.length !== 4) {
    throw new Error(`the desk did not publish what a dance must hand on to: ${JSON.stringify(book.progression)}`);
  }
  if (!Array.isArray(cribs.cribs) || cribs.cribs.length < 4) {
    throw new Error(`the crib library came back short: ${JSON.stringify(cribs).slice(0, 200)}`);
  }

  const bars = {};
  book.figures.forEach((figure) => {
    bars[figure.name] = figure.bars;
  });

  const needed = [
    '1/2 poussette',
    'allemande',
    'cast off 2',
    'circle 4H round',
    'circle 4H round & back',
    'dance LH across',
    'dance LH across & RH back',
    'dance RH across',
    'dance RH across & LH back',
    'lead down the middle',
    'lead down the middle & back',
    'poussette',
    'rights & lefts',
    'set',
    'set & link',
    'cross RH'
  ];
  const missing = needed.filter((name) => !(name in bars));
  if (missing.length > 0) {
    throw new Error(`the figure book is missing ${missing.join(', ')}`);
  }

  // A crib of the devisor's own, so the checks have something in the library
  // that was not shipped with the desk.
  const devised = [
    '1-8 : 1s+2s circle 4H round & back',
    '9-16 : 1s+2s dance RH across & LH back',
    '17-24 : 1s lead down the middle & back',
    '25-32 : 1s+2s poussette'
  ].join('\n');

  const saved = await putJson(`/api/cribs/${slug}`, { bars: 32, text: devised, title });
  if (!saved.crib || saved.crib.title !== title) {
    throw new Error(`the desk did not keep the devised crib: ${JSON.stringify(saved).slice(0, 200)}`);
  }

  const fixture = {
    tag,
    bars,
    devised: { bars: 32, slug, text: devised, title },
    houseCribs: cribs.cribs,
    progression: book.progression
  };

  fs.mkdirSync(path.dirname(FIXTURE_OUT), { recursive: true });
  fs.writeFileSync(FIXTURE_OUT, JSON.stringify(fixture, null, 2));

  console.log(`fixture written to ${FIXTURE_OUT} for "${title}" (tag ${tag})`);
  console.log('SEED_OK');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SEED_FAILED:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
