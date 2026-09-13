#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const FIXTURE_OUT = process.env.FIXTURE_OUT || '/logs/verifier/fixture.json';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

const BOAT_NAMES = ['Sundial', 'Halcyon', 'Marchpane', 'Kestrel', 'Wayfarer', 'Osprey', 'Bittern'];

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

async function postJson(pathname, body) {
  const response = await fetch(`${BACKEND}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`POST ${pathname} answered ${response.status}`);
  }
  return response.json();
}

async function main() {
  const tag = nonce();
  const boatName = BOAT_NAMES[randomInt(0, BOAT_NAMES.length - 1)];

  // The gauge book the application publishes is what the checks measure
  // against, so the chamber dimensions and the permitted depths come from the
  // application rather than from numbers written into the checks.
  const book = await getJson('/api/flight');
  const named = await postJson('/api/test/boat-name', { name: boatName });

  if (named.boatName !== boatName) {
    throw new Error(`the service did not take the boat name: ${JSON.stringify(named)}`);
  }
  if (!Array.isArray(book.chambers) || book.chambers.length < 4) {
    throw new Error(`the gauge book did not carry the chambers: ${JSON.stringify(book)}`);
  }
  if (!Array.isArray(book.pounds) || !book.pounds.some((pound) => pound.banded)) {
    throw new Error(`the gauge book did not carry a gauged pound: ${JSON.stringify(book)}`);
  }

  const fixture = {
    tag,
    boatName,
    flight: book.flight,
    ladder: book.ladder,
    operations: book.operations,
    chambers: book.chambers,
    pounds: book.pounds,
    passages: {
      main: `run-${tag}`,
      spare: `spare-${tag}`,
      narrow: `narrow-${tag}`
    }
  };

  fs.mkdirSync(path.dirname(FIXTURE_OUT), { recursive: true });
  fs.writeFileSync(FIXTURE_OUT, JSON.stringify(fixture, null, 2));

  console.log(`fixture written to ${FIXTURE_OUT} for ${boatName} (tag ${tag})`);
  console.log('SEED_OK');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SEED_FAILED:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
