'use strict';

// Static description of the Marrowfield season: the stocks that can be worked,
// the visits that make up the season, and the ways the season can be recorded
// with the county at the end of it.

const LIGHTS = ['morning', 'midday', 'dusk'];

const OPENING = {
  day: 1,
  light: 'morning',
  canopy: 3,
  standing: 4,
  deadwood: 0
};

const SCALE_MAX = 20;

const STOCKS = {
  'west-4': { label: 'West Row, fourth tree', scion: 'Ashmead Kernel' },
  'nursery-2': { label: 'Nursery Bed, second stool', scion: 'Tom Putt' },
  'east-9': { label: 'East Row, ninth tree', scion: 'Pitmaston Pine' },
  'gate-6': { label: 'Gate End, sixth tree', scion: 'Bramley Seedling' },
  'barn-1': { label: 'Barn Plot, first stock', scion: 'Court Pendu Plat' },
  'hedge-1': { label: 'Hedge Line, first stock', scion: 'Keswick Codlin' }
};

const VISITS = [
  {
    id: 'west-row',
    title: 'The West Row',
    day: 1,
    light: 'morning',
    requires: [],
    setting:
      'Ada Thrale walks you down the west row with a bundle of scion wood under her arm. '
      + 'The fourth tree is all water shoots and old canker.',
    line: 'Forty years I have kept this row. Cut where I show you and it will outlive us both.',
    options: [
      {
        id: 'bind-west',
        text: 'Cut a whip-and-tongue on the fourth tree',
        effects: [{ act: 'graft', stock: 'west-4' }]
      },
      {
        id: 'walk-the-row',
        text: 'Walk the row and take nothing yet',
        effects: []
      }
    ]
  },
  {
    id: 'nursery-bed',
    title: 'The Nursery Bed',
    day: 2,
    light: 'dusk',
    requires: [],
    setting:
      'The nursery bed is under the wall where the frost lifts first. '
      + 'Ada turns the second stool over with her boot and waits.',
    line: 'That stool has thrown three good trees. It will take a scion tonight if you are careful.',
    options: [
      {
        id: 'bind-nursery',
        text: 'Bind a scion onto the second stool',
        effects: [{ act: 'graft', stock: 'nursery-2' }]
      },
      {
        id: 'leave-stools',
        text: 'Leave the stools until the sap runs',
        effects: []
      }
    ]
  },
  {
    id: 'bud-swell',
    title: 'Bud Swell',
    day: 4,
    light: 'midday',
    requires: [{ kind: 'holding', stock: 'west-4' }],
    setting:
      'The buds on the fourth tree have swelled under the tape. '
      + 'Ada holds the pruning knife out to you rather than using it herself.',
    line: 'Tape off, tape on, or cut it back. Whichever you choose, choose it and stand by it.',
    options: [
      {
        id: 'release-west',
        text: 'Cut the tape and let the union stand',
        effects: [{ act: 'release', stock: 'west-4' }]
      },
      {
        id: 'cut-west-back',
        text: 'Cut it back to the rootstock',
        effects: [{ act: 'cutback', stock: 'west-4' }]
      },
      {
        id: 'leave-wrapped',
        text: 'Leave it wrapped another week',
        effects: [{ act: 'leave', stock: 'west-4' }]
      }
    ]
  },
  {
    id: 'tape-run',
    title: 'The Tape Run',
    day: 4,
    light: 'midday',
    requires: [{ kind: 'holding', stock: 'west-4' }],
    setting:
      'There is tape and wax left over, and the ninth tree in the east row has never carried anything.',
    line: 'While the knife is warm you may as well use it. That ninth tree owes me a crop.',
    options: [
      {
        id: 'bind-east',
        text: 'Work the ninth tree while the tape is out',
        effects: [{ act: 'graft', stock: 'east-9' }]
      },
      {
        id: 'pack-up',
        text: 'Pack the tape away',
        effects: []
      }
    ]
  },
  {
    id: 'scion-crate',
    title: 'The Scion Crate',
    day: 5,
    light: 'morning',
    requires: [{ kind: 'worked', stock: 'west-4' }],
    setting:
      'Fresh tape and grafting wax sit in the crate by the packing shed door. '
      + 'The binding on the fourth tree has gone slack in the wind.',
    line: 'Wax and tape are cheap. A union that dries out is not.',
    options: [
      {
        id: 'rewrap-west',
        text: 'Re-wrap the fourth tree with fresh tape',
        effects: [{ act: 'graft', stock: 'west-4' }]
      },
      {
        id: 'close-crate',
        text: 'Close the crate',
        effects: []
      }
    ]
  },
  {
    id: 'nursery-check',
    title: 'The Nursery Check',
    day: 5,
    light: 'dusk',
    requires: [{ kind: 'holding', stock: 'nursery-2' }],
    setting:
      'The scion on the second stool has pushed a leaf. Ada crouches to look at it for a long time.',
    line: 'A leaf is not a tree. But it is more than I had from that stool last year.',
    options: [
      {
        id: 'release-nursery',
        text: 'Re-wrap the stool, then take the tape off for good',
        effects: [
          { act: 'graft', stock: 'nursery-2' },
          { act: 'release', stock: 'nursery-2' }
        ]
      },
      {
        id: 'pull-nursery',
        text: 'Pull the stool and burn the scion',
        effects: [{ act: 'cutback', stock: 'nursery-2' }]
      }
    ]
  },
  {
    id: 'spare-stock',
    title: 'The Spare Stock',
    day: 6,
    light: 'midday',
    requires: [{ kind: 'hold', stock: 'west-4', min: 2 }],
    setting:
      'A dozen spare stocks are heeled into sand behind the barn, waiting for someone to decide about them.',
    line: 'You have a hand for it now. Put one of those stocks to work before they dry.',
    options: [
      {
        id: 'bind-barn',
        text: 'Graft the spare stock by the barn',
        effects: [{ act: 'graft', stock: 'barn-1' }]
      },
      {
        id: 'leave-stock',
        text: 'Leave the spare stock in the sand',
        effects: []
      }
    ]
  },
  {
    id: 'county-survey',
    title: 'The County Survey',
    day: 6,
    light: 'morning',
    requires: [{ kind: 'standing', min: 12 }],
    setting:
      'The county surveyor wants the row entered before the register closes for the year. '
      + 'Ada has left the form on the kitchen table with your name already on it.',
    line: 'If your name goes on that form, the row is yours to answer for. Think before you sign.',
    options: [
      {
        id: 'sign-register',
        text: 'Put the row on the county register',
        effects: [{ act: 'graft', stock: 'gate-6' }]
      },
      {
        id: 'hold-off',
        text: 'Ask her to wait another season',
        effects: []
      }
    ]
  },
  {
    id: 'windthrow',
    title: 'After the Windthrow',
    day: 8,
    light: 'morning',
    requires: [{ kind: 'deadwood', min: 3 }],
    setting:
      'A night of southwesterlies has brought down limbs across the hedge line, '
      + 'and the work you left undone is lying in plain sight.',
    line: 'The orchard keeps its own accounts. Shall we settle some of them?',
    options: [
      {
        id: 'clear-limbs',
        text: 'Clear the broken limbs and graft the hedge stock',
        effects: [{ act: 'graft', stock: 'hedge-1' }]
      },
      {
        id: 'leave-limbs',
        text: 'Leave the limbs where they lie',
        effects: []
      }
    ]
  },
  {
    id: 'stump-work',
    title: 'Stump Work',
    day: 8,
    light: 'dusk',
    requires: [{ kind: 'cutback', stock: 'west-4' }],
    setting:
      'The fourth tree is a bare stump with the saw cut still bright on it. '
      + 'Ada brings a second bundle of scion wood without being asked.',
    line: 'A stump is not the end of a tree. It is only the end of one attempt at it.',
    options: [
      {
        id: 'regraft-west',
        text: 'Re-graft the stump and release it',
        effects: [
          { act: 'graft', stock: 'west-4' },
          { act: 'release', stock: 'west-4' }
        ]
      },
      {
        id: 'let-it-stand',
        text: 'Let the stump stand',
        effects: [{ act: 'leave', stock: 'west-4' }]
      }
    ]
  },
  {
    id: 'last-round',
    title: 'The Last Round',
    day: 9,
    light: 'dusk',
    requires: [{ kind: 'holding', stock: 'east-9' }],
    setting:
      'The season is closing. Ada waits at the gate end with her coat already on, '
      + 'looking back up the row at what there is to show for it.',
    line: 'Walk it with me once. I want to see it through somebody else eyes before I stop.',
    options: [
      {
        id: 'walk-the-finished-row',
        text: 'Walk the finished row with her',
        effects: [{ act: 'graft', stock: 'east-9' }]
      },
      {
        id: 'show-union',
        text: 'Show her the union on the fourth tree',
        showWhen: [{ kind: 'hold', stock: 'west-4', min: 2 }],
        effects: [
          { act: 'graft', stock: 'west-4' },
          { act: 'release', stock: 'west-4' }
        ]
      },
      {
        id: 'close-the-gate',
        text: 'Close the gate and go',
        effects: []
      }
    ]
  }
];

const RECORDS = [
  {
    id: 'working-orchard',
    title: 'A Working Orchard',
    blurb: 'The row goes on the register as productive wood, in your hand and hers.',
    requires: [
      { kind: 'noneCutBack' },
      { kind: 'grafts', min: 3 },
      { kind: 'standing', min: 9 },
      { kind: 'deadwoodAtMost', max: 2 }
    ]
  },
  {
    id: 'held-back',
    title: 'A Season Held Back',
    blurb: 'The row is entered with a note against it: work begun, work abandoned, work still owed.',
    requires: [{ kind: 'someCutBack' }, { kind: 'deadwoodAtMost', max: 3 }]
  },
  {
    id: 'row-of-stumps',
    title: 'A Row of Stumps',
    blurb: 'Ada withdraws the entry. What is left is stumps and sand and a form nobody signed.',
    requires: [{ kind: 'anyOf', of: [{ kind: 'deadwood', min: 4 }, { kind: 'standingAtMost', max: 3 }] }]
  }
];

function lightRank(light) {
  const index = LIGHTS.indexOf(light);
  return index === -1 ? LIGHTS.length : index;
}

function visitById(id) {
  return VISITS.find((visit) => visit.id === id) || null;
}

function optionById(visit, optionId) {
  if (!visit) {
    return null;
  }
  return visit.options.find((option) => option.id === optionId) || null;
}

function stockLabel(stock) {
  return STOCKS[stock] ? STOCKS[stock].label : stock;
}

function stockScion(stock) {
  return STOCKS[stock] ? STOCKS[stock].scion : '';
}

// Every stock a visit can touch, in the order it appears in the visit, so the
// visit panel can show what the season already says about each of them.
function stocksTouchedBy(visit) {
  const seen = [];
  const push = (stock) => {
    if (stock && !seen.includes(stock)) {
      seen.push(stock);
    }
  };
  (visit.requires || []).forEach((requirement) => push(requirement.stock));
  (visit.options || []).forEach((option) => {
    (option.showWhen || []).forEach((requirement) => push(requirement.stock));
    (option.effects || []).forEach((effect) => push(effect.stock));
  });
  return seen;
}

module.exports = {
  LIGHTS,
  OPENING,
  RECORDS,
  SCALE_MAX,
  STOCKS,
  VISITS,
  lightRank,
  optionById,
  stockLabel,
  stockScion,
  stocksTouchedBy,
  visitById
};
