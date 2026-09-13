'use strict';

const { stockLabel, stockScion } = require('./story');

// The graft board holds one card per stock that has been worked. A stock is
// the thing that is standing in the orchard, so it is what a card answers for:
// coming back to a stock builds on the card that is already there, whichever
// visit the work happens on.

function newCard(stock, visitId) {
  return {
    stock,
    label: stockLabel(stock),
    scion: stockScion(stock),
    boundAt: visitId,
    hold: 1,
    state: 'set'
  };
}

// Extra tape and wax builds the hold on a union. It does not decide whether
// the union stands, so a stock that was cut back stays cut back.
function rewrapCard(card) {
  card.hold += 1;
  return card;
}

function releaseCard(card) {
  const mended = card.state === 'cut-back';
  card.state = 'released';
  card.hold += 1;
  return { card, mended };
}

function cutBackCard(card) {
  card.state = 'cut-back';
  return card;
}

module.exports = { cutBackCard, newCard, releaseCard, rewrapCard };
