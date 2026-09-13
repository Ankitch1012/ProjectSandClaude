'use strict';

const DEFAULT_BOAT_NAME = 'the working boat';

const store = {
  passages: new Map(),
  boatName: DEFAULT_BOAT_NAME
};

function passageFor(id) {
  const key = String(id || 'today');
  if (!store.passages.has(key)) {
    store.passages.set(key, { id: key, plan: [] });
  }
  return store.passages.get(key);
}

function clearPassage(id) {
  const passage = passageFor(id);
  passage.plan = [];
  return passage;
}

function resetAll() {
  store.passages.clear();
}

function setBoatName(name) {
  const trimmed = String(name || '').trim();
  store.boatName = trimmed || DEFAULT_BOAT_NAME;
  return store.boatName;
}

module.exports = { DEFAULT_BOAT_NAME, clearPassage, passageFor, resetAll, setBoatName, store };
