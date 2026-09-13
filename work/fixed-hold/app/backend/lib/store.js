'use strict';

const { newSession } = require('./season');

const DEFAULT_HAND_NAME = 'the season hand';

const store = {
  sessions: new Map(),
  pages: new Map(),
  handName: DEFAULT_HAND_NAME
};

function handFor(id) {
  const key = String(id || 'main');
  if (!store.sessions.has(key)) {
    store.sessions.set(key, newSession(key));
  }
  return store.sessions.get(key);
}

function restart(id) {
  const key = String(id || 'main');
  store.sessions.set(key, newSession(key));
  return store.sessions.get(key);
}

function resetAll() {
  store.sessions.clear();
  store.pages.clear();
}

function setHandName(name) {
  const trimmed = String(name || '').trim();
  store.handName = trimmed || DEFAULT_HAND_NAME;
  return store.handName;
}

module.exports = { DEFAULT_HAND_NAME, handFor, resetAll, restart, setHandName, store };
