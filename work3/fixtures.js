'use strict';

// Every crib the verifier will type into the desk, checked against the correct
// tree and the planted tree so the F2P direction is proved before the spec is
// written.

const correct = require('./correct-app/backend/lib/check');
const base = require('./cribstave-dance-desk/environment/app/backend/lib/check');

const E = '\u2013'; // en dash

const CRIBS = {
  'D1 en-dash sound': {
    bars: 32,
    text: [
      `1${E}8 : 1s+2s circle 4H round & back`,
      `9${E}16 : 1s+2s dance RH across & LH back`,
      `17${E}24 : 1s lead down the middle & back`,
      `25${E}32 : 1s+2s allemande`
    ],
    want: 'sound'
  },
  'D1 en-dash open span': {
    bars: 32,
    text: [
      `1${E}8 : 1s+2s circle 4H round & back`,
      `9${E} : 1s+2s dance RH across & LH back`,
      `17${E}24 : 1s lead down the middle & back`,
      `25${E}32 : 1s+2s poussette`
    ],
    want: 'sound'
  },
  'D2 contiguous': {
    bars: 32,
    text: [
      '1-4 : 1s+2s dance RH across',
      '5-8 : 1s+2s dance LH across',
      '9-16 : 1s+2s poussette',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s allemande'
    ],
    want: 'sound'
  },
  'D2 real gap': {
    bars: 32,
    text: ['1-8 : 1s+2s poussette', '9-16 : 1s+2s poussette', '25-32 : 1s+2s allemande'],
    want: 'one fault at bar 17'
  },
  'D2 one bar claimed twice': {
    bars: 23,
    text: ['1-8 : 1s+2s poussette', '9-16 : 1s+2s poussette', '16-23 : 1s+2s allemande'],
    want: 'one fault at bar 16'
  },
  'D3 carried over two lines': {
    bars: 32,
    text: [
      '1-8 : 1s+2s poussette',
      '9-16 : 1s+2s dance RH across,',
      '        1s+2s dance LH across',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s allemande'
    ],
    want: 'sound'
  },
  'D3 carried over three lines': {
    bars: 32,
    text: [
      '1-8 : 1s+2s poussette',
      '9-16 : 1s+2s dance RH across,',
      '        1s+2s set,',
      '        1s+2s set',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s allemande'
    ],
    want: 'sound'
  },
  'D4 ampersand figure names': {
    bars: 32,
    text: [
      '1-8 : 1s+2s rights & lefts',
      '9-16 : 1s+2s poussette',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s allemande'
    ],
    want: 'sound'
  },
  'D4 there and back': {
    bars: 32,
    text: [
      '1-8 : 1s+2s circle 4H round & back',
      '9-16 : 1s+2s dance RH across & LH back',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s rights & lefts'
    ],
    want: 'sound, phrase 1 needs 8'
  },
  'D4 two figures on one line': {
    bars: 32,
    text: [
      '1-8 : 1s+2s set & link, 1s+2s dance RH across',
      '9-16 : 1s+2s dance LH across & RH back',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s poussette'
    ],
    want: 'sound'
  },
  'D5 apart though numbered together': {
    bars: 32,
    text: [
      '1-4 : 1s+2s dance RH across',
      '5-8 : 1s cast off 2',
      '9-16 : 1s+3s set, 1s+2s dance RH across, 1s+3s set',
      '17-24 : 1s+3s poussette',
      '25-32 : 1s+2s dance RH across, 1s+2s dance LH across'
    ],
    want: 'a fault at bar 11'
  },
  'D5 side by side though numbered apart': {
    bars: 32,
    text: [
      '1-4 : 1s+2s dance RH across',
      '5-8 : 1s cast off 2',
      '9-16 : 1s+3s poussette',
      '17-24 : 1s+2s rights & lefts',
      '25-32 : 1s+3s rights & lefts'
    ],
    want: 'sound'
  },
  'D6 top figure after the couple moved down': {
    bars: 32,
    text: [
      '1-4 : 1s+2s dance RH across',
      '5-8 : 1s cast off 2',
      '9-16 : 1s+3s set, 1s lead down the middle, 1s+3s set',
      '17-24 : 1s+3s poussette',
      '25-32 : 1s+2s dance RH across, 1s+2s dance LH across'
    ],
    want: 'a fault at bar 11'
  },
  'D6 top figure once another couple is there': {
    bars: 32,
    text: [
      '1-4 : 1s+2s dance RH across',
      '5-8 : 1s cast off 2',
      '9-16 : 1s+3s set, 2s lead down the middle, 1s+3s set',
      '17-24 : 1s+3s poussette',
      '25-32 : 1s+2s dance RH across, 1s+2s dance LH across'
    ],
    want: 'sound'
  },
  'D7 everyone home again': {
    bars: 32,
    text: [
      '1-8 : 1s+2s poussette',
      '9-16 : 1s+2s poussette',
      '17-24 : 1s+2s dance RH across, 1s+2s dance LH across',
      '25-32 : 1s+2s dance RH across, 1s+2s dance LH across'
    ],
    want: 'one fault at bar 32'
  },
  'D7 set left in a jumble': {
    bars: 32,
    text: [
      '1-8 : 2s+3s poussette',
      '9-16 : 1s+3s dance RH across, 1s+3s dance LH across',
      '17-24 : 1s+3s dance RH across, 1s+3s dance LH across',
      '25-32 : 1s+3s dance RH across, 1s+3s dance LH across'
    ],
    want: 'one fault at bar 32'
  },
  'D8 crossed and never brought home': {
    bars: 32,
    text: [
      '*3s+4s on opposite sides*',
      '1-8 : 1s+2s poussette',
      '9-16 : 1s+2s poussette',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s rights & lefts'
    ],
    want: 'one fault at bar 32'
  },
  'D8 crossed and brought home': {
    bars: 32,
    text: [
      '*3s+4s on opposite sides*',
      '1-2 : 3s+4s cross RH',
      '3-8 : 1s+2s circle 4H round, 1s+2s set',
      '9-16 : 1s+2s poussette',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s allemande'
    ],
    want: 'sound'
  },
  'D9 second figure at fault': {
    bars: 32,
    text: [
      '1-8 : 1s+2s dance RH across, 1s+4s dance LH across',
      '9-16 : 1s+2s poussette',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s allemande'
    ],
    want: 'a fault at bar 5 and none at bar 1'
  },
  'D9 fourth figure at fault': {
    bars: 32,
    text: [
      '1-12 : 1s+2s set, 1s+2s dance RH across, 1s+2s set, 1s+4s dance RH across',
      '13-20 : 1s+2s poussette',
      '21-28 : 1s+2s poussette',
      '29-32 : 1s+2s 1/2 poussette'
    ],
    want: 'a fault at bar 9 and none at bar 1'
  },
  'D10 two faults to answer for': {
    bars: 32,
    text: [
      '1-8 : 1s+2s 1/2 poussette',
      '9-16 : 1s+2s dance LH across',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s allemande'
    ],
    want: 'two faults, bars 1 and 9'
  },
  'D10 faults on separate lines': {
    bars: 32,
    text: [
      '1-8 : 1s+2s poussette',
      '9-16 : 1s+2s dance LH across',
      '17-24 : 1s+2s dance RH across',
      '25-32 : 1s+2s allemande'
    ],
    want: 'faults on lines 2 and 3'
  },
  'P2P unknown figure': {
    bars: 32,
    text: [
      '1-8 : 1s+2s dance a jig',
      '9-16 : 1s+2s poussette',
      '17-24 : 1s+2s poussette',
      '25-32 : 1s+2s allemande'
    ],
    want: 'both trees name the unknown figure at bar 1'
  }
};

function summarise(result) {
  return {
    good: result.good,
    n: result.faults.length,
    bars: result.faults.map((f) => f.bar).join(','),
    lines: result.faults.map((f) => f.line).join(','),
    needs: result.phrases.map((p) => `${p.span}:${p.needs}/${p.gives}`).join(' ')
  };
}

let bad = 0;
Object.keys(CRIBS).forEach((name) => {
  const crib = CRIBS[name];
  const text = crib.text.join('\n');
  const c = summarise(correct.check(text, crib.bars));
  const b = summarise(base.check(text, crib.bars));
  const same = c.good === b.good && c.bars === b.bars && c.n === b.n;
  if (same) {
    bad += 1;
  }
  console.log(`\n${same ? '!! SAME' : 'ok     '}  ${name}   — want: ${crib.want}`);
  console.log(`   correct: good=${c.good} n=${c.n} bars=[${c.bars}] lines=[${c.lines}]`);
  console.log(`            ${c.needs}`);
  console.log(`   base   : good=${b.good} n=${b.n} bars=[${b.bars}] lines=[${b.lines}]`);
  console.log(`            ${b.needs}`);
});

console.log(`\n${bad === 0 ? 'every crib separates the two trees' : bad + ' cribs do NOT separate the two trees'}`);
