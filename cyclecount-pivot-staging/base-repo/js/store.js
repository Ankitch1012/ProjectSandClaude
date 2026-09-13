import { freshCases } from './data.js';
import { canAdjust, canLinkTransposition, latestCount } from './engine.js';

const STORAGE_KEY = 'countback-desk-v1';

export const state = {
  cases: freshCases(),
  selectedId: 'CC-104',
  filter: 'all',
  undo: [],
};

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selectedId: state.selectedId,
    filter: state.filter,
  }));
}

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.selectedId = saved.selectedId || state.selectedId;
    state.filter = saved.filter || 'all';
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
  state.selectedId = id;
  persist();
}

export function setFilter(filter) {
  state.filter = filter;
  const first = visibleCases()[0];
  if (first) state.selectedId = first.id;
  persist();
}

function transact(change) {
  state.undo.push({
    cases: state.cases,
    selectedId: state.selectedId,
    filter: state.filter,
  });
  change();
  persist();
}

export function postRecount(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) return false;
  transact(() => selectedCase().rows[0].counts.push(amount));
  return true;
}

export function scanMissingSerial() {
  const item = selectedCase();
  if (!item.serialized) return false;
  transact(() => {
    item.rows[0].scanned ||= [];
    item.rows[0].scanned.push('SN-MISS-1');
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
