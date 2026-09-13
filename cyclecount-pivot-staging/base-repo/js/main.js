import { decide, load, postRecount, scanMissingSerial, selectCase, setFilter, undo } from './store.js';
import { render } from './ui.js';

load();
render();

document.getElementById('caseList').addEventListener('click', event => {
  const button = event.target.closest('[data-case-id]');
  if (!button) return;
  selectCase(button.dataset.caseId);
  render();
});

document.querySelector('[aria-label="Queue filters"]').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  setFilter(button.dataset.filter);
  render();
});

document.getElementById('recountForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = event.currentTarget.querySelector('input');
  if (postRecount(input.value)) input.value = '';
  render();
});

document.getElementById('scanSerial').addEventListener('click', () => {
  scanMissingSerial();
  render();
});

for (const [id, decision] of [
  ['linkTranspose', 'link'],
  ['adjust', 'adjust'],
  ['hold', 'hold'],
]) {
  document.getElementById(id).addEventListener('click', () => {
    decide(decision);
    render();
  });
}

document.getElementById('undo').addEventListener('click', () => {
  undo();
  render();
});
