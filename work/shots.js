'use strict';

const path = require('path');
const { chromium } = require(path.join(
  '/Users/ankitchauhan/Desktop/AfterQuery/Project Sand/pw-runner/node_modules/playwright'
));

const LABEL = process.argv[2] || 'state';
const ORIGIN = process.argv[3] || 'http://localhost:3051';
const OUT_DIR = process.argv[4] || '/tmp/cleftwood-shots';
const NARROW = { width: 900, height: 760 };
const DESKTOP = { width: 1280, height: 900 };

async function call(pathname, body) {
  const response = await fetch(`${ORIGIN}/api${pathname}`, body === undefined
    ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

async function seedShotState() {
  await call('/test/reset', {});
  await call('/test/hand-name', { name: 'Wren Halloway' });
  await call('/test/script', {
    hand: 'shot',
    steps: [
      { visit: 'west-row', option: 'bind-west' },
      { visit: 'nursery-bed', option: 'bind-nursery' },
      { visit: 'tape-run', option: 'bind-east' }
    ]
  });
  await call('/hands/shot/pages', { pageId: 'before the frost', label: 'before the frost' });
  await call('/hands/shot/visit', { visitId: 'bud-swell' });
}

const MEASURE = () => {
  const box = (selector, index) => {
    const nodes = document.querySelectorAll(selector);
    const node = nodes[index || 0];
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return {
      top: +r.top.toFixed(1), left: +r.left.toFixed(1),
      bottom: +r.bottom.toFixed(1), right: +r.right.toFixed(1),
      width: +r.width.toFixed(1), height: +r.height.toFixed(1)
    };
  };
  const overlap = (a, b) => {
    if (!a || !b) return null;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? +(w * h).toFixed(1) : 0;
  };

  const line = document.querySelector('[data-testid="visit-line"]');
  const choices = Array.from(document.querySelectorAll('[data-testid="choice"]'));
  const choiceBoxes = choices.map((_, i) => box('[data-testid="choice"]', i));

  let worstChoiceOverlap = 0;
  let smallestGap = Infinity;
  for (let i = 0; i < choiceBoxes.length; i += 1) {
    for (let j = i + 1; j < choiceBoxes.length; j += 1) {
      worstChoiceOverlap = Math.max(worstChoiceOverlap, overlap(choiceBoxes[i], choiceBoxes[j]));
    }
    if (i > 0) {
      smallestGap = Math.min(smallestGap, +(choiceBoxes[i].top - choiceBoxes[i - 1].bottom).toFixed(1));
    }
  }

  const boardBox = box('[data-testid="graft-board"]');
  const choicesBox = box('[data-testid="visit-choices"]');
  const standingsBox = box('[data-testid="standings"]');
  const visitBox = box('[data-testid="visit-panel"]');

  const gaugeFits = Array.from(document.querySelectorAll('[data-testid="standing"]')).map((node) => {
    const amount = node.querySelector('.gauge-amount');
    if (!amount) return false;
    return amount.scrollWidth <= amount.clientWidth + 1;
  });

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentScrollWidth: document.documentElement.scrollWidth,
    lineClipped: line ? line.scrollHeight > line.clientHeight + 1 : null,
    lineScrollHeight: line ? line.scrollHeight : null,
    lineClientHeight: line ? line.clientHeight : null,
    choiceCount: choices.length,
    worstChoiceOverlap,
    smallestChoiceGap: smallestGap === Infinity ? null : smallestGap,
    boardOverVisit: overlap(boardBox, visitBox),
    boardOverLine: overlap(boardBox, box('[data-testid="visit-line"]')),
    boardOverChoices: overlap(boardBox, choicesBox),
    standingsOverChoices: overlap(standingsBox, choicesBox),
    standingsOverVisit: overlap(standingsBox, visitBox),
    gaugeValuesFit: gaugeFits.every(Boolean),
    boardBox,
    choicesBox,
    standingsBox
  };
};

async function main() {
  await seedShotState();

  const browser = await chromium.launch({ channel: 'chrome' });
  const results = {};

  for (const [name, viewport] of [['narrow', NARROW], ['desktop', DESKTOP]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/?hand=shot&visit=bud-swell`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="choice"]');
    await page.waitForTimeout(250);
    results[name] = await page.evaluate(MEASURE);
    await page.screenshot({ path: `${OUT_DIR}/${LABEL}-${name}.png`, fullPage: false });
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
