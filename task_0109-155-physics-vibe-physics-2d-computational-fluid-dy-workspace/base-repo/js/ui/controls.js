// ui/controls.js — Simulation control buttons and presets

import { state } from '../state.js';
import { advanceOneTick, commitCheckpoint, replacePoint, resetTrial } from '../trial.js';
import { updateUI } from './update.js';
import { initParticles } from './sim-canvas.js';
import { runSelfTest } from './self-test.js';

function showPaused() {
  const btn = document.getElementById('btnPlayPause');
  btn.textContent = '▶ PLAY';
  btn.classList.add('primary');
}

export function pauseRun(persist = true) {
  state.playing = false;
  showPaused();
  updateUI();
  if (persist) commitCheckpoint();
}

function syncPointControls() {
  document.getElementById('sliderVel').value = state.velocity;
  document.getElementById('sliderDepth').value = state.depth;
  document.getElementById('sliderTemp').value = state.temp;
}

function applyOperatingPoint(point, route = 'slider') {
  const changed = replacePoint(point, route);
  syncPointControls();
  if (changed) showPaused();
  updateUI();
  if (changed) commitCheckpoint();
  return changed;
}

export function togglePlay() {
  state.playing = !state.playing;
  const btn = document.getElementById('btnPlayPause');
  btn.textContent = state.playing ? '❚❚ PAUSE' : '▶ PLAY';
  btn.classList.toggle('primary', !state.playing);
}

export function doStep() {
  state.playing = false;
  showPaused();
  commitCheckpoint();
  advanceOneTick();
  updateUI();
}

export function doReset() {
  commitCheckpoint();
  resetTrial();
  syncPointControls();
  showPaused();
  initParticles();
  updateUI();
  runSelfTest();
}

export function setPreset(v, d, t) {
  applyOperatingPoint({ velocity: v, depth: d, temp: t }, 'preset');
}

export function velocityDelta(delta) {
  applyOperatingPoint({
    velocity: state.velocity + delta,
    depth: state.depth,
    temp: state.temp,
  }, 'keyboard');
}

export function setupSliders() {
  document.getElementById('sliderVel').addEventListener('input', e => {
    applyOperatingPoint({
      velocity: parseFloat(e.target.value),
      depth: state.depth,
      temp: state.temp,
    });
  });

  document.getElementById('sliderDepth').addEventListener('input', e => {
    applyOperatingPoint({
      velocity: state.velocity,
      depth: parseInt(e.target.value),
      temp: state.temp,
    });
  });

  document.getElementById('sliderTemp').addEventListener('input', e => {
    applyOperatingPoint({
      velocity: state.velocity,
      depth: state.depth,
      temp: parseInt(e.target.value),
    });
  });
}

export function setupButtons() {
  document.getElementById('btnPlayPause').addEventListener('click', togglePlay);
  document.getElementById('btnStep').addEventListener('click', doStep);
  document.getElementById('btnReset').addEventListener('click', doReset);
}
