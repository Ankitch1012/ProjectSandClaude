import { state } from '../state.js';

const columns = [
  ['Trial', sample => sample.trial],
  ['Sample', sample => sample.ordinal],
  ['Time', sample => sample.t.toFixed(3)],
  ['Velocity', sample => sample.velocity.toFixed(1)],
  ['Depth', sample => sample.depth],
  ['Temp', sample => sample.temp],
  ['Cd', sample => sample.Cd.toFixed(4)],
  ['Drag', sample => sample.F.toFixed(1)],
];

export function renderRecentSamples() {
  const body = document.getElementById('recentSamples');
  if (!body) return;
  body.replaceChildren();
  const recent = state.dragHistory.slice(-8);
  if (!recent.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = columns.length;
    cell.textContent = 'No samples in this trial';
    return;
  }
  for (const sample of recent) {
    const row = body.insertRow();
    for (const [label, value] of columns) {
      const cell = row.insertCell();
      cell.dataset.label = label;
      cell.textContent = String(value(sample));
    }
  }
}
