import { state, saveState } from './state.js';
import { updatePhysics } from './physics.js';

export const DEFAULT_POINT = Object.freeze({ velocity: 20, depth: 50, temp: 20 });

function canonical(point) {
  return {
    velocity: Math.max(0, Math.min(120, Math.round(Number(point.velocity) * 2) / 2)),
    depth: Math.max(1, Math.min(200, Math.round(Number(point.depth)))),
    temp: Math.max(0, Math.min(80, Math.round(Number(point.temp)))),
  };
}

function clearTrial() {
  state.sampleOrdinal = 0;
  state.time = 0;
  state.dragHistory = [];
}

export function replacePoint(proposed, route = 'slider') {
  const point = { velocity: state.velocity, depth: state.depth, temp: state.temp, ...proposed };

  if (route === 'preset') {
    let changed = false;
    state.trial += 1;
    clearTrial();
    for (const key of ['velocity', 'depth', 'temp']) {
      const next = canonical({ ...point, [key]: point[key] })[key];
      if (next !== state[key]) {
        state.trial += 1;
        clearTrial();
        state[key] = next;
        changed = true;
      }
    }
    updatePhysics();
    return changed;
  }

  if (route === 'keyboard') {
    const rawChanged = Object.keys(proposed).some(key => Number(proposed[key]) !== state[key]);
    const next = canonical(point);
    if (rawChanged) {
      state.trial += 2;
      clearTrial();
      state.playing = false;
    }
    Object.assign(state, next);
    updatePhysics();
    return rawChanged;
  }

  Object.assign(state, proposed);
  const next = canonical({ velocity: state.velocity, depth: state.depth, temp: state.temp });
  const changed = next.velocity !== state.velocity || next.depth !== state.depth || next.temp !== state.temp;
  Object.assign(state, next);
  updatePhysics();
  return changed;
}

export function resetTrial() {
  replacePoint(DEFAULT_POINT, 'keyboard');
}

export function advanceOneTick() {
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
  state.sampleOrdinal = state.dragHistory.length;
  state.time = Number((state.time + 1 / 60).toFixed(3));
}

export function commitCheckpoint() {
  saveState();
}
