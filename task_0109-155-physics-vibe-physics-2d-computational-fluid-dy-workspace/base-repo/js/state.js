// state.js — Physics constants, global state, and persistence

export const WATER = {
  rho: 998,
  mu: 0.001002,
  Pv: 2340,
  Patm: 101325
};

export const PROJ = {
  length: 2.0,
  diameter: 0.3,
  mass: 50,
  Afront: Math.PI * 0.15 * 0.15,
  Awet: Math.PI * 0.3 * 2.0 * 0.85 + Math.PI * 0.15 * 0.15
};

export const CAV_CRIT_SIGMA = 0.8;

export const state = {
  velocity: 20,
  depth: 50,
  temp: 20,
  playing: false,
  trial: 1,
  sampleOrdinal: 0,
  time: 0,
  dt: 1 / 60,
  rho: 998,
  mu: 0.001002,
  Re: 0, Cf: 0, Cd: 0, sigma: 0,
  dragForce: 0, frictionForce: 0,
  bubbleLength: 0, bubbleFraction: 0,
  power: 0,
  Pv: WATER.Pv,
  Pamb: WATER.Patm,
  regime: 'sub',
  dragHistory: [],
  maxHistory: 300,
  comparison: { reference: null, candidate: null },
  pressureDist: [],
  particles: [],
  bubbleParticles: [],
  wakeParticles: [],
};

// ── Persistence ──
const STORAGE_KEY = 'cavitation-lab-state';

export function saveState() {
  try {
    const toSave = {
      velocity: state.velocity,
      depth: state.depth,
      temp: state.temp,
      trial: state.trial,
      sampleOrdinal: state.sampleOrdinal,
      time: state.time,
      dragHistory: state.dragHistory.map(sample => ({ ...sample })),
      playing: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) { /* ignore */ }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.velocity !== undefined) {
        state.velocity = Math.max(0, Math.min(120, saved.velocity));
        document.getElementById('sliderVel').value = state.velocity;
      }
      if (saved.depth !== undefined) {
        state.depth = Math.max(1, Math.min(200, saved.depth));
        document.getElementById('sliderDepth').value = state.depth;
      }
      if (saved.temp !== undefined) {
        state.temp = Math.max(0, Math.min(80, saved.temp));
        document.getElementById('sliderTemp').value = state.temp;
      }
      const savedTime = Number(saved.time);
      const savedTrial = Number(saved.trial);
      const savedOrdinal = Number(saved.sampleOrdinal);
      state.trial = Number.isInteger(savedTrial) && savedTrial >= 1 ? savedTrial : 1;
      state.sampleOrdinal = Number.isInteger(savedOrdinal) && savedOrdinal >= 0 ? savedOrdinal : 0;
      state.time = Number.isFinite(savedTime) && savedTime >= 0
        ? savedTime
        : state.sampleOrdinal / 60;
      state.dragHistory = Array.isArray(saved.dragHistory)
        ? saved.dragHistory
          .filter(entry => entry && [
            entry.trial, entry.ordinal, entry.t, entry.velocity, entry.depth,
            entry.temp, entry.Cd, entry.F,
          ].every(Number.isFinite))
          .slice(-state.maxHistory)
          .map(entry => ({ ...entry }))
        : [];
      state.playing = false;
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}
