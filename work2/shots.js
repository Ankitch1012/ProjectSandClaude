'use strict';

const path = require('path');
const { chromium } = require(path.join(
  '/Users/ankitchauhan/Desktop/AfterQuery/Project Sand/pw-runner/node_modules/playwright'
));

const LABEL = process.argv[2] || 'state';
const ORIGIN = process.argv[3] || 'http://localhost:3071';
const OUT_DIR = process.argv[4] || '/tmp/bywash-shots';
const NARROW = { width: 900, height: 780 };
const FULL = { width: 1280, height: 900 };

const PLAN = [
  { chamber: 'wharf-tail', operation: 'open-tail-gate' },
  { operation: 'boat-up' },
  { chamber: 'wharf-tail', operation: 'shut-tail-gate' },
  { chamber: 'wharf-tail', operation: 'raise-head-paddle' },
  { chamber: 'wharf-tail', operation: 'drop-head-paddle' },
  { chamber: 'wharf-tail', operation: 'open-head-gate' },
  { operation: 'boat-up' },
  { chamber: 'wharf-tail', operation: 'shut-head-gate' },
  { chamber: 'stair-foot', operation: 'open-tail-gate' },
  { operation: 'boat-up' },
  { chamber: 'stair-foot', operation: 'shut-tail-gate' },
  { chamber: 'stair-head', operation: 'raise-head-paddle' },
  { chamber: 'stair-head', operation: 'drop-head-paddle' },
  { chamber: 'stair-foot', operation: 'raise-head-paddle' },
  { chamber: 'stair-foot', operation: 'drop-head-paddle' }
];

async function call(pathname, body) {
  const response = await fetch(`${ORIGIN}/api${pathname}`, body === undefined
    ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return response.json().catch(() => null);
}

const MEASURE = () => {
  window.scrollTo(0, 0);

  const boxOf = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height };
  };
  const one = (s) => boxOf(document.querySelector(s));
  const overlap = (a, b) => {
    if (!a || !b) return 0;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0.5 && h > 0.5 ? Math.round(w * h) : 0;
  };

  const chambers = Array.from(document.querySelectorAll('[data-testid="chamber"]'));
  const boxes = chambers.map(boxOf);
  let worstChamberOverlap = 0;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      worstChamberOverlap = Math.max(worstChamberOverlap, overlap(boxes[i], boxes[j]));
    }
  }

  const stage = one('[data-testid="flight-stage"]');
  const insideStage = boxes.every(
    (b) => b.top >= stage.top - 0.5 && b.bottom <= stage.bottom + 0.5
      && b.left >= stage.left - 0.5 && b.right <= stage.right + 0.5
  );

  const namesReadable = chambers.every((chamber) => {
    const name = chamber.querySelector('[data-testid="chamber-name"]');
    if (!name) return false;
    const nb = boxOf(name);
    const cb = boxOf(chamber);
    return name.scrollWidth <= name.clientWidth + 1
      && nb.right <= cb.right + 0.5 && nb.left >= cb.left - 0.5
      && nb.bottom <= cb.bottom + 0.5;
  });

  return {
    viewportWidth: window.innerWidth,
    pageWiderThanWindow: document.documentElement.scrollWidth > window.innerWidth + 1,
    chamberCount: chambers.length,
    worstChamberOverlap,
    chambersInsideStage: insideStage,
    chamberNamesReadable: namesReadable,
    planOverStage: overlap(one('[data-testid="plan-panel"]'), stage),
    accountOverStage: overlap(one('[data-testid="account"]'), stage),
    stageBox: stage
  };
};

async function main() {
  await call('/test/reset', {});
  await call('/test/boat-name', { name: 'Sundial' });
  await call('/test/plan', { passage: 'shot', steps: PLAN });

  const browser = await chromium.launch({ channel: 'chrome' });
  const results = {};

  for (const [name, viewport] of [['narrow', NARROW], ['desktop', FULL]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/?passage=shot`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="chamber"]');
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
