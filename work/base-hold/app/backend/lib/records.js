'use strict';

const { RECORDS } = require('./story');

// How the season can be entered with the county at the end of it. Each way of
// recording the row asks its own question of the season as it currently
// stands.
function meetsRecord(view, requirement) {
  const current = view.current || {};
  const standings = view.standings || {};
  const stocks = Object.keys(current).map((stock) => current[stock]);

  switch (requirement.kind) {
    case 'noneCutBack':
      return !stocks.some((stock) => stock.state === 'cut-back');
    case 'someCutBack':
      return stocks.some((stock) => stock.state === 'cut-back');
    case 'grafts':
      return stocks.length >= requirement.min;
    case 'standing':
      return (standings.standing || 0) >= requirement.min;
    case 'standingAtMost':
      return (standings.standing || 0) <= requirement.max;
    case 'deadwood':
      return (standings.deadwood || 0) >= requirement.min;
    case 'deadwoodAtMost':
      return (standings.deadwood || 0) <= requirement.max;
    case 'anyOf':
      return (requirement.of || []).some((inner) => meetsRecord(view, inner));
    default:
      return false;
  }
}

const settled = new Map();

function settledKey(session, recordId) {
  return `${session.id}::${recordId}`;
}

function eligibleRecords(session, view) {
  return RECORDS.filter((record) => {
    const key = settledKey(session, record.id);
    if (settled.has(key)) {
      return settled.get(key);
    }
    const open = (record.requires || []).every((requirement) => meetsRecord(view, requirement));
    if (open) {
      settled.set(key, true);
    }
    return open;
  }).map((record) => record.id);
}

function forgetSettled() {
  settled.clear();
}

module.exports = { eligibleRecords, forgetSettled, meetsRecord };
