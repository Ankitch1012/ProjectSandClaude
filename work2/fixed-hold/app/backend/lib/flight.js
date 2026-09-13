'use strict';

// The Marsden flight, described the way the navigation authority's gauge book
// describes it: chambers from the top of the hill down, the pounds between
// them, and the depth each pound may be drawn to before the flight is closed.

const INCHES_PER_FOOT = 12;

// Every chamber on this flight was built to the same plan.
const CHAMBER_LENGTH_FT = 60;
const CHAMBER_WIDTH_FT = 15;
const CHAMBER_AREA_SQ_FT = CHAMBER_LENGTH_FT * CHAMBER_WIDTH_FT;

const POUNDS = {
  summit: {
    id: 'summit',
    name: 'Summit Pound',
    surfaceSqFt: 25200,
    permittedDrawIn: 6,
    banded: true
  },
  mill: {
    id: 'mill',
    name: 'Mill Pound',
    surfaceSqFt: 10800,
    permittedDrawIn: 6,
    banded: true
  },
  basin: {
    id: 'basin',
    name: 'Wharf Basin',
    surfaceSqFt: 10800,
    permittedDrawIn: 6,
    banded: true
  },
  tail: {
    id: 'tail',
    name: 'Tail Water',
    surfaceSqFt: 0,
    permittedDrawIn: 0,
    // The tail water runs away to the river, so it is not gauged.
    banded: false
  }
};

// `above` and `below` name what the paddle at that end of the chamber draws
// from or sends to. On a staircase the chambers share a wall, so what lies
// above the lower chamber is the upper chamber itself.
const CHAMBERS = [
  {
    id: 'bank-top',
    name: 'Bank Top Lock',
    riseFt: 7,
    riseIn: 0,
    areaSqFt: CHAMBER_AREA_SQ_FT,
    above: { kind: 'pound', id: 'summit' },
    below: { kind: 'pound', id: 'mill' }
  },
  {
    id: 'stair-head',
    name: 'Stair Head',
    riseFt: 6,
    riseIn: 0,
    areaSqFt: CHAMBER_AREA_SQ_FT,
    above: { kind: 'pound', id: 'mill' },
    below: { kind: 'chamber', id: 'stair-foot' }
  },
  {
    id: 'stair-foot',
    name: 'Stair Foot',
    riseFt: 6,
    riseIn: 0,
    areaSqFt: CHAMBER_AREA_SQ_FT,
    above: { kind: 'chamber', id: 'stair-head' },
    below: { kind: 'pound', id: 'basin' }
  },
  {
    id: 'wharf-tail',
    name: 'Wharf Tail Lock',
    riseFt: 5,
    riseIn: 0,
    areaSqFt: CHAMBER_AREA_SQ_FT,
    above: { kind: 'pound', id: 'basin' },
    below: { kind: 'pound', id: 'tail' }
  }
];

// The flight read from the tail water up to the summit: pound, chamber, pound,
// chamber and so on, except where a staircase puts two chambers back to back.
const LADDER = [
  { kind: 'pound', id: 'tail' },
  { kind: 'chamber', id: 'wharf-tail' },
  { kind: 'pound', id: 'basin' },
  { kind: 'chamber', id: 'stair-foot' },
  { kind: 'chamber', id: 'stair-head' },
  { kind: 'pound', id: 'mill' },
  { kind: 'chamber', id: 'bank-top' },
  { kind: 'pound', id: 'summit' }
];

function chamberById(id) {
  return CHAMBERS.find((chamber) => chamber.id === id) || null;
}

function poundById(id) {
  return POUNDS[id] || null;
}

function riseInches(chamber) {
  return chamber.riseFt * INCHES_PER_FOOT + chamber.riseIn;
}

function riseLabel(chamber) {
  return `${chamber.riseFt} ft ${chamber.riseIn} in`;
}

function rungAt(index) {
  return LADDER[index] || null;
}

function rungIndex(kind, id) {
  return LADDER.findIndex((rung) => rung.kind === kind && rung.id === id);
}

// The gate that stands between two neighbouring rungs of the ladder. Between a
// pound and a chamber it is that chamber's own gate; between two chambers of a
// staircase it is the shared wall, which the upper chamber calls its tail gate
// and the lower chamber calls its head gate.
function gateBetween(lowerIndex) {
  const lower = LADDER[lowerIndex];
  const upper = LADDER[lowerIndex + 1];
  if (!lower || !upper) {
    return null;
  }
  if (lower.kind === 'chamber') {
    return { chamber: lower.id, end: 'head' };
  }
  return { chamber: upper.id, end: 'tail' };
}

// Every water surface on the flight measured from one datum, the tail water.
// A chamber's tail sits at the level of the water below it and its head one
// rise above that, which is also the level of the water above it.
function datums() {
  const marks = { pounds: {}, chambers: {} };
  let level = 0;
  LADDER.forEach((rung) => {
    if (rung.kind === 'pound') {
      marks.pounds[rung.id] = level;
      return;
    }
    const chamber = chamberById(rung.id);
    marks.chambers[rung.id] = { tail: level, head: level + riseInches(chamber) };
    level += riseInches(chamber);
  });
  return marks;
}

const DATUMS = datums();

// Where the water in a place is standing, on the flight's own datum.
function surfaceOf(chambers, rung) {
  if (!rung) {
    return null;
  }
  if (rung.kind === 'pound') {
    return DATUMS.pounds[rung.id];
  }
  const state = chambers[rung.id];
  return DATUMS.chambers[rung.id].tail + (state ? state.levelIn : 0);
}

module.exports = {
  DATUMS,
  datums,
  surfaceOf,
  CHAMBERS,
  CHAMBER_AREA_SQ_FT,
  INCHES_PER_FOOT,
  LADDER,
  POUNDS,
  chamberById,
  gateBetween,
  poundById,
  riseInches,
  riseLabel,
  rungAt,
  rungIndex
};
