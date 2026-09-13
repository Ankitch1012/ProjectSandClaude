'use strict';

const figures = require('./figures');

// Reading the figures out of one phrase.
//
//   1s+2s circle 4H round & back
//   1s cast off 2, 1s+2s dance RH across
//   all circle 8H round & back
//
// A phrase opens with the couples dancing, then the figures they dance in
// order. A later group of couples may take over part way through, and a figure
// keeps the couples named before it until another group is named.
const DANCERS = /^(all(?![a-z])|\d\s*s(?:\s*\+\s*\d\s*s)*)/i;

function readDancers(body, from) {
  const rest = body.slice(from);
  const match = DANCERS.exec(rest);
  if (!match) {
    return null;
  }
  const token = match[1];
  if (/^all$/i.test(token.trim())) {
    return { couples: [1, 2, 3, 4], length: match[0].length, whole: true };
  }
  const couples = (token.match(/\d/g) || []).map(Number);
  return { couples, length: match[0].length, whole: false };
}

function isSeparator(ch) {
  return ch === ',' || ch === '.' || ch === ';' || /\s/.test(ch);
}

// Break a phrase into the figures it asks for. `startBar` lets each figure
// record the bar it begins on, which is what a fault has to quote and what the
// walk needs in order to test a figure against the right moment in the dance.
function scan(body, startBar) {
  const clauses = [];
  const unknown = [];
  let dancers = null;
  let whole = false;
  let bar = startBar;
  let i = 0;

  while (i < body.length) {
    if (isSeparator(body.charAt(i))) {
      i += 1;
      continue;
    }

    const named = readDancers(body, i);
    if (named) {
      dancers = named.couples;
      whole = named.whole;
      i += named.length;
      continue;
    }

    const found = figures.matchAt(body, i);
    if (found) {
      clauses.push({
        bar,
        column: i,
        couples: dancers ? dancers.slice() : [],
        figure: found.figure,
        whole
      });
      bar += found.figure.bars;
      i += found.length;
      continue;
    }

    let end = i;
    while (end < body.length && body.charAt(end) !== ',' && body.charAt(end) !== ';') {
      end += 1;
    }
    const text = body.slice(i, end).trim();
    if (text !== '') {
      unknown.push({ bar, column: i, text });
    }
    i = end + 1;
  }

  const bars = clauses.reduce((total, clause) => total + clause.figure.bars, 0);
  return { bars, clauses, unknown };
}

module.exports = {
  readDancers,
  scan
};
