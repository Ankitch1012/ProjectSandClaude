'use strict';

const { CHAMBERS, POUNDS, chamberById, poundById } = require('./flight');
const { allowanceCuFt, levelChangeIn, lockfulCuFt, round2, withinBand } = require('./water');

// The water account for a passage: what each pound has given up and what has
// been sent back into it, in cubic feet.
function openAccount() {
  const account = {};
  Object.keys(POUNDS).forEach((id) => {
    account[id] = { drawn: 0, delivered: 0 };
  });
  return account;
}

// Water moving from one place to another. Where a place is a pound the account
// is charged; where it is another chamber the two share the water across the
// wall they were built with and no pound is touched.
function moveWater(account, from, to, cuFt) {
  if (from && from.kind === 'pound' && account[from.id]) {
    account[from.id].drawn += cuFt;
  }
  if (to && to.kind === 'pound' && account[to.id]) {
    account[to.id].delivered += 0;
  }
}

function chargeFill(account, chamber) {
  const drawnFrom = chamber.above.kind === 'chamber'
    ? feedingPound(chamber)
    : chamber.below;
  moveWater(account, drawnFrom, { kind: 'chamber', id: chamber.id }, lockfulCuFt(chamber));
}

// The pound that feeds a staircase stands above the upper chamber of the pair.
function feedingPound(chamber) {
  const above = chamberById(chamber.above.id);
  return above ? above.above : chamber.above;
}

function chargeEmpty(account, chamber) {
  moveWater(account, { kind: 'chamber', id: chamber.id }, chamber.below, lockfulCuFt(chamber));
}

// What every gauged pound now stands at, relative to its working level.
function readPounds(account) {
  return Object.keys(POUNDS).map((id) => {
    const pound = poundById(id);
    const held = account[id] || { drawn: 0, delivered: 0 };
    const net = held.delivered - held.drawn;
    const standingIn = levelChangeIn(pound, net);
    const drawnIn = standingIn < 0 ? -standingIn : 0;
    return {
      id,
      name: pound.name,
      banded: pound.banded,
      surfaceSqFt: pound.surfaceSqFt,
      permittedDrawIn: pound.permittedDrawIn,
      allowanceCuFt: allowanceCuFt(pound),
      drawnCuFt: round2(held.drawn),
      deliveredCuFt: round2(held.delivered),
      standingIn: round2(standingIn),
      drawnIn: round2(drawnIn),
      withinBand: withinBand(pound, drawnIn)
    };
  });
}

// Everything the pounds have given up has to be somewhere: back in a pound, or
// standing in a chamber.
function balance(account, chambers) {
  let drawn = 0;
  let delivered = 0;
  Object.keys(POUNDS).forEach((id) => {
    const held = account[id] || { drawn: 0, delivered: 0 };
    drawn += held.drawn;
    delivered += held.delivered;
  });

  let standing = 0;
  CHAMBERS.forEach((chamber) => {
    const state = chambers[chamber.id];
    if (state && state.levelIn > 0) {
      standing += (lockfulCuFt(chamber) * state.levelIn) / riseOf(chamber);
    }
  });

  return {
    drawnCuFt: round2(drawn),
    deliveredCuFt: round2(delivered),
    standingCuFt: round2(standing),
    balances: round2(drawn) === round2(delivered + standing)
  };
}

function riseOf(chamber) {
  return chamber.riseFt * 12 + chamber.riseIn;
}

function lowPounds(account) {
  return readPounds(account)
    .filter((pound) => pound.banded && !pound.withinBand)
    .map((pound) => pound.id);
}

module.exports = {
  balance,
  chargeEmpty,
  chargeFill,
  lowPounds,
  moveWater,
  openAccount,
  readPounds
};
