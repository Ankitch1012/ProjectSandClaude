import { canAdjust, canLinkTransposition, latestCount, requiredSerialScans, rowVariance, scannedSerials, summarize } from './engine.js';
import { selectedCase, state, visibleCases } from './store.js';

const text = (label, value) => {
  document.querySelector(`[aria-label="${label}"]`).textContent = String(value);
};

function renderQueue() {
  const list = document.getElementById('caseList');
  list.replaceChildren();
  const visible = visibleCases();
  text('Visible case count', visible.length);
  for (const item of visible) {
    const button = document.createElement('button');
    button.dataset.caseId = item.id;
    button.setAttribute('aria-label', `Select ${item.id}`);
    if (item.id === state.selectedId) button.setAttribute('aria-current', 'true');
    button.innerHTML = `<span><strong>${item.id}</strong><small>Zone ${item.zone}</small></span>
      <span><em>${item.label}</em><b>${item.status}</b></span>`;
    list.append(button);
  }
  for (const button of document.querySelectorAll('[data-filter]')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  }
}

function renderRows(item) {
  const host = document.getElementById('reconciliationRows');
  host.replaceChildren();
  for (const row of item.rows) {
    const line = document.createElement('div');
    line.className = 'recon-row';
    line.innerHTML = `
      <div class="system-cell" aria-label="System row ${row.sku}">
        <strong>${row.sku}</strong><span>${row.bin}</span>
        <dl><div><dt>On hand</dt><dd>${row.onHand}</dd></div>
        <div><dt>In transit</dt><dd>${row.inTransit}</dd></div>
        <div><dt>Available</dt><dd>${row.onHand + row.inTransit}</dd></div></dl>
      </div>
      <div class="count-cell" aria-label="Count row ${row.sku}">
        <strong>${latestCount(row)}</strong><span>latest physical count</span>
        <dl><div><dt>Variance</dt><dd>${rowVariance(row)}</dd></div>
        <div><dt>Attempts</dt><dd>${row.counts.length}</dd></div>
        <div><dt>Threshold</dt><dd>±${item.threshold}</dd></div></dl>
      </div>`;
    host.append(line);
  }
}

function renderSelected() {
  const item = selectedCase();
  const summary = summarize(item);
  text('Selected case ID', item.id);
  text('Selected case label', item.label);
  text('Case status', item.status);
  text('On hand total', summary.onHand);
  text('In transit total', summary.inTransit);
  text('Available total', summary.available);
  text('Latest count total', summary.latest);
  text('Variance total', summary.variance);
  text('Recount history', item.rows.map(row => `${row.sku}: ${row.counts.join(' → ')}`).join(' · '));
  const required = requiredSerialScans(item);
  const scanned = scannedSerials(item);
  text('Serial scan coverage', item.serialized ? `${scanned}/${required} scanned` : 'Not required');
  text('Decision summary', item.decision ? `${item.decision} · ${item.id}` : 'No decision recorded');
  renderRows(item);
  document.getElementById('linkTranspose').disabled = !canLinkTransposition(item) || item.status === 'resolved';
  document.getElementById('adjust').disabled = !canAdjust(item) || item.status === 'resolved';
  document.getElementById('scanSerial').disabled = !item.serialized || scanned >= required;
  document.getElementById('undo').disabled = state.undo.length === 0;
}

export function render() {
  renderQueue();
  renderSelected();
}
