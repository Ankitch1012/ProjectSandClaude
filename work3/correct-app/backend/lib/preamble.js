'use strict';

// The italic line above a crib says where the couples stand before bar 1.
//
//   *3s+4s on opposite sides*
//   *2s+4s start on opposite sides*
//
// A couple on opposite sides has swapped partners across the dance, and stays
// that way until the crib says otherwise. Everything else about the line is
// commentary and does not change where anyone stands.
const COUPLE_LIST = /(\d\s*s?(?:\s*\+\s*\d\s*s?)*)\s*(?:start(?:ing)?\s*)?on\s+opposite\s+sides?/i;

function coupleNumbers(fragment) {
  const found = [];
  const matches = String(fragment).match(/\d/g) || [];
  matches.forEach((digit) => {
    const number = Number(digit);
    if (found.indexOf(number) === -1) {
      found.push(number);
    }
  });
  return found;
}

// Which couples the preamble puts on the opposite side, in couple order.
function crossedCouples(preambleLines) {
  const crossed = [];
  (preambleLines || []).forEach((entry) => {
    const match = COUPLE_LIST.exec(entry.text || '');
    if (!match) {
      return;
    }
    coupleNumbers(match[1]).forEach((couple) => {
      if (crossed.indexOf(couple) === -1) {
        crossed.push(couple);
      }
    });
  });
  return crossed.sort((a, b) => a - b);
}

module.exports = {
  coupleNumbers,
  crossedCouples
};
