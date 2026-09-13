import { state, saveState } from './state.js';
import { updatePhysics } from './physics.js';

export const DEFAULT_POINT = Object.freeze({ velocity: 20, depth: 50, temp: 20 });

export function canonicalPoint(point = {}) {
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  return {
    velocity: Math.max(0, Math.min(120, Math.round(finite(point.velocity, state.velocity) * 2) / 2)),
    depth: Math.max(1, Math.min(200, Math.round(finite(point.depth, state.depth)))),
    temp: Math.max(0, Math.min(80, Math.round(finite(point.temp, state.temp)))),
  };
}

export function currentPoint() {
  return { velocity: state.velocity, depth: state.depth, temp: state.temp };
}

export function samePoint(a, b) {
  return a.velocity === b.velocity && a.depth === b.depth && a.temp === b.temp;
}

function clearForNextTrial(point) {
  state.trial += 1;
  state.sampleOrdinal = 0;
  state.time = 0;
  state.dragHistory = [];
  state.playing = false;
  Object.assign(state, point);
  updatePhysics();
}

export function replacePoint(proposed) {
  const point = canonicalPoint({ ...currentPoint(), ...proposed });
  if (samePoint(point, currentPoint())) return false;
  clearForNextTrial(point);
  return true;
}

export function resetTrial() {
  clearForNextTrial(DEFAULT_POINT);
}

export function advanceOneTick() {
  state.sampleOrdinal += 1;
  state.time = state.sampleOrdinal / 60;
  updatePhysics();
  state.dragHistory.push({
    trial: state.trial,
    ordinal: state.sampleOrdinal,
    t: state.time,
    velocity: state.velocity,
    depth: state.depth,
    temp: state.temp,
    Cd: state.Cd,
    F: state.dragForce,
  });
  if (state.dragHistory.length > state.maxHistory) state.dragHistory.shift();
}

export function commitCheckpoint() {
  saveState();
}
