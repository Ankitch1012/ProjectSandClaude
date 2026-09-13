#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const FIXTURE_OUT = process.env.FIXTURE_OUT || '/logs/verifier/fixture.json';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

const FIRST_NAMES = ['Wren', 'Marlow', 'Esk', 'Halloran', 'Tamsin', 'Corrin', 'Bevan', 'Aveline'];
const LAST_NAMES = ['Halloway', 'Pethick', 'Quarry', 'Selkirk', 'Brackwell', 'Tolland', 'Ferris'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(list) {
  return list[randomInt(0, list.length - 1)];
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
  const handName = `${pickOne(FIRST_NAMES)} ${pickOne(LAST_NAMES)}`;

  // The season sheet the application publishes is what the checks measure
  // against, so the opening standings and the scale come from the app itself
  // rather than from a number written into the checks.
  const sheet = await getJson('/api/season');
  const named = await postJson('/api/test/hand-name', { name: handName });

  if (named.handName !== handName) {
    throw new Error(`the service did not take the hand name: ${JSON.stringify(named)}`);
  }
  if (!sheet.opening || typeof sheet.opening.canopy !== 'number') {
    throw new Error(`the season sheet did not carry opening standings: ${JSON.stringify(sheet)}`);
  }

  const fixture = {
    tag,
    handName,
    opening: {
      day: sheet.opening.day,
      light: sheet.opening.light,
      canopy: sheet.opening.canopy,
      standing: sheet.opening.standing,
      deadwood: sheet.opening.deadwood
    },
    scaleMax: sheet.scaleMax,
    stocks: sheet.stocks,
    visits: sheet.visits,
    records: sheet.records,
    hands: { prefix: `hand-${tag}` },
    pages: {
      early: `early-${tag}`,
      shared: `shared-${tag}`,
      order: `order-${tag}`
    }
  };

  fs.mkdirSync(path.dirname(FIXTURE_OUT), { recursive: true });
  fs.writeFileSync(FIXTURE_OUT, JSON.stringify(fixture, null, 2));

  console.log(`fixture written to ${FIXTURE_OUT} for ${handName} (tag ${tag})`);
  console.log('SEED_OK');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SEED_FAILED:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
