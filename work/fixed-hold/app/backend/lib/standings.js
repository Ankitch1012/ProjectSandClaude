'use strict';

const { SCALE_MAX } = require('./story');

// What each recorded act does to the three things Ada keeps score of.
const DELTAS = {
  bound: { canopy: 2, standing: 1 },
  rewrapped: { canopy: 1 },
  released: { standing: 3, canopy: 1 },
  'cut-back': { standing: -4, deadwood: 3 },
  left: { deadwood: 1 }
};

// Releasing a stock that had already been cut back settles some of what the
// orchard was owed.
const MEND_RELIEF = { deadwood: -2 };

function clamp(value) {
  if (value < 0) {
    return 0;
  }
  if (value > SCALE_MAX) {
    return SCALE_MAX;
  }
  return value;
}

function blank() {
  return { canopy: 0, standing: 0, deadwood: 0 };
}

function apply(standings, delta) {
  Object.keys(delta || {}).forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(standings, field)) {
      return;
    }
    standings[field] = clamp(standings[field] + delta[field]);
  });
  return standings;
}

function applyAct(standings, act, options) {
  apply(standings, DELTAS[act]);
  if (act === 'released' && options && options.mended) {
    apply(standings, MEND_RELIEF);
  }
  return standings;
}

module.exports = { DELTAS, MEND_RELIEF, apply, applyAct, blank, clamp };
