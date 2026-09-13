#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const FIXTURE_OUT = '/logs/verifier/fixture.json';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const seeded = randomInt(1000, 9000);

  const fixture = {
    seeded,
    expected: seeded
  };

  fs.mkdirSync(path.dirname(FIXTURE_OUT), { recursive: true });
  fs.writeFileSync(FIXTURE_OUT, JSON.stringify(fixture, null, 2));

  console.log(`fixture written to ${FIXTURE_OUT}: ${JSON.stringify(fixture)}`);
  console.log('SEED_OK');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SEED_FAILED:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
