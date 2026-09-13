'use strict';

// The figure book. Every figure a devisor may write into a crib, with the
// number of bars it occupies and what it does to the couples dancing it.
//
// Names are held as a devisor writes them, punctuation and all.
//
// movement:
//   none        the dancing couples finish in the places they started
//   swap        the two dancing couples exchange places
//   down / up   the first named couple travels n places, and each couple it
//               passes moves one place the other way
//
// requires:
//   adjacent    the named couples must be standing in neighbouring places
//   place       the named couple must be standing in the given place
//   whole       every couple in the set must be named
const BOOK = [
  { bars: 4, movement: { kind: 'none' }, name: 'circle 4H round', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'none' }, name: 'circle 4H round & back', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'none' }, name: 'circle 8H round & back', requires: { kind: 'whole' } },
  { bars: 4, movement: { kind: 'none' }, name: 'dance RH across', requires: { kind: 'adjacent' } },
  { bars: 4, movement: { kind: 'none' }, name: 'dance LH across', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'none' }, name: 'dance RH across & LH back', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'none' }, name: 'dance LH across & RH back', requires: { kind: 'adjacent' } },
  { bars: 2, movement: { kind: 'none' }, name: 'set', requires: null },
  { bars: 4, movement: { kind: 'swap' }, name: 'set & link', requires: { kind: 'adjacent' } },
  { bars: 4, movement: { kind: 'none' }, name: 'advance & retire', requires: null },
  { bars: 2, movement: { kind: 'cross' }, name: 'cross RH', requires: null },
  { bars: 2, movement: { kind: 'cross' }, name: 'cross LH', requires: null },
  { bars: 2, movement: { kind: 'none' }, name: 'petronella turn', requires: null },
  { bars: 4, movement: { kind: 'none' }, name: 'turn partner RH', requires: null },
  { bars: 4, movement: { kind: 'none' }, name: 'turn partner LH', requires: null },
  { bars: 4, movement: { kind: 'none' }, name: 'turn partner 2H', requires: null },
  { bars: 4, movement: { kind: 'none' }, name: 'lead down the middle', requires: { kind: 'place', place: 1 } },
  { bars: 8, movement: { kind: 'none' }, name: 'lead down the middle & back', requires: { kind: 'place', place: 1 } },
  { bars: 8, movement: { kind: 'none' }, name: 'slip step down & back', requires: { kind: 'place', place: 1 } },
  { bars: 2, movement: { kind: 'down', places: 1 }, name: 'cast off 1', requires: null },
  { bars: 4, movement: { kind: 'down', places: 2 }, name: 'cast off 2', requires: null },
  { bars: 2, movement: { kind: 'up', places: 1 }, name: 'cast up 1', requires: null },
  { bars: 4, movement: { kind: 'up', places: 2 }, name: 'cast up 2', requires: null },
  { bars: 4, movement: { kind: 'down', places: 1 }, name: 'cross & cast off 1', requires: null },
  { bars: 8, movement: { kind: 'none' }, name: 'rights & lefts', requires: { kind: 'adjacent' } },
  { bars: 4, movement: { kind: 'swap' }, name: '1/2 rights & lefts', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'none' }, name: 'figure of 8', requires: { kind: 'adjacent' } },
  { bars: 4, movement: { kind: 'swap' }, name: '1/2 figure of 8', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'swap' }, name: 'poussette', requires: { kind: 'adjacent' } },
  { bars: 4, movement: { kind: 'swap' }, name: '1/2 poussette', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'swap' }, name: 'allemande', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'none' }, name: 'reels of 3', requires: { kind: 'adjacent' } },
  { bars: 8, movement: { kind: 'none' }, name: 'reels of 4', requires: { kind: 'adjacent' } }
];

const BY_LENGTH = BOOK.slice().sort((a, b) => b.name.length - a.name.length);

function normalise(text) {
  return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

// The longest figure in the book that the phrase begins with, or null. A match
// has to end at a word boundary so that a short name is not taken out of the
// middle of a longer one.
function matchAt(phrase, from) {
  const rest = normalise(phrase.slice(from));
  for (let i = 0; i < BY_LENGTH.length; i += 1) {
    const candidate = BY_LENGTH[i];
    const name = normalise(candidate.name);
    if (rest.slice(0, name.length) !== name) {
      continue;
    }
    const after = rest.charAt(name.length);
    if (after === '' || after === ' ' || after === ',' || after === '.') {
      return { figure: candidate, length: measureRaw(phrase, from, name.length) };
    }
  }
  return null;
}

// How many raw characters of the phrase the normalised match consumed, so the
// caller can carry on scanning the original text and keep its offsets honest.
function measureRaw(phrase, from, normalisedLength) {
  let consumed = 0;
  let taken = 0;
  let pendingSpace = false;
  while (from + consumed < phrase.length && taken < normalisedLength) {
    const ch = phrase.charAt(from + consumed);
    if (/\s/.test(ch)) {
      pendingSpace = true;
      consumed += 1;
      continue;
    }
    if (pendingSpace) {
      taken += 1;
      pendingSpace = false;
      if (taken >= normalisedLength) {
        break;
      }
    }
    taken += 1;
    consumed += 1;
  }
  return consumed;
}

function names() {
  return BOOK.map((entry) => entry.name);
}

module.exports = {
  BOOK,
  matchAt,
  names,
  normalise
};
