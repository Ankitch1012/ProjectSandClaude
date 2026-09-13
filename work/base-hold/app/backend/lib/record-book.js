'use strict';

const { lightRank, stockLabel, visitById } = require('./story');

// The season record: one line for every act of work, the way it would be
// written into the back of the notebook. Lines are only ever added, and each
// one carries the place it took in the season so that two acts written in the
// same light keep the order they happened in.

function makeEntry(session, { visit, act, stock }) {
  const order = session.nextOrder || 1;
  session.nextOrder = order + 1;
  return {
    order: String(order),
    day: session.day,
    light: session.light,
    visit: visit || null,
    act,
    stock: stock || null
  };
}

function append(session, entry) {
  session.entries.push(entry);
  return entry;
}

function orderOf(entry) {
  return Number(entry.order) || 0;
}

// Read the record the way it reads on paper: by day, within a day by the light
// the work was done in, and within one light by the order it was written down.
function ordered(entries) {
  return (entries || [])
    .slice()
    .sort(
      (a, b) =>
        (a.day - b.day)
        || (lightRank(a.light) - lightRank(b.light))
        || (a.order > b.order ? 1 : -1)
    );
}

function nextOrderAfter(entries) {
  return (entries || []).reduce((top, entry) => Math.max(top, orderOf(entry)), 0) + 1;
}

function forStock(entries, stock) {
  return ordered(entries).filter((entry) => entry.stock === stock);
}

function present(entries) {
  return ordered(entries).map((entry) => {
    const visit = visitById(entry.visit);
    return {
      day: entry.day,
      light: entry.light,
      act: entry.act,
      stock: entry.stock,
      label: entry.stock ? stockLabel(entry.stock) : '',
      visit: entry.visit,
      visitTitle: visit ? visit.title : ''
    };
  });
}

module.exports = { append, forStock, makeEntry, nextOrderAfter, ordered, orderOf, present };
