import { freshCases } from './data.js';
import { canAdjust, canLinkTransposition, latestCount } from './engine.js';

const STORAGE_KEY = 'countback-desk-v1';

export const state = {
  cases: freshCases(),
  selectedId: 'CC-104',
  filter: 'all',
  undo: [],
};

function snapshot() {
  return structuredClone({
    cases: state.cases,
    selectedId: state.selectedId,
    filter: state.filter,
  });
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
}

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.cases)) return;
    state.cases = saved.cases;
    state.selectedId = state.cases.some(item => item.id === saved.selectedId)
      ? saved.selectedId
      : state.cases[0].id;
    state.filter = ['all', 'open', 'resolved', 'serialized'].includes(saved.filter)
      ? saved.filter
      : 'all';
  } catch (_) {
    state.cases = freshCases();
  }
}

export function selectedCase() {
  return state.cases.find(item => item.id === state.selectedId);
}

export function visibleCases() {
  if (state.filter === 'all') return state.cases;
  if (state.filter === 'serialized') return state.cases.filter(item => item.serialized);
  return state.cases.filter(item => item.status === state.filter);
}

export function selectCase(id) {
  if (!state.cases.some(item => item.id === id)) return;
  state.selectedId = id;
  persist();
}

export function setFilter(filter) {
  state.filter = filter;
  persist();
}

function transact(change) {
  state.undo.push(snapshot());
  if (state.undo.length > 20) state.undo.shift();
  change();
  persist();
}

export function postRecount(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) return false;
  transact(() => {
    selectedCase().rows[0].counts.push(amount);
    selectedCase().status = 'open';
    selectedCase().decision = null;
  });
  return true;
}

export function scanMissingSerial() {
  const item = selectedCase();
  if (!item.serialized) return false;
  transact(() => {
    const row = item.rows[0];
    row.scanned ||= [];
    const serial = `SN-MISS-${row.scanned.length + 1}`;
    if (!row.scanned.includes(serial)) row.scanned.push(serial);
  });
  return true;
}

export function decide(kind) {
  const item = selectedCase();
  if (kind === 'link' && !canLinkTransposition(item)) return false;
  if (kind === 'adjust' && !canAdjust(item)) return false;
  transact(() => {
    item.status = kind === 'hold' ? 'hold' : 'resolved';
    item.decision = kind;
    if (kind === 'adjust') {
      for (const row of item.rows) row.onHand = latestCount(row);
    }
  });
  return true;
}

export function undo() {
  const previous = state.undo.pop();
  if (!previous) return false;
  state.cases = previous.cases;
  state.selectedId = previous.selectedId;
  state.filter = previous.filter;
  persist();
  return true;
}
