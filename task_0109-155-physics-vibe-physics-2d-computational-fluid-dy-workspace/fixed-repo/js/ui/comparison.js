import { state } from '../state.js';
import { commitCheckpoint } from '../trial.js';

const fields = [
  ['trial', 'Trial', value => value],
  ['ordinal', 'Sample', value => value],
  ['velocity', 'Velocity', value => value.toFixed(1)],
  ['depth', 'Depth', value => value],
  ['temp', 'Temp', value => value],
  ['Cd', 'Cd', value => value.toFixed(4)],
  ['F', 'Drag', value => value.toFixed(1)],
];

function snapshotLatest() {
  if (state.playing || !state.dragHistory.length) return null;
  const latest = state.dragHistory.at(-1);
  return Object.freeze({
    trial: latest.trial,
    ordinal: latest.ordinal,
    velocity: latest.velocity,
    depth: latest.depth,
    temp: latest.temp,
    Cd: latest.Cd,
    F: latest.F,
  });
}

function pinCurrent(slot) {
  const pin = snapshotLatest();
  if (!pin) return;
  state.comparison[slot] = pin;
  commitCheckpoint();
  renderComparison();
}

function swapComparison() {
  if (!state.comparison.reference || !state.comparison.candidate) return;
  [state.comparison.reference, state.comparison.candidate] =
    [state.comparison.candidate, state.comparison.reference];
  commitCheckpoint();
  renderComparison();
}

function clearComparison() {
  state.comparison = { reference: null, candidate: null };
  commitCheckpoint();
  renderComparison();
}

function renderPin(slot, pin) {
  const card = document.querySelector(`[data-pin="${slot}"]`);
  card.classList.toggle('empty', !pin);
  for (const [key, label, format] of fields) {
    const output = card.querySelector(`[aria-label="${slot} ${label}"]`);
    output.textContent = pin ? format(pin[key]) : '—';
  }
}

export function renderComparison() {
  const { reference, candidate } = state.comparison;
  renderPin('Reference', reference);
  renderPin('Candidate', candidate);
  const canPin = !state.playing && state.dragHistory.length > 0;
  document.getElementById('pinReference').disabled = !canPin;
  document.getElementById('pinCandidate').disabled = !canPin;
  document.getElementById('swapComparison').disabled = !(reference && candidate);
  document.getElementById('clearComparison').disabled = !(reference || candidate);
  document.querySelector('[aria-label="Drag coefficient delta"]').textContent =
    reference && candidate ? (candidate.Cd - reference.Cd).toFixed(4) : '—';
  document.querySelector('[aria-label="Drag force delta"]').textContent =
    reference && candidate ? (candidate.F - reference.F).toFixed(1) : '—';
}

export function setupComparison() {
  document.getElementById('pinReference').addEventListener('click', () => pinCurrent('reference'));
  document.getElementById('pinCandidate').addEventListener('click', () => pinCurrent('candidate'));
  document.getElementById('swapComparison').addEventListener('click', swapComparison);
  document.getElementById('clearComparison').addEventListener('click', clearComparison);
  renderComparison();
}
