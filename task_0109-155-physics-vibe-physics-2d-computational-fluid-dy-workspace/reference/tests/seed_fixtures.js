'use strict';
// Randomized fixtures for the Cavitation Lab spec.
// All randomness comes from crypto.randomBytes (never Math.random).

const { randomBytes } = require('crypto');

function rnd() {
  // uniform float in [0,1)
  return randomBytes(4).readUInt32BE(0) / 4294967296;
}

function randInt(min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

function randFloat(min, max) {
  return min + rnd() * (max - min);
}

// snap to the velocity slider's 0.5 step
function snapHalf(x) {
  return Math.round(x * 2) / 2;
}

// Any legal parameter triple for the three sliders.
function randParams() {
  return {
    velocity: snapHalf(randFloat(0, 120)),
    depth: randInt(1, 200),
    temp: randInt(0, 80),
  };
}

// Parameter triple with a *high* velocity (where the buggy canvas HUD appears).
function randHighParams() {
  return {
    velocity: snapHalf(randFloat(60, 120)),
    depth: randInt(1, 200),
    temp: randInt(0, 80),
  };
}

// Parameter triple guaranteed to differ from the RESET defaults (20 / 50 / 20).
function randNonDefaultParams() {
  let p = randParams();
  let guard = 0;
  while (
    guard++ < 32 &&
    (p.velocity === 20 || p.depth === 50 || p.temp === 20)
  ) {
    p = randParams();
  }
  if (p.velocity === 20) p.velocity = 20 + snapHalf(randFloat(5, 60));
  if (p.depth === 50) p.depth = 50 + randInt(5, 100);
  if (p.temp === 20) p.temp = 20 + randInt(5, 40);
  return p;
}

// One of the preset buttons rendered in the sidebar.
function randPreset() {
  const presets = [
    { label: 'Gentle', v: 15, d: 50, t: 20 },
    { label: 'Pre-Cav', v: 45, d: 50, t: 20 },
    { label: 'Cavitating', v: 65, d: 50, t: 20 },
    { label: 'Supercav', v: 100, d: 100, t: 20 },
    { label: 'Shallow Sprint', v: 80, d: 5, t: 20 },
  ];
  return presets[randInt(0, presets.length - 1)];
}

module.exports = {
  rnd,
  randInt,
  randFloat,
  randParams,
  randHighParams,
  randNonDefaultParams,
  randPreset,
};