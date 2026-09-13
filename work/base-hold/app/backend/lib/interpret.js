'use strict';

const board = require('./board');
const standingsLib = require('./standings');
const { OPENING } = require('./story');

// Everything the season currently is, folded out of the record of the work in
// the order the work was done. The record is the only thing that is kept; the
// graft board, what each stock currently stands at, and the three things Ada
// keeps score of are all read back off it, so they cannot drift apart.
function foldSeason(orderedEntries) {
  const cards = new Map();
  const standings = {
    canopy: OPENING.canopy,
    standing: OPENING.standing,
    deadwood: OPENING.deadwood
  };

  (orderedEntries || []).forEach((entry) => {
    const stock = entry.stock;
    if (!stock) {
      return;
    }

    const held = cards.get(stock);

    if (entry.act === 'bound') {
      cards.set(stock, board.newCard(stock, entry.visit));
      standingsLib.applyAct(standings, 'bound');
      return;
    }

    if (entry.act === 'rewrapped') {
      if (held) {
        board.rewrapCard(held);
        standingsLib.applyAct(standings, 'rewrapped');
      }
      return;
    }

    if (!held) {
      return;
    }

    if (entry.act === 'cut-back') {
      board.cutBackCard(held);
      standingsLib.applyAct(standings, 'cut-back');
      return;
    }

    if (entry.act === 'left') {
      standingsLib.applyAct(standings, 'left');
    }
  });

  const cardList = Array.from(cards.values());
  const current = {};
  cardList.forEach((card) => {
    current[card.stock] = { state: card.state, hold: card.hold };
  });

  return { board: cardList, current, standings: standingsLib.onScale(standings) };
}

function stateOf(current, stock) {
  return current && current[stock] ? current[stock] : null;
}

module.exports = { foldSeason, stateOf };
