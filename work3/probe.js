'use strict';

const path = require('path');
const APP = path.join(__dirname, 'cribstave-dance-desk/environment/app/backend');
const check = require(path.join(APP, 'lib/check'));
const store = require(path.join(APP, 'lib/store'));

function show(slug) {
  const crib = store.get(slug);
  const out = check.check(crib.text, crib.bars);
  console.log(`\n═══ ${crib.title} (${slug}) ═══`);
  out.phrases.forEach((p) => {
    console.log(
      `  line ${p.line} [${p.span}] needs ${p.needs} gives ${p.gives}  ` +
        `figures: ${p.figures.map((f) => `${f.couples.join('+')} ${f.name}@${f.bar}`).join(' | ')}  ` +
        `-> ${p.orderAfter.join('-')}`
    );
  });
  console.log(`  opening ${out.opening.join('-')}  closing ${out.closing.join('-')}  crossed [${out.crossed}]`);
  if (out.faults.length === 0) {
    console.log('  FAULTS: none — crib is good');
  } else {
    out.faults.forEach((f) => console.log(`  FAULT line ${f.line} bar ${f.bar}: ${f.message}`));
  }
}

['marchmont-rant', 'kelso-brig', 'duns-law', 'craigie-knowe', 'lammermuir-reel'].forEach(show);

console.log('\n═══ ad hoc: numbers adjacent but places are not ═══');
const adhoc = [
  '1-4 : 1s+2s dance RH across',
  '5-8 : 1s cast off 2',
  '9-16 : 1s+2s circle 4H round & back',
  '17-24 : 1s+4s rights & lefts',
  '25-32 : 1s+2s poussette'
].join('\n');
check.check(adhoc, 32).faults.forEach((f) => console.log(`  FAULT line ${f.line} bar ${f.bar}: ${f.message}`));

console.log('\n═══ sides: crossed and never brought back ═══');
check.check(
  ['*3s+4s on opposite sides*', '1-8 : 1s+2s circle 4H round & back', '9-16 : 1s lead down the middle & back', '17-24 : 1s+2s dance RH across & LH back', '25-32 : 1s+2s poussette'].join('\n'),
  32
).faults.forEach((f) => console.log(`  FAULT line ${f.line} bar ${f.bar}: ${f.message}`));

console.log('\n═══ sides: crossing an uncrossed couple ═══');
check.check(['1-2 : 3s+4s cross RH', '3-8 : 1s+2s circle 4H round, 1s+2s set', '9-16 : 1s lead down the middle & back', '17-24 : 1s+2s dance RH across & LH back', '25-32 : 1s+2s poussette'].join('\n'), 32)
  .faults.forEach((f) => console.log(`  FAULT line ${f.line} bar ${f.bar}: ${f.message}`));

console.log('\n═══ progression: shuffled home again ═══');
check.check(['1-8 : 1s+2s poussette', '9-16 : 1s+2s poussette', '17-24 : 1s lead down the middle & back', '25-32 : 1s+2s rights & lefts'].join('\n'), 32)
  .faults.forEach((f) => console.log(`  FAULT line ${f.line} bar ${f.bar}: ${f.message}`));

console.log('\n═══ bar attribution: second figure of a phrase is the wrong one ═══');
check.check(['1-8 : 1s+2s set & link, 1s+4s dance RH across', '9-16 : 1s lead down the middle & back', '17-24 : 1s+2s dance RH across & LH back', '25-32 : 1s+2s set & link'].join('\n'), 32)
  .faults.forEach((f) => console.log(`  FAULT line ${f.line} bar ${f.bar}: ${f.message}`));
