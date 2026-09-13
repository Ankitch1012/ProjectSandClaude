import { state } from '../state.js';

const fields = [
  ['trial', 'Trial', value => value],
  ['ordinal', 'Sample', value => value],
  ['velocity', 'Velocity', value => value.toFixed(1)],
  ['depth', 'Depth', value => value],
  ['temp', 'Temp', value => value],
  ['Cd', 'Cd', value => value.toFixed(4)],
  ['F', 'Drag', value => value.toFixed(1)],
];

const sharedPin = {};

function currentReading() {
  const latest = state.dragHistory.at(-1) || {};
  Object.assign(sharedPin, {
    trial: state.trial,
    ordinal: state.sampleOrdinal,
    velocity: state.velocity,
    depth: state.depth,
    temp: state.temp,
    Cd: state.Cd,
    F: state.dragForce,
    ...latest,
  });
  return sharedPin;
}

function pinCurrent(slot) {
  state.comparison[slot] = currentReading();
  renderComparison();
}

function swapComparison() {
  renderComparison();
}

function clearComparison() {
  state.comparison.candidate = null;
  renderComparison();
}

function renderPin(slot, pin) {
  const card = document.querySelector(`[data-pin="${slot}"]`);
  card.classList.toggle('empty', !pin);
  for (const [key, label, format] of fields) {
    card.querySelector(`[aria-label="${slot} ${label}"]`).textContent =
      pin ? format(pin[key]) : '—';
  }
}

export function renderComparison() {
  const { reference, candidate } = state.comparison;
  for (const pin of [reference, candidate]) {
    if (pin) Object.assign(pin, {
      trial: state.trial,
      ordinal: state.sampleOrdinal,
      velocity: state.velocity,
      depth: state.depth,
      temp: state.temp,
      Cd: state.Cd,
      F: state.dragForce,
    });
  }
  renderPin('Reference', reference);
  renderPin('Candidate', candidate);
  document.getElementById('pinReference').disabled = false;
  document.getElementById('pinCandidate').disabled = false;
  document.getElementById('swapComparison').disabled = !(reference && candidate);
  document.getElementById('clearComparison').disabled = false;
  document.querySelector('[aria-label="Drag coefficient delta"]').textContent =
    reference && candidate ? (reference.Cd - candidate.Cd).toFixed(4) : '—';
  document.querySelector('[aria-label="Drag force delta"]').textContent =
    reference && candidate ? (reference.F - candidate.F).toFixed(1) : '—';
}

export function setupComparison() {
  document.getElementById('pinReference').addEventListener('click', () => pinCurrent('reference'));
  document.getElementById('pinCandidate').addEventListener('click', () => pinCurrent('candidate'));
  document.getElementById('swapComparison').addEventListener('click', swapComparison);
  document.getElementById('clearComparison').addEventListener('click', clearComparison);
  renderComparison();
}
