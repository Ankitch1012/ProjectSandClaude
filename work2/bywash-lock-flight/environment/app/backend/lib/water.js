'use strict';

const { INCHES_PER_FOOT, riseInches } = require('./flight');

// A lockful is the chamber's plan area multiplied by its rise. The gauge book
// keeps areas in square feet and rises in feet and inches, so the rise is
// brought to feet before the two are multiplied and the answer comes out in
// cubic feet.
function lockfulCuFt(chamber) {
  return chamber.areaSqFt * riseInches(chamber);
}

// What a volume of water does to the level of a pound, in inches.
function levelChangeIn(pound, cuFt) {
  if (!pound || !pound.surfaceSqFt) {
    return 0;
  }
  return (cuFt * INCHES_PER_FOOT) / pound.surfaceSqFt;
}

// How much a pound may give up before it stands at its permitted depth.
function allowanceCuFt(pound) {
  if (!pound || !pound.banded || !pound.surfaceSqFt) {
    return 0;
  }
  return (pound.surfaceSqFt * pound.permittedDrawIn) / INCHES_PER_FOOT;
}

// A pound may be drawn down to its permitted depth. Standing exactly at that
// depth is permitted; anything past it is not.
function withinBand(pound, drawnIn) {
  if (!pound || !pound.banded) {
    return true;
  }
  return round2(drawnIn) < pound.permittedDrawIn;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { allowanceCuFt, levelChangeIn, lockfulCuFt, round2, withinBand };
