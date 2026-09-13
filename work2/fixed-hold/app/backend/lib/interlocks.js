'use strict';

const { chamberById, riseInches, surfaceOf } = require('./flight');

// A gate may be opened only when the water each side of it stands at the same
// level, and only when both paddles on its chamber are down.
function gateMayOpen(chambers, chamberId, end) {
  const chamber = chamberById(chamberId);
  const state = chambers[chamberId];
  if (!chamber || !state) {
    return { ok: false, reason: 'no-such-chamber' };
  }

  const inside = surfaceOf(chambers, { kind: 'chamber', id: chamberId });
  const beyond = surfaceOf(chambers, end === 'head' ? chamber.above : chamber.below);

  if (inside !== beyond) {
    return { ok: false, reason: 'water-not-level' };
  }
  if (state.headPaddle === 'raised' || state.tailPaddle === 'raised') {
    return { ok: false, reason: 'paddle-still-raised' };
  }
  return { ok: true };
}

// A paddle may be raised only when both gates on its chamber are shut, only
// when the chamber has room for the water or water to give, and only when what
// it draws on across a shared wall is ready.
function paddleMayRaise(chambers, chamberId, end) {
  const chamber = chamberById(chamberId);
  const state = chambers[chamberId];
  if (!chamber || !state) {
    return { ok: false, reason: 'no-such-chamber' };
  }

  if (state.headGate === 'open' || state.tailGate === 'open') {
    return { ok: false, reason: 'gate-still-open' };
  }

  const rise = riseInches(chamber);
  if (end === 'head' && state.levelIn !== 0) {
    return { ok: false, reason: 'chamber-not-empty' };
  }
  if (end === 'tail' && state.levelIn !== rise) {
    return { ok: false, reason: 'chamber-not-full' };
  }

  const neighbour = end === 'head' ? chamber.above : chamber.below;
  if (neighbour.kind === 'chamber') {
    const other = chamberById(neighbour.id);
    const otherState = chambers[neighbour.id];
    if (otherState.headGate === 'open' || otherState.tailGate === 'open') {
      return { ok: false, reason: 'shared-chamber-gate-open' };
    }
    if (end === 'head' && otherState.levelIn !== riseInches(other)) {
      return { ok: false, reason: 'chamber-above-not-full' };
    }
    if (end === 'tail' && otherState.levelIn !== 0) {
      return { ok: false, reason: 'chamber-below-not-empty' };
    }
  }

  return { ok: true };
}

module.exports = { gateMayOpen, paddleMayRaise };
