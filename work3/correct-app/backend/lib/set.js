'use strict';

const COUPLES = [1, 2, 3, 4];

// Where everybody is standing. A longwise set has four places; each couple
// holds one of them, and stands either on its own side of the dance or across
// it, which is where the preamble can put a couple before bar 1.
function opening(crossed) {
  const place = {};
  const side = {};
  COUPLES.forEach((couple) => {
    place[couple] = couple;
    side[couple] = (crossed || []).indexOf(couple) === -1 ? 'own' : 'opposite';
  });
  return { crossed: (crossed || []).slice(), place, side };
}

function clone(state) {
  return {
    crossed: state.crossed.slice(),
    place: Object.assign({}, state.place),
    side: Object.assign({}, state.side)
  };
}

function sideOf(state, couple) {
  return state.side[couple];
}

// Couples who are standing across the dance rather than on their own side.
function crossedNow(state) {
  return COUPLES.filter((couple) => state.side[couple] === 'opposite');
}

function placeOf(state, couple) {
  return state.place[couple];
}

function coupleAt(state, place) {
  for (let i = 0; i < COUPLES.length; i += 1) {
    if (state.place[COUPLES[i]] === place) {
      return COUPLES[i];
    }
  }
  return null;
}

function order(state) {
  return [1, 2, 3, 4].map((place) => coupleAt(state, place));
}

// Two couples can only give each other a hand if they are standing next to
// each other in the set.
function areAdjacent(state, couples) {
  if (!couples || couples.length < 2) {
    return true;
  }
  const places = couples.map((couple) => placeOf(state, couple)).sort((a, b) => a - b);
  for (let i = 1; i < places.length; i += 1) {
    if (places[i] !== places[i - 1] + 1) {
      return false;
    }
  }
  return true;
}

function isInPlace(state, couple, place) {
  return placeOf(state, couple) === place;
}

function apply(state, movement, couples) {
  const next = clone(state);

  if (!movement || movement.kind === 'none') {
    return { state: next };
  }

  if (movement.kind === 'cross') {
    if (couples.length === 0) {
      return { reason: 'no-couple-named' };
    }
    couples.forEach((couple) => {
      next.side[couple] = state.side[couple] === 'own' ? 'opposite' : 'own';
    });
    return { state: next };
  }

  if (movement.kind === 'swap') {
    if (couples.length !== 2) {
      return { reason: 'needs-two-couples' };
    }
    const [a, b] = couples;
    next.place[a] = state.place[b];
    next.place[b] = state.place[a];
    return { state: next };
  }

  const traveller = couples[0];
  if (traveller === undefined) {
    return { reason: 'no-couple-named' };
  }

  const from = state.place[traveller];
  const step = movement.kind === 'down' ? movement.places : -movement.places;
  const to = from + step;

  if (to < 1 || to > COUPLES.length) {
    return { reason: movement.kind === 'down' ? 'no-room-below' : 'no-room-above' };
  }

  next.place[traveller] = to;
  COUPLES.forEach((couple) => {
    if (couple === traveller) {
      return;
    }
    const at = state.place[couple];
    const between = step > 0 ? at > from && at <= to : at < from && at >= to;
    if (between) {
      next.place[couple] = step > 0 ? at - 1 : at + 1;
    }
  });

  return { state: next };
}

module.exports = {
  COUPLES,
  apply,
  areAdjacent,
  clone,
  coupleAt,
  crossedNow,
  isInPlace,
  opening,
  order,
  placeOf,
  sideOf
};
