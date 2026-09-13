'use strict';

const { stockLabel } = require('./story');
const { stateOf } = require('./interpret');

// Whether one requirement on a visit is satisfied by what the season currently
// says. `view` carries the folded season state: the current standing of each
// stock and the three things Ada keeps score of.
function meets(view, requirement) {
  const current = view.current || {};
  const standings = view.standings || {};

  switch (requirement.kind) {
    case 'holding': {
      const stock = stateOf(current, requirement.stock);
      return Boolean(stock) && stock.state !== 'cut-back';
    }
    case 'cutback': {
      const stock = stateOf(current, requirement.stock);
      return Boolean(stock) && stock.state === 'cut-back';
    }
    case 'worked':
      return Boolean(stateOf(current, requirement.stock));
    case 'hold': {
      const stock = stateOf(current, requirement.stock);
      return Boolean(stock) && stock.hold >= requirement.min;
    }
    case 'standing':
      return (standings.standing || 0) >= requirement.min;
    case 'deadwood':
      return (standings.deadwood || 0) >= requirement.min;
    default:
      return false;
  }
}

function describe(requirement) {
  const label = requirement.stock ? stockLabel(requirement.stock) : '';
  switch (requirement.kind) {
    case 'holding':
      return `${label} has to still be holding`;
    case 'cutback':
      return `${label} has to have been cut back`;
    case 'worked':
      return `${label} has to have been worked at least once`;
    case 'hold':
      return `${label} needs a hold of ${requirement.min} or more`;
    case 'standing':
      return `Ada has to rate your hand at ${requirement.min} or more`;
    case 'deadwood':
      return `the orchard has to be owed ${requirement.min} or more`;
    default:
      return 'the season is not ready for this visit';
  }
}

function unmet(view, requirements) {
  return (requirements || []).filter((requirement) => !meets(view, requirement));
}

function satisfied(view, requirements) {
  return unmet(view, requirements).length === 0;
}

module.exports = { describe, meets, satisfied, unmet };
