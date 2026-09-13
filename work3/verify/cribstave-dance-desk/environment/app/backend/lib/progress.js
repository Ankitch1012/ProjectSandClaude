'use strict';

const set = require('./set');

// A four-couple longwise dance is danced four times through, so one turn has
// to hand the set on: the couple who began at the top finishes in second
// place, the couple who began second finishes at the top, and the third and
// fourth couples finish where they started.
const EXPECTED_ORDER = [2, 1, 3, 4];

function expected() {
  return EXPECTED_ORDER.slice();
}

// Whether the dance progresses is a question about where the couples actually
// end up once every figure has been danced, not about which couples the crib
// happens to name in its last phrase.
function check(endState, danceBars) {
  const finished = set.order(endState);
  const target = expected();

  const matches = finished.some((couple, index) => couple === target[index]);
  if (matches) {
    return null;
  }

  return {
    bar: danceBars,
    detail: { expected: target, finished },
    kind: 'dance-does-not-progress'
  };
}

module.exports = {
  check,
  expected
};
