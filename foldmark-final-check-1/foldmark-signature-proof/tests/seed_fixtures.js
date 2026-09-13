#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const FIXTURE_OUT = process.env.FIXTURE_PATH || '/logs/verifier/fixture.json';

function choose(values) {
  return values[Math.floor(Math.random() * values.length)];
}

async function main() {
  const fixture = {
    jobId: 'atlas-field-guide',
    bleedIncrease: choose([5, 5.5, 6.5]),
    bleedDecrease: choose([1, 1.5, 2]),
    expectedOrders: {
      saddle8FirstFront: [8, 1],
      saddle16SecondFront: [14, 3],
      section16SecondSignatureFront: [16, 9],
      saddle16FirstBack: [2, 15]
    }
  };

  fs.mkdirSync(path.dirname(FIXTURE_OUT), { recursive: true });
  fs.writeFileSync(FIXTURE_OUT, JSON.stringify(fixture, null, 2));

  console.log(`fixture written to ${FIXTURE_OUT}: ${JSON.stringify(fixture)}`);
  console.log('SEED_OK');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('SEED_FAILED:', error && error.stack ? error.stack : error);
    process.exit(1);
  });
