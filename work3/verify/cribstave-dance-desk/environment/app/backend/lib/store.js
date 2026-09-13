'use strict';

// The cribs the desk keeps to hand. Devisors work on one at a time, and the
// desk holds them only for as long as it is running.
const HOUSE = [
  {
    bars: 32,
    slug: 'marchmont-rant',
    text: [
      '1-8 : 1s+2s circle 4H round & back',
      '9-16 : 1s lead down the middle & back',
      '17-24 : 1s+2s dance RH across & LH back',
      '25-32 : 1s+2s poussette'
    ].join('\n'),
    title: 'Marchmont Rant'
  },
  {
    bars: 32,
    slug: 'kelso-brig',
    text: [
      '1\u20138 : 1s+2s circle 4H round & back',
      '9\u201316 : 1s+2s dance RH across & LH back',
      '17\u201324 : 1s lead down the middle & back',
      '25\u2013 : 1s+2s allemande'
    ].join('\n'),
    title: 'Kelso Brig'
  },
  {
    bars: 32,
    slug: 'cauldshiels-loch',
    text: [
      '*3s+4s on opposite sides*',
      '1-2 : 3s+4s cross RH',
      '3-8 : 1s+2s circle 4H round,',
      '       1s+2s set',
      '9-16 : 1s lead down the middle & back',
      '17-24 : 1s+2s dance RH across & LH back',
      '25-32 : 1s+2s poussette'
    ].join('\n'),
    title: 'Cauldshiels Loch'
  },
  {
    bars: 32,
    slug: 'duns-law',
    text: [
      '1-4 : 1s+2s dance RH across',
      '5-8 : 1s cast off 2',
      '9-16 : 1s+3s circle 4H round & back',
      '17-24 : 1s+4s rights & lefts',
      '25-26 : 1s cast up 1',
      '27-30 : 1s+3s dance LH across',
      '31-32 : 1s+2s set'
    ].join('\n'),
    title: 'Duns Law'
  },
  {
    bars: 32,
    slug: 'craigie-knowe',
    text: [
      '1-8 : 1s+2s circle 4H round & back',
      '8-16 : 1s lead down the middle & back',
      '17-24 : 1s+2s dance RH across',
      '25-32 : 1s+2s rights & lefts'
    ].join('\n'),
    title: 'Craigie Knowe'
  },
  {
    bars: 32,
    slug: 'lammermuir-reel',
    text: [
      '1-8 : 1s+2s circle 4H round & back',
      '9-16 : 1s+2s dance RH across,',
      '        1s+2s dance LH across,',
      '        1s+2s set',
      '17-24 : 1s lead down the middle & back',
      '25-32 : 1s+2s poussette'
    ].join('\n'),
    title: 'Lammermuir Reel'
  }
];

let cribs = new Map();

function reset() {
  cribs = new Map();
  HOUSE.forEach((crib) => {
    cribs.set(crib.slug, Object.assign({}, crib));
  });
}

function list() {
  return Array.from(cribs.values())
    .map((crib) => ({ bars: crib.bars, slug: crib.slug, title: crib.title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function get(slug) {
  const crib = cribs.get(slug);
  return crib ? Object.assign({}, crib) : null;
}

function save(crib) {
  if (!crib || typeof crib.slug !== 'string' || crib.slug.trim() === '') {
    return null;
  }
  const stored = {
    bars: Number.isFinite(crib.bars) && crib.bars > 0 ? Math.floor(crib.bars) : 32,
    slug: crib.slug.trim(),
    text: typeof crib.text === 'string' ? crib.text : '',
    title: typeof crib.title === 'string' && crib.title.trim() !== '' ? crib.title.trim() : crib.slug.trim()
  };
  cribs.set(stored.slug, stored);
  return Object.assign({}, stored);
}

reset();

module.exports = {
  HOUSE,
  get,
  list,
  reset,
  save
};
