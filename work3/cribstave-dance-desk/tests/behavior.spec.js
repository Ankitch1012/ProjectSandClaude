const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const FIXTURE_PATH = process.env.FIXTURE_PATH || '/logs/verifier/fixture.json';

const ARTIFACTS = process.env.ARTIFACTS_DIR || '/logs/artifacts';
try {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
} catch (e) {
  void e;
}

const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

const EN = '\u2013';

// How long the desk's own figure book says a figure lasts, so nothing below
// depends on a bar count written into the checks.
function bars(name) {
  const length = FIXTURE.bars[name];
  if (typeof length !== 'number') {
    throw new Error(`the figure book published no length for "${name}"`);
  }
  return length;
}

function writeJson(name, data) {
  try {
    fs.writeFileSync(path.join(ARTIFACTS, name), JSON.stringify(data, null, 2));
  } catch (e) {
    void e;
  }
}

/* ------------------------------------------------------------------ *
 * cribs, written the way a devisor writes them
 * ------------------------------------------------------------------ */

const SOUND_IN_EN_DASHES = [
  `1${EN}8 : 1s+2s circle 4H round & back`,
  `9${EN}16 : 1s+2s dance RH across & LH back`,
  `17${EN}24 : 1s lead down the middle & back`,
  `25${EN}32 : 1s+2s allemande`
];

const EN_DASH_WITH_AN_OPEN_SPAN = [
  `1${EN}8 : 1s+2s circle 4H round & back`,
  `9${EN} : 1s+2s dance RH across & LH back`,
  `17${EN}24 : 1s lead down the middle & back`,
  `25${EN}32 : 1s+2s poussette`
];

const EVERY_BAR_ONCE = [
  '1-4 : 1s+2s dance RH across',
  '5-8 : 1s+2s dance LH across',
  '9-16 : 1s+2s poussette',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const A_HOLE_IN_THE_DANCE = [
  '1-8 : 1s+2s poussette',
  '9-16 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const ONE_BAR_CLAIMED_TWICE = [
  '1-8 : 1s+2s poussette',
  '9-16 : 1s+2s poussette',
  '16-23 : 1s+2s allemande'
];

const CARRIED_OVER_TWO_LINES = [
  '1-8 : 1s+2s poussette',
  '9-16 : 1s+2s dance RH across,',
  '        1s+2s dance LH across',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const CARRIED_OVER_THREE_LINES = [
  '1-8 : 1s+2s poussette',
  '9-16 : 1s+2s dance RH across,',
  '        1s+2s set,',
  '        1s+2s set',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const A_FIGURE_NAMED_WITH_AN_AMPERSAND = [
  '1-8 : 1s+2s rights & lefts',
  '9-16 : 1s+2s poussette',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const THERE_AND_BACK = [
  '1-8 : 1s+2s circle 4H round & back',
  '9-16 : 1s+2s dance RH across & LH back',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s rights & lefts'
];

const TWO_FIGURES_ON_ONE_LINE = [
  '1-8 : 1s+2s set & link, 1s+2s dance RH across',
  '9-16 : 1s+2s dance LH across & RH back',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s poussette'
];

const STANDING_APART_THOUGH_NUMBERED_TOGETHER = [
  '1-4 : 1s+2s dance RH across',
  '5-8 : 1s cast off 2',
  '9-16 : 1s+3s set, 1s+2s dance RH across, 1s+3s set',
  '17-24 : 1s+3s poussette',
  '25-32 : 1s+2s dance RH across, 1s+2s dance LH across'
];

const SIDE_BY_SIDE_THOUGH_NUMBERED_APART = [
  '1-4 : 1s+2s dance RH across',
  '5-8 : 1s cast off 2',
  '9-16 : 1s+3s poussette',
  '17-24 : 1s+2s rights & lefts',
  '25-32 : 1s+3s rights & lefts'
];

const TOP_FIGURE_AFTER_THEY_MOVED_DOWN = [
  '1-4 : 1s+2s dance RH across',
  '5-8 : 1s cast off 2',
  '9-16 : 1s+3s set, 1s lead down the middle, 1s+3s set',
  '17-24 : 1s+3s poussette',
  '25-32 : 1s+2s dance RH across, 1s+2s dance LH across'
];

const TOP_FIGURE_ONCE_ANOTHER_COUPLE_IS_THERE = [
  '1-4 : 1s+2s dance RH across',
  '5-8 : 1s cast off 2',
  '9-16 : 1s+3s set, 2s lead down the middle, 1s+3s set',
  '17-24 : 1s+3s poussette',
  '25-32 : 1s+2s dance RH across, 1s+2s dance LH across'
];

const EVERYONE_HOME_AGAIN = [
  '1-8 : 1s+2s poussette',
  '9-16 : 1s+2s poussette',
  '17-24 : 1s+2s dance RH across, 1s+2s dance LH across',
  '25-32 : 1s+2s dance RH across, 1s+2s dance LH across'
];

const THE_SET_LEFT_IN_A_JUMBLE = [
  '1-8 : 2s+3s poussette',
  '9-16 : 1s+3s dance RH across, 1s+3s dance LH across',
  '17-24 : 1s+3s dance RH across, 1s+3s dance LH across',
  '25-32 : 1s+3s dance RH across, 1s+3s dance LH across'
];

const CROSSED_AND_NEVER_BROUGHT_HOME = [
  '*3s+4s on opposite sides*',
  '1-8 : 1s+2s poussette',
  '9-16 : 1s+2s poussette',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s rights & lefts'
];

const CROSSED_AND_BROUGHT_HOME = [
  '*3s+4s on opposite sides*',
  '1-2 : 3s+4s cross RH',
  '3-8 : 1s+2s circle 4H round, 1s+2s set',
  '9-16 : 1s+2s poussette',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const SECOND_FIGURE_AT_FAULT = [
  '1-8 : 1s+2s dance RH across, 1s+4s dance LH across',
  '9-16 : 1s+2s poussette',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const FOURTH_FIGURE_AT_FAULT = [
  '1-12 : 1s+2s set, 1s+2s dance RH across, 1s+2s set, 1s+4s dance RH across',
  '13-20 : 1s+2s poussette',
  '21-28 : 1s+2s poussette',
  '29-32 : 1s+2s 1/2 poussette'
];

const NO_ROOM_TO_CAST = [
  '1-8 : 1s+2s dance RH across, 4s cast off 2',
  '9-16 : 1s+2s poussette',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const TWO_PHRASES_COMING_UP_SHORT = [
  '1-8 : 1s+2s 1/2 poussette',
  '9-16 : 1s+2s dance LH across',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const FAULTS_ON_SEPARATE_LINES = [
  '1-8 : 1s+2s poussette',
  '9-16 : 1s+2s dance LH across',
  '17-24 : 1s+2s dance RH across',
  '25-32 : 1s+2s allemande'
];

const A_FIGURE_NOT_IN_THE_BOOK = [
  '1-8 : 1s+2s dance a jig',
  '9-16 : 1s+2s poussette',
  '17-24 : 1s+2s poussette',
  '25-32 : 1s+2s allemande'
];

const A_LONG_CRIB_FOR_THE_MARGIN = [
  '*3s+4s on opposite sides*',
  '1-2 : 3s+4s cross RH',
  '3-8 : 1s+2s circle 4H round, 1s+2s set',
  '9-12 : 1s+2s dance RH across',
  '13-16 : 1s+2s dance LH across',
  '17-20 : 1s+2s 1/2 poussette',
  '21-24 : 1s+2s 1/2 poussette',
  '25-28 : 1s+2s 1/2 poussette',
  '29-32 : 1s+2s dance RH across'
];

/* ------------------------------------------------------------------ *
 * working the desk
 * ------------------------------------------------------------------ */

async function openDesk(page) {
  await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-ready="yes"]');
  await page.waitForSelector('[data-testid="phrase"]');
}

// Write a crib into the desk and wait until the stave is showing that crib and
// nothing else, so no check reads a report left over from the crib before it.
async function writeCrib(page, lines, danceBars) {
  await page.fill('[data-testid="bars"]', String(danceBars === undefined ? 32 : danceBars));
  await page.fill('[data-testid="crib-text"]', lines.join('\n'));
  await page.click('[data-testid="check"]');
  await page.waitForFunction(
    (written) => {
      const rows = Array.from(document.querySelectorAll('[data-testid="source-line"]'));
      return rows.length === written.length && rows.every((row, i) => row.textContent === (written[i] === '' ? ' ' : written[i]));
    },
    lines,
    { timeout: 15000 }
  );
}

async function readReport(page) {
  return page.evaluate(() => {
    const number = (element, name) => {
      const raw = element.getAttribute(name);
      return raw === null || raw === '' ? null : Number(raw);
    };
    const verdict = document.getElementById('verdict');
    return {
      announced: number(verdict, 'data-fault-count'),
      good: verdict.getAttribute('data-good'),
      faults: Array.from(document.querySelectorAll('[data-testid="fault"]')).map((row) => ({
        bar: number(row, 'data-bar'),
        line: number(row, 'data-line'),
        says: row.querySelector('[data-testid="fault-says"]').textContent.trim()
      })),
      markedLines: Array.from(document.querySelectorAll('[data-testid="gutter-line"][data-faulted="yes"]')).map((row) =>
        Number(row.getAttribute('data-line'))
      ),
      phrases: Array.from(document.querySelectorAll('[data-testid="phrase"]')).map((row) => ({
        gives: number(row, 'data-gives'),
        line: number(row, 'data-line'),
        needs: number(row, 'data-needs'),
        order: row.getAttribute('data-order'),
        span: row.getAttribute('data-span')
      })),
      topRow: Array.from(
        document.querySelectorAll('[data-testid="set-row"]')[0].querySelectorAll('[data-testid="place-token"]')
      ).map((token) => ({
        couple: Number(token.getAttribute('data-couple')),
        place: Number(token.getAttribute('data-place')),
        side: token.getAttribute('data-side')
      }))
    };
  });
}

function faultBars(report) {
  return report.faults.map((fault) => fault.bar).sort((a, b) => a - b);
}

async function measureMargin(page) {
  return page.evaluate(() => {
    window.scrollTo(0, 0);
    const gutter = Array.from(document.querySelectorAll('[data-testid="gutter-line"]'));
    const source = Array.from(document.querySelectorAll('[data-testid="source-line"]'));
    const middle = (element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    const drift = gutter.map((row, index) => Number((middle(row) - middle(source[index])).toFixed(1)));
    return {
      drift,
      gutterRows: gutter.length,
      gutterRowHeight: Number(gutter[1].getBoundingClientRect().height.toFixed(1)),
      lastDrift: Math.abs(drift[drift.length - 1]),
      sourceRowHeight: Number(source[1].getBoundingClientRect().height.toFixed(1)),
      sourceRows: source.length,
      worstDrift: Math.max.apply(null, drift.map(Math.abs))
    };
  });
}

async function measureSetHeadings(page) {
  return page.evaluate(() => {
    window.scrollTo(0, 0);
    const headings = Array.from(document.querySelectorAll('[data-testid="place-header"]'));
    const rows = Array.from(document.querySelectorAll('[data-testid="set-row"]'));
    const middle = (element) => {
      const box = element.getBoundingClientRect();
      return box.left + box.width / 2;
    };
    const offsets = rows.map((row) => {
      const tokens = Array.from(row.querySelectorAll('[data-testid="place-token"]'));
      return headings.map((heading, index) => Number((middle(heading) - middle(tokens[index])).toFixed(1)));
    });
    const flat = offsets.reduce((all, one) => all.concat(one), []);
    return {
      headings: headings.length,
      offsets,
      worst: Math.max.apply(null, flat.map(Math.abs))
    };
  });
}

/* ------------------------------------------------------------------ *
 * D1 · bar spans written with an en dash
 * ------------------------------------------------------------------ */

test('[F2P][D1] A crib whose bar spans are written with an en dash is read instead of being rejected line by line.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, SOUND_IN_EN_DASHES, 32);
  const report = await readReport(page);
  writeJson('d1-en-dash-sound.json', report);
  expect({ good: report.good, faults: report.faults.length, phrases: report.phrases.length }).toEqual({
    good: 'yes',
    faults: 0,
    phrases: 4
  });
});

test('[F2P][D1] Every phrase of an en-dash crib is listed under the bars it was written against.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, SOUND_IN_EN_DASHES, 32);
  const report = await readReport(page);
  expect(report.phrases.map((phrase) => phrase.span)).toEqual(['1-8', '9-16', '17-24', '25-32']);
  expect(report.phrases.map((phrase) => phrase.needs)).toEqual([
    bars('circle 4H round & back'),
    bars('dance RH across & LH back'),
    bars('lead down the middle & back'),
    bars('allemande')
  ]);
});

test('[F2P][D1] A phrase left open at its closing bar runs to the bar before the next phrase opens.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, EN_DASH_WITH_AN_OPEN_SPAN, 32);
  const report = await readReport(page);
  expect({ good: report.good, second: report.phrases[1] }).toEqual({
    good: 'yes',
    second: { gives: 8, line: 2, needs: bars('dance RH across & LH back'), order: '1-2-3-4', span: '9-16' }
  });
});

/* ------------------------------------------------------------------ *
 * D2 · the bar a phrase hands on to
 * ------------------------------------------------------------------ */

test('[F2P][D2] A crib whose phrases follow one another bar by bar is passed with nothing said against it.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, EVERY_BAR_ONCE, 32);
  const report = await readReport(page);
  writeJson('d2-contiguous.json', report);
  expect({ good: report.good, faults: report.faults.length }).toEqual({ good: 'yes', faults: 0 });
});

test('[F2P][D2] A hole in a dance is reported from the first bar that is actually missing.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, A_HOLE_IN_THE_DANCE, 32);
  const report = await readReport(page);
  expect(faultBars(report)).toEqual([17]);
});

test('[F2P][D2] Two phrases that both lay claim to the same bar are reported against that bar.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, ONE_BAR_CLAIMED_TWICE, 23);
  const report = await readReport(page);
  expect(faultBars(report)).toEqual([16]);
});

/* ------------------------------------------------------------------ *
 * D3 · a phrase carried onto the lines below it
 * ------------------------------------------------------------------ */

test('[F2P][D3] A phrase carried onto a second line is counted with the figures written above it.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, CARRIED_OVER_TWO_LINES, 32);
  const report = await readReport(page);
  writeJson('d3-carried.json', report);
  expect(report.phrases[1]).toEqual({
    gives: 8,
    line: 2,
    needs: bars('dance RH across') + bars('dance LH across'),
    order: '2-1-3-4',
    span: '9-16'
  });
});

test('[F2P][D3] A crib with a carried phrase is passed when the whole phrase fills its bars.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, CARRIED_OVER_TWO_LINES, 32);
  const report = await readReport(page);
  expect({ good: report.good, faults: report.faults.length, phrases: report.phrases.length }).toEqual({
    good: 'yes',
    faults: 0,
    phrases: 4
  });
});

test('[F2P][D3] A phrase carried over three lines counts the figures on all three of them.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, CARRIED_OVER_THREE_LINES, 32);
  const report = await readReport(page);
  expect({ good: report.good, needs: report.phrases[1].needs }).toEqual({
    good: 'yes',
    needs: bars('dance RH across') + bars('set') + bars('set')
  });
});

/* ------------------------------------------------------------------ *
 * D4 · reading a figure out of the book
 * ------------------------------------------------------------------ */

test('[F2P][D4] A figure the book prints with an ampersand in its name is accepted at its published length.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, A_FIGURE_NAMED_WITH_AN_AMPERSAND, 32);
  const report = await readReport(page);
  writeJson('d4-ampersand.json', report);
  expect({ good: report.good, faults: report.faults.length, needs: report.phrases[0].needs }).toEqual({
    good: 'yes',
    faults: 0,
    needs: bars('rights & lefts')
  });
});

test('[F2P][D4] A figure danced there and back is counted at its full length rather than half of it.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, THERE_AND_BACK, 32);
  const report = await readReport(page);
  expect({
    good: report.good,
    first: report.phrases[0].needs,
    second: report.phrases[1].needs
  }).toEqual({
    good: 'yes',
    first: bars('circle 4H round & back'),
    second: bars('dance RH across & LH back')
  });
});

test('[F2P][D4] Two figures written on one line are each read whole, ampersands and all.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, TWO_FIGURES_ON_ONE_LINE, 32);
  const report = await readReport(page);
  expect({ good: report.good, first: report.phrases[0].needs, second: report.phrases[1].needs }).toEqual({
    good: 'yes',
    first: bars('set & link') + bars('dance RH across'),
    second: bars('dance LH across & RH back')
  });
});

/* ------------------------------------------------------------------ *
 * D5 · who is standing next to whom
 * ------------------------------------------------------------------ */

test('[F2P][D5] A figure for two couples standing apart is refused even though their numbers run together.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, STANDING_APART_THOUGH_NUMBERED_TOGETHER, 32);
  const report = await readReport(page);
  writeJson('d5-apart.json', report);
  expect(faultBars(report)).toEqual([11]);
});

test('[F2P][D5] A figure for two couples standing side by side is allowed even though their numbers do not run together.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, SIDE_BY_SIDE_THOUGH_NUMBERED_APART, 32);
  const report = await readReport(page);
  expect({ good: report.good, faults: report.faults.length }).toEqual({ good: 'yes', faults: 0 });
});


/* ------------------------------------------------------------------ *
 * D6 · the bar a figure begins on
 * ------------------------------------------------------------------ */

test('[F2P][D6] A figure for the couple at the top is refused once an earlier phrase has cast them down.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, TOP_FIGURE_AFTER_THEY_MOVED_DOWN, 32);
  const report = await readReport(page);
  writeJson('d6-moved-down.json', report);
  expect(faultBars(report)).toEqual([11]);
});

test('[F2P][D6] A figure for the couple at the top is allowed once an earlier phrase has put another couple there.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, TOP_FIGURE_ONCE_ANOTHER_COUPLE_IS_THERE, 32);
  const report = await readReport(page);
  expect({ good: report.good, faults: report.faults.length }).toEqual({ good: 'yes', faults: 0 });
});

/* ------------------------------------------------------------------ *
 * D7 · handing the set on
 * ------------------------------------------------------------------ */

test('[F2P][D7] A dance that leaves every couple where they started is refused at its last bar.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, EVERYONE_HOME_AGAIN, 32);
  const report = await readReport(page);
  writeJson('d7-home-again.json', report);
  expect(faultBars(report)).toEqual([32]);
  expect(report.phrases[report.phrases.length - 1].order).toBe('1-2-3-4');
});

test('[F2P][D7] A dance that leaves the set in an order it cannot be danced from again is refused.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, THE_SET_LEFT_IN_A_JUMBLE, 32);
  const report = await readReport(page);
  expect(faultBars(report)).toEqual([32]);
  expect(report.phrases[report.phrases.length - 1].order).toBe('1-3-2-4');
});

/* ------------------------------------------------------------------ *
 * D8 · couples sent across the set
 * ------------------------------------------------------------------ */

test('[F2P][D8] Couples the preamble sends across the set and never brings back are reported at the last bar.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, CROSSED_AND_NEVER_BROUGHT_HOME, 32);
  const report = await readReport(page);
  writeJson('d8-stranded.json', report);
  expect(faultBars(report)).toEqual([32]);
});

test('[F2P][D8] A crib that brings its crossed couples back to their own side is passed.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, CROSSED_AND_BROUGHT_HOME, 32);
  const report = await readReport(page);
  expect({ good: report.good, faults: report.faults.length }).toEqual({ good: 'yes', faults: 0 });
});

test('[F2P][D8] The set diagram shows which couples the preamble put across the dance before bar 1.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, CROSSED_AND_BROUGHT_HOME, 32);
  const report = await readReport(page);
  expect(report.topRow).toEqual([
    { couple: 1, place: 1, side: 'own' },
    { couple: 2, place: 2, side: 'own' },
    { couple: 3, place: 3, side: 'opposite' },
    { couple: 4, place: 4, side: 'opposite' }
  ]);
});

/* ------------------------------------------------------------------ *
 * D9 · the bar a fault is filed under
 * ------------------------------------------------------------------ */

test('[F2P][D9] A fault in the second figure of a phrase is filed under that figure and not under the phrase.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, SECOND_FIGURE_AT_FAULT, 32);
  const report = await readReport(page);
  writeJson('d9-second-figure.json', report);
  expect(faultBars(report)).toEqual([1 + bars('dance RH across')]);
});

test('[F2P][D9] A fault in the fourth figure of a phrase is filed under that figure and not under the phrase.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, FOURTH_FIGURE_AT_FAULT, 32);
  const report = await readReport(page);
  expect(faultBars(report)).toEqual([1 + bars('set') + bars('dance RH across') + bars('set')]);
});

test('[F2P][D9] A figure a couple has no room to dance is filed under that figure and not under the phrase.', async ({
  page
}) => {
  await openDesk(page);
  await writeCrib(page, NO_ROOM_TO_CAST, 32);
  const report = await readReport(page);
  expect(faultBars(report)).toEqual([1 + bars('dance RH across')]);
  expect(report.faults.map((fault) => fault.line)).toEqual([1]);
});

/* ------------------------------------------------------------------ *
 * D10 · the whole of the report
 * ------------------------------------------------------------------ */

test('[F2P][D10] A crib with more than one thing wrong has more than one fault listed against it.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, TWO_PHRASES_COMING_UP_SHORT, 32);
  const report = await readReport(page);
  writeJson('d10-two-faults.json', report);
  expect(report.faults.length).toBeGreaterThan(1);
});

test('[F2P][D10] Every fault a crib has earned is listed, under the bar each one belongs to.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, TWO_PHRASES_COMING_UP_SHORT, 32);
  const report = await readReport(page);
  expect(faultBars(report)).toEqual([1, 9]);
});

test('[F2P][D10] Every line the report finds fault with is marked in the margin of the crib.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, FAULTS_ON_SEPARATE_LINES, 32);
  const report = await readReport(page);
  const named = Array.from(new Set(report.faults.map((fault) => fault.line))).sort((a, b) => a - b);
  expect(report.markedLines.sort((a, b) => a - b)).toEqual(named);
  expect(named.length).toBeGreaterThan(1);
});

test('[F2P][D10] The number of faults the desk announces is the number it can show.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, FAULTS_ON_SEPARATE_LINES, 32);
  const report = await readReport(page);
  expect({ announced: report.announced, listed: report.faults.length }).toEqual({ announced: 3, listed: 3 });
});

/* ------------------------------------------------------------------ *
 * D11 · the desk on screen
 * ------------------------------------------------------------------ */

test('[F2P][D11] Every number in the margin stands beside the line of the crib it counts.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, A_LONG_CRIB_FOR_THE_MARGIN, 32);
  const margin = await measureMargin(page);
  writeJson('d11-margin.json', margin);
  expect(margin.gutterRows).toBe(margin.sourceRows);
  expect(margin.worstDrift).toBeLessThanOrEqual(4);
});

test('[F2P][D11] The margin numbering has not drifted away from the crib by the foot of a long dance.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, A_LONG_CRIB_FOR_THE_MARGIN, 32);
  const margin = await measureMargin(page);
  expect(margin.gutterRows).toBeGreaterThanOrEqual(9);
  expect(margin.lastDrift).toBeLessThanOrEqual(4);
});

test('[F2P][D11] The margin and the writing beside it are set to the same rhythm.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, A_LONG_CRIB_FOR_THE_MARGIN, 32);
  const margin = await measureMargin(page);
  expect(Math.abs(margin.gutterRowHeight - margin.sourceRowHeight)).toBeLessThanOrEqual(1);
});

test('[F2P][D11] Each place heading in the set stands over the couple standing in that place.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, A_LONG_CRIB_FOR_THE_MARGIN, 32);
  const headings = await measureSetHeadings(page);
  writeJson('d11-set-headings.json', headings);
  expect(headings.headings).toBe(4);
  expect(headings.worst).toBeLessThanOrEqual(8);
});

/* ------------------------------------------------------------------ *
 * what the desk does whether or not any of the above is put right
 * ------------------------------------------------------------------ */

test('[P2P] The desk publishes the figure book with a length against every figure.', async ({ page }) => {
  await openDesk(page);
  const book = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="book-line"]')).map((row) => ({
      bars: Number(row.getAttribute('data-bars')),
      name: row.getAttribute('data-figure')
    }))
  );
  expect(book.length).toBeGreaterThanOrEqual(20);
  expect(book.every((figure) => figure.bars > 0 && figure.name.length > 0)).toBe(true);
  expect(book.map((figure) => figure.name)).toContain('rights & lefts');
});

test('[P2P] The crib library offers every dance the desk is holding, the devised one included.', async ({ page }) => {
  await openDesk(page);
  const offered = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#crib-picker option')).map((option) => option.value)
  );
  FIXTURE.houseCribs.forEach((crib) => {
    expect(offered).toContain(crib.slug);
  });
  expect(offered).toContain(FIXTURE.devised.slug);
});

test('[P2P] Choosing a dance from the library puts its writing into the editor.', async ({ page }) => {
  await openDesk(page);
  await page.selectOption('[data-testid="crib-picker"]', FIXTURE.devised.slug);
  await page.waitForFunction(
    (expected) => document.getElementById('crib-text').value === expected,
    FIXTURE.devised.text,
    { timeout: 15000 }
  );
  const written = await page.inputValue('[data-testid="crib-text"]');
  expect(written).toBe(FIXTURE.devised.text);
});

test('[P2P] The stave sets out one numbered row for every line the devisor wrote.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, A_LONG_CRIB_FOR_THE_MARGIN, 32);
  const counted = await page.evaluate(() => ({
    gutter: document.querySelectorAll('[data-testid="gutter-line"]').length,
    numbers: Array.from(document.querySelectorAll('[data-testid="gutter-line"]')).map((row) =>
      Number(row.getAttribute('data-line'))
    ),
    source: document.querySelectorAll('[data-testid="source-line"]').length
  }));
  expect(counted.gutter).toBe(A_LONG_CRIB_FOR_THE_MARGIN.length);
  expect(counted.source).toBe(A_LONG_CRIB_FOR_THE_MARGIN.length);
  expect(counted.numbers).toEqual(A_LONG_CRIB_FOR_THE_MARGIN.map((line, index) => index + 1));
});

test('[P2P] The stave reprints the crib exactly as it was written, indents and all.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, CARRIED_OVER_THREE_LINES, 32);
  const shown = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="source-line"]')).map((row) => row.textContent)
  );
  expect(shown).toEqual(CARRIED_OVER_THREE_LINES);
});

test('[P2P] A figure the book does not contain is named back to the devisor against its own bar.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, A_FIGURE_NOT_IN_THE_BOOK, 32);
  const report = await readReport(page);
  const first = report.faults[0];
  expect(report.good).toBe('no');
  expect({ bar: first.bar, line: first.line }).toEqual({ bar: 1, line: 1 });
  expect(first.says.length).toBeGreaterThan(0);
});

test('[P2P] An empty crib is not passed as a dance.', async ({ page }) => {
  await openDesk(page);
  await page.fill('[data-testid="crib-text"]', '');
  await page.click('[data-testid="check"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="phrase"]').length === 0, null, {
    timeout: 15000
  });
  const report = await readReport(page);
  expect(report.good).toBe('no');
  expect(report.faults.length).toBeGreaterThanOrEqual(1);
});

test('[P2P] The set diagram opens with a rank for the top of the dance and adds one for every phrase.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, EVERY_BAR_ONCE, 32);
  const counted = await page.evaluate(() => ({
    ranks: document.querySelectorAll('[data-testid="set-row"]').length,
    phrases: document.querySelectorAll('[data-testid="phrase"]').length,
    tokensInEachRank: Array.from(document.querySelectorAll('[data-testid="set-row"]')).map(
      (row) => row.querySelectorAll('[data-testid="place-token"]').length
    )
  }));
  expect(counted.ranks).toBe(counted.phrases + 1);
  expect(counted.tokensInEachRank.every((count) => count === 4)).toBe(true);
});

test('[P2P] The set diagram shows the couples in the places each phrase leaves them.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, SIDE_BY_SIDE_THOUGH_NUMBERED_APART, 32);
  const report = await readReport(page);
  expect(report.phrases.map((phrase) => phrase.order)).toEqual([
    '1-2-3-4',
    '2-3-1-4',
    '2-1-3-4',
    '2-1-3-4',
    '2-1-3-4'
  ]);
});

test('[P2P] Every phrase is listed with the span it was written under and the bars it asks for.', async ({ page }) => {
  await openDesk(page);
  await writeCrib(page, EVERY_BAR_ONCE, 32);
  const report = await readReport(page);
  expect(report.phrases.map((phrase) => phrase.span)).toEqual(['1-4', '5-8', '9-16', '17-24', '25-32']);
  expect(report.phrases.map((phrase) => phrase.gives)).toEqual([4, 4, 8, 8, 8]);
  expect(report.phrases.map((phrase) => phrase.line)).toEqual([1, 2, 3, 4, 5]);
});

test('[P2P] The desk reaches its checking service from the address the page was served from.', async ({ page }) => {
  const calls = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      calls.push({ status: response.status(), url: response.url() });
    }
  });
  await openDesk(page);
  await writeCrib(page, EVERY_BAR_ONCE, 32);
  expect(calls.length).toBeGreaterThanOrEqual(3);
  expect(calls.every((call) => call.url.startsWith(FRONTEND))).toBe(true);
  expect(calls.every((call) => call.status === 200)).toBe(true);
});
