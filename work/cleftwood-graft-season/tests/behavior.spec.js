const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';
const FIXTURE_PATH = process.env.FIXTURE_PATH || '/logs/verifier/fixture.json';

const ARTIFACTS = process.env.ARTIFACTS_DIR || '/logs/artifacts';
try {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
} catch (e) {
  void e;
}

const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const OPENING = FIXTURE.opening;
const SCALE = FIXTURE.scaleMax;

const NARROW = { width: 900, height: 760 };
const FULL = { width: 1280, height: 900 };

// The rules the orchard posts, written out here so that what the checks expect
// is worked out from them rather than copied off the running application.
const CHARGE = {
  bound: { canopy: 2, standing: 1 },
  rewrapped: { canopy: 1 },
  released: { standing: 3, canopy: 1 },
  cutBack: { standing: -4, deadwood: 3 },
  left: { deadwood: 1 },
  mendRelief: { deadwood: -2 }
};

function standingsAfter(acts) {
  const held = {
    canopy: OPENING.canopy,
    standing: OPENING.standing,
    deadwood: OPENING.deadwood
  };
  acts.forEach((act) => {
    const charge = CHARGE[act];
    Object.keys(charge).forEach((field) => {
      held[field] = Math.max(0, Math.min(SCALE, held[field] + charge[field]));
    });
  });
  return held;
}

function handId(tag) {
  return `${FIXTURE.hands.prefix}-${tag}`;
}

function pageId(tag) {
  return `${tag}-${FIXTURE.tag}`;
}

function writeJson(name, data) {
  try {
    fs.writeFileSync(path.join(ARTIFACTS, name), JSON.stringify(data, null, 2));
  } catch (e) {
    void e;
  }
}

/* ------------------------------------------------------------------ *
 * scenario set-up
 * ------------------------------------------------------------------ */

// Walking a stretch of the season the way the visit panel walks it, so a check
// can start from a season that is already part-way through.
const WORK = {
  bindWest: { visit: 'west-row', option: 'bind-west' },
  walkRow: { visit: 'west-row', option: 'walk-the-row' },
  bindNursery: { visit: 'nursery-bed', option: 'bind-nursery' },
  leaveStools: { visit: 'nursery-bed', option: 'leave-stools' },
  releaseWest: { visit: 'bud-swell', option: 'release-west' },
  cutWestBack: { visit: 'bud-swell', option: 'cut-west-back' },
  leaveWestWrapped: { visit: 'bud-swell', option: 'leave-wrapped' },
  bindEast: { visit: 'tape-run', option: 'bind-east' },
  packUp: { visit: 'tape-run', option: 'pack-up' },
  rewrapWest: { visit: 'scion-crate', option: 'rewrap-west' },
  closeCrate: { visit: 'scion-crate', option: 'close-crate' },
  releaseNursery: { visit: 'nursery-check', option: 'release-nursery' },
  bindBarn: { visit: 'spare-stock', option: 'bind-barn' },
  signRegister: { visit: 'county-survey', option: 'sign-register' },
  pullNursery: { visit: 'nursery-check', option: 'pull-nursery' },
  regraftStump: { visit: 'stump-work', option: 'regraft-west' },
  letStumpStand: { visit: 'stump-work', option: 'let-it-stand' },
  closeTheGate: { visit: 'last-round', option: 'close-the-gate' }
};

async function resetSeason(request) {
  const response = await request.post(`${BACKEND}/api/test/reset`);
  expect(response.ok(), 'the orchard should be cleared before each scenario').toBeTruthy();
}

async function walk(request, hand, steps) {
  const response = await request.post(`${BACKEND}/api/test/script`, {
    data: { hand, steps }
  });
  expect(
    response.ok(),
    `the season should walk as far as the scenario needs (${JSON.stringify(steps)})`
  ).toBeTruthy();
  return response.json();
}

/* ------------------------------------------------------------------ *
 * driving the window
 * ------------------------------------------------------------------ */

async function openWindow(page, hand, visit) {
  const query = visit
    ? `?hand=${encodeURIComponent(hand)}&visit=${encodeURIComponent(visit)}`
    : `?hand=${encodeURIComponent(hand)}`;
  await page.goto(`${FRONTEND}/${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="visit-row"]');
  if (visit) {
    await page.waitForFunction(() => {
      const notice = document.querySelector('[data-testid="notice"]');
      if (notice && !notice.hidden) {
        return true;
      }
      const title = document.querySelector('[data-testid="visit-title"]');
      return Boolean(title && title.getAttribute('data-visit'));
    });
  }
}

async function reopenWindow(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="visit-row"]');
}

async function openVisit(page, visitId) {
  await page.click(`[data-testid="open-visit"][data-visit="${visitId}"]`);
  await page.waitForSelector(`[data-testid="visit-title"][data-visit="${visitId}"]`);
  await page.waitForSelector('[data-testid="choice"]');
}

async function takeChoice(page, visitId, optionId) {
  await page.click(`[data-testid="choice"][data-option="${optionId}"]`);
  await page.waitForSelector(
    `[data-testid="visit-row"][data-visit="${visitId}"][data-status="done"]`
  );
}

async function walkVisitInWindow(page, visitId, optionId) {
  await openVisit(page, visitId);
  await takeChoice(page, visitId, optionId);
}

async function readAgain(page) {
  const before = await page.locator('[data-testid="record-entry"]').count();
  await page.click('[data-testid="reread-visit"]');
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid="record-entry"]').length !== count,
    before
  );
}

async function revisionShown(page, notebookPage) {
  return page.evaluate((id) => {
    const row = document.querySelector(`[data-testid="page-row"][data-page="${id}"]`);
    return row ? Number(row.getAttribute('data-revision')) : 0;
  }, notebookPage);
}

async function writePage(page, notebookPage) {
  const before = await revisionShown(page, notebookPage);
  await page.fill('[data-testid="page-name"]', notebookPage);
  await page.click('[data-testid="save-page"]');
  await page.waitForFunction(
    ({ id, prev }) => {
      const banner = document.querySelector('[data-testid="save-conflict"]');
      if (banner && !banner.hidden) {
        return true;
      }
      const notice = document.querySelector('[data-testid="notice"]');
      if (notice && !notice.hidden) {
        return true;
      }
      const row = document.querySelector(`[data-testid="page-row"][data-page="${id}"]`);
      return Boolean(row) && Number(row.getAttribute('data-revision')) > prev;
    },
    { id: notebookPage, prev: before }
  );
}

async function bringPageBack(page, notebookPage, linesOnThatPage) {
  const settled = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith('/load')
  );
  await page.click(`[data-testid="load-page"][data-page="${notebookPage}"]`);
  await settled;

  if (typeof linesOnThatPage === 'number') {
    await page.waitForFunction(
      (count) => document.querySelectorAll('[data-testid="record-entry"]').length === count,
      linesOnThatPage
    );
    return;
  }

  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('[data-testid="record-entry"]').length;
    if (window.__cleftwoodRows === rows) {
      return true;
    }
    window.__cleftwoodRows = rows;
    return false;
  });
}

/* ------------------------------------------------------------------ *
 * reading the window
 * ------------------------------------------------------------------ */

function readHeader(page) {
  return page.evaluate(() => ({
    day: Number(document.querySelector('[data-testid="season-day"]').getAttribute('data-day')),
    light: document.querySelector('[data-testid="season-light"]').getAttribute('data-light'),
    grafts: Number(
      document.querySelector('[data-testid="graft-count"]').getAttribute('data-count')
    ),
    hand: document.querySelector('[data-testid="hand-name"]').textContent.trim()
  }));
}

function readStandings(page) {
  return page.evaluate(() => {
    const held = {};
    document.querySelectorAll('[data-testid="standing"]').forEach((node) => {
      held[node.getAttribute('data-field')] = Number(node.getAttribute('data-value'));
    });
    return held;
  });
}

function readBoard(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="graft-card"]')).map((card) => ({
      stock: card.getAttribute('data-stock'),
      state: card.getAttribute('data-state'),
      hold: Number(card.getAttribute('data-hold')),
      history: Array.from(card.querySelectorAll('[data-testid="graft-history-entry"]')).map(
        (entry) => entry.getAttribute('data-act')
      )
    }))
  );
}

function readCard(page, stock) {
  return page.evaluate((wanted) => {
    const cards = Array.from(document.querySelectorAll('[data-testid="graft-card"]')).filter(
      (card) => card.getAttribute('data-stock') === wanted
    );
    return {
      cards: cards.length,
      state: cards.length ? cards[0].getAttribute('data-state') : null,
      hold: cards.length ? Number(cards[0].getAttribute('data-hold')) : null,
      history: cards.length
        ? Array.from(cards[0].querySelectorAll('[data-testid="graft-history-entry"]')).map((entry) =>
            entry.getAttribute('data-act')
          )
        : null
    };
  }, stock);
}

function readPlan(page) {
  return page.evaluate(() => {
    const plan = {};
    document.querySelectorAll('[data-testid="visit-row"]').forEach((row) => {
      plan[row.getAttribute('data-visit')] = row.getAttribute('data-status');
    });
    return plan;
  });
}

function readWaysIn(page) {
  return page.evaluate(() => {
    const ways = {};
    document.querySelectorAll('[data-testid="record-row"]').forEach((row) => {
      ways[row.getAttribute('data-record')] = row.getAttribute('data-eligible') === 'true';
    });
    return ways;
  });
}

function readTouches(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="touch"]')).map((touch) => ({
      stock: touch.getAttribute('data-stock'),
      state: touch.getAttribute('data-state'),
      hold: Number(touch.getAttribute('data-hold'))
    }))
  );
}

function readChoices(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="choice"]')).map((choice) =>
      choice.getAttribute('data-option')
    )
  );
}

function readSeasonRecord(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="record-entry"]')).map(
      (entry) => `${entry.getAttribute('data-visit')}:${entry.getAttribute('data-act')}`
    )
  );
}

function readConflict(page) {
  return page.evaluate(() => {
    const banner = document.querySelector('[data-testid="save-conflict"]');
    if (!banner) {
      return { shown: false, saysSomething: false };
    }
    const rect = banner.getBoundingClientRect();
    return {
      shown: !banner.hidden && rect.width > 0 && rect.height > 0,
      saysSomething: banner.textContent.trim().length > 0
    };
  });
}

/* ------------------------------------------------------------------ *
 * measuring the window
 * ------------------------------------------------------------------ */

function measureWindow(page) {
  return page.evaluate(() => {
    // Everything is measured with the window at the top of the season, which
    // is where it opens and where the screenshots were taken.
    window.scrollTo(0, 0);

    const boxOf = (node) => {
      if (!node) {
        return null;
      }
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height
      };
    };
    const one = (selector) => boxOf(document.querySelector(selector));
    const overlapArea = (a, b) => {
      if (!a || !b) {
        return 0;
      }
      const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return across > 0.5 && down > 0.5 ? Math.round(across * down) : 0;
    };

    const line = document.querySelector('[data-testid="visit-line"]');
    const setting = document.querySelector('[data-testid="visit-setting"]');
    const choiceNodes = Array.from(document.querySelectorAll('[data-testid="choice"]'));
    const choiceBoxes = choiceNodes.map(boxOf);

    let choicesOverlapping = 0;
    let tightestGap = null;
    for (let i = 0; i < choiceBoxes.length; i += 1) {
      for (let j = i + 1; j < choiceBoxes.length; j += 1) {
        choicesOverlapping = Math.max(choicesOverlapping, overlapArea(choiceBoxes[i], choiceBoxes[j]));
      }
      if (i > 0) {
        const gap = choiceBoxes[i].top - choiceBoxes[i - 1].bottom;
        tightestGap = tightestGap === null ? gap : Math.min(tightestGap, gap);
      }
    }

    const visit = one('[data-testid="visit-panel"]');
    const choices = one('[data-testid="visit-choices"]');
    const board = one('[data-testid="graft-board"]');
    const standings = one('[data-testid="standings"]');
    const touches = one('[data-testid="visit-touches"]');

    const gaugesReadable = Array.from(document.querySelectorAll('[data-testid="standing"]')).map(
      (gauge) => {
        const amount = gauge.querySelector('[data-testid="standing-amount"]');
        const gaugeBox = boxOf(gauge);
        const amountBox = boxOf(amount);
        return Boolean(
          amount
            && amount.scrollWidth <= amount.clientWidth + 1
            && amountBox
            && gaugeBox
            && amountBox.left >= gaugeBox.left - 0.5
            && amountBox.right <= gaugeBox.right + 0.5
            && amount.textContent.trim().length > 0
        );
      }
    );

    const choicesReadable = choiceNodes.map((choice, index) => {
      const box = choiceBoxes[index];
      return Boolean(
        choice.textContent.trim().length > 0
          && box.width > 40
          && box.height > 18
          && choice.scrollWidth <= choice.clientWidth + 1
      );
    });

    return {
      viewportWidth: window.innerWidth,
      scrolledTo: Math.round(window.scrollY),
      pageWiderThanWindow: document.documentElement.scrollWidth > window.innerWidth + 1,
      lineCutOff: line ? line.scrollHeight > line.clientHeight + 1 : true,
      settingCutOff: setting ? setting.scrollHeight > setting.clientHeight + 1 : true,
      choiceCount: choiceNodes.length,
      choicesOverlapping,
      tightestGap: tightestGap === null ? null : Math.round(tightestGap * 10) / 10,
      choicesReadable: choicesReadable.every(Boolean),
      boardOverVisit: overlapArea(board, visit),
      boardOverChoices: overlapArea(board, choices),
      boardOverLine: overlapArea(board, boxOf(line)),
      boardOverTouches: overlapArea(board, touches),
      standingsOverBoard: overlapArea(standings, board),
      standingsOverVisit: overlapArea(standings, visit),
      standingsOverChoices: overlapArea(standings, choices),
      gaugesReadable: gaugesReadable.every(Boolean)
    };
  });
}

async function seasonPartWayThrough(request, hand) {
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery, WORK.bindEast]);
}

/* ------------------------------------------------------------------ *
 * checks
 * ------------------------------------------------------------------ */

test.beforeEach(async ({ request }) => {
  await resetSeason(request);
});

/* --- one card for one stock --------------------------------------- */

test('[F2P][D1] A stock worked again by a later visit keeps the single card it already had', async ({
  page,
  request
}) => {
  const hand = handId('d1a');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'scion-crate', 'rewrap-west');

  const westRow = await readCard(page, 'west-4');
  const header = await readHeader(page);
  writeJson('d1a_board.json', { westRow, header, board: await readBoard(page) });

  expect(
    { cards: westRow.cards, hold: westRow.hold, state: westRow.state, onTheBoard: header.grafts },
    'working the fourth tree again should build the card that is already there'
  ).toEqual({ cards: 1, hold: 2, state: 'set', onTheBoard: 1 });
});

test('[F2P][D1] Working a stock again is charged as more work on it, not as a fresh graft', async ({
  page,
  request
}) => {
  const hand = handId('d1b');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'scion-crate', 'rewrap-west');

  const standings = await readStandings(page);
  expect(
    standings,
    'the second working of the fourth tree should be charged as extra tape, not as another graft'
  ).toEqual(standingsAfter(['bound', 'rewrapped']));
});

test('[F2P][D1] A visit needing a hold of two opens after the same stock is worked twice', async ({
  page,
  request
}) => {
  const hand = handId('d1c');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'scion-crate', 'rewrap-west');
  await walkVisitInWindow(page, 'tape-run', 'pack-up');

  const plan = await readPlan(page);
  writeJson('d1c_plan.json', { plan, westRow: await readCard(page, 'west-4') });

  expect(
    { spareStock: plan['spare-stock'] },
    'the spare stock should be offered once the fourth tree is held twice over'
  ).toEqual({ spareStock: 'open' });
});

test('[F2P][D1] The record shows the second working as more tape on the same graft', async ({
  page,
  request
}) => {
  const hand = handId('d1d');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'scion-crate', 'rewrap-west');
  await reopenWindow(page);

  const westRow = await readCard(page, 'west-4');
  expect(
    { cards: westRow.cards, history: westRow.history },
    'the fourth tree should read as bound once and re-wrapped once'
  ).toEqual({ cards: 1, history: ['bound', 'rewrapped'] });
});

/* --- released work is seen by later visits ------------------------ */

test('[F2P][D2] A visit shows what a stock stands at now, not what it stood at when bound', async ({
  page,
  request
}) => {
  const hand = handId('d2a');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'bud-swell', 'release-west');
  await openVisit(page, 'scion-crate');

  const touches = await readTouches(page);
  const westRow = touches.find((touch) => touch.stock === 'west-4') || null;
  writeJson('d2a_touches.json', { touches, card: await readCard(page, 'west-4') });

  expect(
    westRow,
    'the scion crate should see the fourth tree as released and held twice over'
  ).toEqual({ stock: 'west-4', state: 'released', hold: 2 });
});

test('[F2P][D2] The choice kept for a well-held graft appears once that graft is released', async ({
  page,
  request
}) => {
  const hand = handId('d2b');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'bud-swell', 'release-west');
  await walkVisitInWindow(page, 'tape-run', 'bind-east');
  await walkVisitInWindow(page, 'scion-crate', 'close-crate');
  await openVisit(page, 'last-round');

  const choices = await readChoices(page);
  writeJson('d2b_choices.json', { choices, card: await readCard(page, 'west-4') });

  expect(
    { hasShowUnion: choices.includes('show-union'), choiceCount: choices.length },
    'the last round should offer the union on the fourth tree once it is held twice over'
  ).toEqual({ hasShowUnion: true, choiceCount: 3 });
});

test('[F2P][D2] A visit needing a hold of two opens after a graft has been released', async ({
  page,
  request
}) => {
  const hand = handId('d2c');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'bud-swell', 'release-west');
  await walkVisitInWindow(page, 'tape-run', 'pack-up');

  const plan = await readPlan(page);
  expect(
    { spareStock: plan['spare-stock'] },
    'releasing the fourth tree should count towards the hold the spare stock asks for'
  ).toEqual({ spareStock: 'open' });
});

/* --- the record keeps what happened ------------------------------- */

test('[F2P][D3] Cutting a graft back keeps the day it was bound and adds the day it was cut', async ({
  page,
  request
}) => {
  const hand = handId('d3a');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'bud-swell', 'cut-west-back');

  const westRow = await readCard(page, 'west-4');
  writeJson('d3a_history.json', { westRow, record: await readSeasonRecord(page) });

  expect(
    { history: westRow.history, state: westRow.state },
    'cutting the fourth tree back should not take the binding out of the record'
  ).toEqual({ history: ['bound', 'cut-back'], state: 'cut-back' });
});

test('[F2P][D3] Fresh tape on a graft that was cut back builds its hold and leaves it cut back', async ({
  page,
  request
}) => {
  const hand = handId('d3b');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'bud-swell', 'cut-west-back');
  await walkVisitInWindow(page, 'scion-crate', 'rewrap-west');

  const westRow = await readCard(page, 'west-4');
  writeJson('d3b_card.json', { westRow, board: await readBoard(page) });

  expect(
    { cards: westRow.cards, state: westRow.state, hold: westRow.hold },
    're-taping a stump should add hold without putting the stump back in the row'
  ).toEqual({ cards: 1, state: 'cut-back', hold: 2 });
});

test('[F2P][D3] A cut-back graft that was re-taped stays out of the visits that need it holding', async ({
  page,
  request
}) => {
  const hand = handId('d3c');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools, WORK.cutWestBack]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'scion-crate', 'rewrap-west');
  await walk(request, hand, [WORK.closeTheGate]);
  await reopenWindow(page);

  const plan = await readPlan(page);
  writeJson('d3c_plan.json', { plan, westRow: await readCard(page, 'west-4') });

  expect(
    { tapeRun: plan['tape-run'], stumpWork: plan['stump-work'] },
    'a stump with fresh tape on it is still a stump'
  ).toEqual({ tapeRun: 'locked', stumpWork: 'open' });
});

/* --- the plan keeps up with the season ---------------------------- */

test('[F2P][D4] A visit that a new graft opens is offered as soon as the graft is bound', async ({
  page,
  request
}) => {
  const hand = handId('d4a');
  await walk(request, hand, []);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'west-row', 'bind-west');

  const plan = await readPlan(page);
  writeJson('d4a_plan.json', { plan, board: await readBoard(page) });

  expect(
    { budSwell: plan['bud-swell'], tapeRun: plan['tape-run'], scionCrate: plan['scion-crate'] },
    'binding the fourth tree should open the visits that were waiting on it'
  ).toEqual({ budSwell: 'open', tapeRun: 'open', scionCrate: 'open' });
});

test('[F2P][D4] Cutting a graft back closes the visits that needed it holding straight away', async ({
  page,
  request
}) => {
  const hand = handId('d4b');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'bud-swell', 'cut-west-back');

  const plan = await readPlan(page);
  expect(
    { tapeRun: plan['tape-run'] },
    'the tape run needs the fourth tree holding, and it no longer is'
  ).toEqual({ tapeRun: 'locked' });
});

test('[F2P][D4] A visit whose ground no longer holds cannot be walked from a direct link', async ({
  page,
  request
}) => {
  const hand = handId('d4c');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);
  await walkVisitInWindow(page, 'bud-swell', 'cut-west-back');

  await openWindow(page, hand, 'tape-run');

  const opened = await page.evaluate(() => {
    const title = document.querySelector('[data-testid="visit-title"]');
    const notice = document.querySelector('[data-testid="notice"]');
    const choices = Array.from(document.querySelectorAll('[data-testid="choice"]')).map((choice) =>
      choice.getAttribute('data-option')
    );
    return {
      showing: title ? title.getAttribute('data-visit') : null,
      offersTapeRunWork: choices.includes('bind-east'),
      told: Boolean(notice && !notice.hidden && notice.textContent.trim().length > 0)
    };
  });
  writeJson('d4c_direct_link.json', opened);

  expect(
    {
      walkedIn: opened.showing === 'tape-run',
      offersTapeRunWork: opened.offersTapeRunWork,
      told: opened.told
    },
    'a link straight to the tape run should be refused once the fourth tree is a stump'
  ).toEqual({ walkedIn: false, offersTapeRunWork: false, told: true });
});

/* --- reading a visit again is not another day of work ------------- */

test('[F2P][D5] Reading a walked visit again does not build the hold on the graft it made', async ({
  page,
  request
}) => {
  const hand = handId('d5a');
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery]);
  await openWindow(page, hand);

  await openVisit(page, 'west-row');
  await readAgain(page);

  const westRow = await readCard(page, 'west-4');
  const record = await readSeasonRecord(page);
  writeJson('d5a_reread.json', { westRow, record });

  expect(
    {
      cards: westRow.cards,
      hold: westRow.hold,
      bindings: record.filter((line) => line === 'west-row:bound').length,
      extraTape: record.filter((line) => line === 'west-row:rewrapped').length,
      readings: record.filter((line) => line === 'west-row:re-read').length
    },
    'reading the west row again should be noted as a reading and put no more tape on the tree'
  ).toEqual({ cards: 1, hold: 1, bindings: 1, extraTape: 0, readings: 1 });
});

test('[F2P][D5] Reading a walked visit again is not charged to the standings', async ({
  page,
  request
}) => {
  const hand = handId('d5b');
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery]);
  await openWindow(page, hand);

  await openVisit(page, 'west-row');
  await readAgain(page);

  expect(
    await readStandings(page),
    'reading a visit again is not a day of work and should cost nothing'
  ).toEqual(standingsAfter(['bound', 'bound']));
});

test('[F2P][D5] Reading a walked visit again does not move the season back to that day', async ({
  page,
  request
}) => {
  const hand = handId('d5c');
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery]);
  await openWindow(page, hand);

  const before = await readHeader(page);
  await openVisit(page, 'west-row');
  await readAgain(page);
  const after = await readHeader(page);

  writeJson('d5c_season_clock.json', { before, after });

  expect(
    { day: after.day, light: after.light },
    'the season stands where the last day of work left it'
  ).toEqual({ day: before.day, light: before.light });
});

test('[F2P][D5] Two readings in a row open nothing, close nothing and charge nothing', async ({
  page,
  request
}) => {
  const hand = handId('d5d');
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery, WORK.releaseWest]);
  await openWindow(page, hand);

  const before = {
    header: await readHeader(page),
    standings: await readStandings(page),
    plan: await readPlan(page),
    waysIn: await readWaysIn(page),
    board: await readBoard(page)
  };

  await openVisit(page, 'west-row');
  await readAgain(page);
  await openVisit(page, 'bud-swell');
  await readAgain(page);

  const after = {
    header: await readHeader(page),
    standings: await readStandings(page),
    plan: await readPlan(page),
    waysIn: await readWaysIn(page),
    board: await readBoard(page)
  };

  writeJson('d5d_two_readings.json', { before, after, record: await readSeasonRecord(page) });

  expect(
    after,
    'reading two walked visits back leaves the season exactly where the work left it'
  ).toEqual(before);
});

/* --- a page brings the whole season back -------------------------- */

test('[F2P][D6] Bringing a page back restores the standings that were written on it', async ({
  page,
  request
}) => {
  const hand = handId('d6a');
  const notebookPage = pageId('early-a');
  await walk(request, hand, [WORK.bindWest]);
  await openWindow(page, hand);
  await writePage(page, notebookPage);

  await walk(request, hand, [WORK.bindNursery, WORK.releaseWest]);
  await reopenWindow(page);
  await bringPageBack(page, notebookPage, 1);

  const standings = await readStandings(page);
  writeJson('d6a_standings.json', { standings, expected: standingsAfter(['bound']) });

  expect(
    standings,
    'the page holds one day of work, so that is what the standings should read'
  ).toEqual(standingsAfter(['bound']));
});

test('[F2P][D6] Bringing a page back puts the graft board that was on it back up', async ({
  page,
  request
}) => {
  const hand = handId('d6b');
  const notebookPage = pageId('early-b');
  await walk(request, hand, [WORK.bindWest]);
  await openWindow(page, hand);
  await writePage(page, notebookPage);

  await walk(request, hand, [WORK.bindNursery, WORK.releaseWest]);
  await reopenWindow(page);
  await bringPageBack(page, notebookPage, 1);

  const board = await readBoard(page);
  const header = await readHeader(page);
  writeJson('d6b_board.json', { board, header });

  expect(
    {
      stocks: board.map((card) => card.stock),
      states: board.map((card) => card.state),
      holds: board.map((card) => card.hold),
      counter: header.grafts
    },
    'only the fourth tree had been bound when that page was written, and it was still set'
  ).toEqual({ stocks: ['west-4'], states: ['set'], holds: [1], counter: 1 });
});

test('[F2P][D6] Bringing an earlier page back closes the visits that only opened later', async ({
  page,
  request
}) => {
  const hand = handId('d6c');
  const notebookPage = pageId('early-c');
  await walk(request, hand, [WORK.bindWest]);
  await openWindow(page, hand);
  await writePage(page, notebookPage);

  await walk(request, hand, [WORK.releaseWest, WORK.bindEast, WORK.leaveStools]);
  await reopenWindow(page);
  await bringPageBack(page, notebookPage, 1);

  const plan = await readPlan(page);
  writeJson('d6c_plan.json', { plan, board: await readBoard(page) });

  expect(
    { lastRound: plan['last-round'], budSwell: plan['bud-swell'] },
    'nothing was bound in the east row on the page that was brought back'
  ).toEqual({ lastRound: 'locked', budSwell: 'open' });
});

/* --- how the row can be entered follows the row ------------------- */

test('[F2P][D7] A way of entering the row stops being open when the row stops meeting it', async ({
  page,
  request
}) => {
  const hand = handId('d7a');
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery, WORK.releaseWest, WORK.bindEast]);
  await openWindow(page, hand);

  const before = await readWaysIn(page);
  await walkVisitInWindow(page, 'nursery-check', 'pull-nursery');
  const after = await readWaysIn(page);

  writeJson('d7a_ways_in.json', { before, after });

  expect(
    { wasOpen: before['working-orchard'], stillOpen: after['working-orchard'] },
    'a working orchard is not open to a row with a burnt scion in it'
  ).toEqual({ wasOpen: true, stillOpen: false });
});

test('[F2P][D7] Mending a stump closes the way in that needed a graft to have been cut back', async ({
  page,
  request
}) => {
  const hand = handId('d7b');
  await walk(request, hand, [
    WORK.bindWest,
    WORK.bindNursery,
    WORK.cutWestBack,
    WORK.closeTheGate
  ]);
  await openWindow(page, hand);

  const before = await readWaysIn(page);
  await walk(request, hand, [WORK.regraftStump]);
  await reopenWindow(page);
  const after = await readWaysIn(page);
  const standings = await readStandings(page);

  writeJson('d7b_ways_in.json', { before, after, standings });

  expect(
    {
      wasOpen: before['held-back'],
      stillOpen: after['held-back'],
      standings
    },
    're-grafting and releasing the stump settles part of what was owed and closes that way in'
  ).toEqual({
    wasOpen: true,
    stillOpen: false,
    standings: standingsAfter(['bound', 'bound', 'cutBack', 'rewrapped', 'released', 'mendRelief'])
  });
});

test('[F2P][D7] A rising debt to the orchard closes one way in and opens another', async ({
  page,
  request
}) => {
  const hand = handId('d7c');
  await walk(request, hand, [
    WORK.bindWest,
    WORK.bindNursery,
    WORK.cutWestBack,
    WORK.closeTheGate
  ]);
  await openWindow(page, hand);

  await walk(request, hand, [WORK.letStumpStand]);
  await reopenWindow(page);
  const after = await readWaysIn(page);

  writeJson('d7c_ways_in.json', { after, standings: await readStandings(page) });

  expect(
    { heldBack: after['held-back'], rowOfStumps: after['row-of-stumps'] },
    'letting the stump stand pushes what the orchard is owed past what a held-back season allows'
  ).toEqual({ heldBack: false, rowOfStumps: true });
});

/* --- a page is not quietly written over --------------------------- */

async function twoWindowsOnOnePage(page, context, request) {
  const first = handId('shed');
  const second = handId('house');
  const third = handId('gate');
  const shared = pageId('shared');

  await walk(request, first, [WORK.bindWest, WORK.bindNursery]);
  await openWindow(page, first);
  await writePage(page, shared);

  const houseWindow = await context.newPage();
  await openWindow(houseWindow, second);
  await bringPageBack(houseWindow, shared, 2);

  await walkVisitInWindow(page, 'bud-swell', 'release-west');
  await writePage(page, shared);

  await walk(request, second, [WORK.cutWestBack]);
  await reopenWindow(houseWindow);
  await writePage(houseWindow, shared);

  return { houseWindow, shared, third };
}

test('[F2P][D8] A window working from an older revision does not write over what is on the page', async ({
  page,
  context,
  request
}) => {
  const { houseWindow, shared, third } = await twoWindowsOnOnePage(page, context, request);

  const gateWindow = await context.newPage();
  await openWindow(gateWindow, third);
  await bringPageBack(gateWindow, shared);

  const westRow = await readCard(gateWindow, 'west-4');
  writeJson('d8a_page_contents.json', { westRow, board: await readBoard(gateWindow) });
  await houseWindow.close();
  await gateWindow.close();

  expect(
    { state: westRow.state, hold: westRow.hold },
    'the page should still hold the released union that was written onto it'
  ).toEqual({ state: 'released', hold: 2 });
});

test('[F2P][D8] A window that never took a page up cannot write onto it', async ({
  page,
  context,
  request
}) => {
  const shedHand = handId('own');
  const strangerHand = handId('stranger');
  const notebookPage = pageId('owned');

  await walk(request, shedHand, [WORK.bindWest]);
  await openWindow(page, shedHand);
  await writePage(page, notebookPage);

  await walk(request, strangerHand, [WORK.bindNursery]);
  const strangerWindow = await context.newPage();
  await openWindow(strangerWindow, strangerHand);
  await writePage(strangerWindow, notebookPage);

  const outcome = {
    revision: await revisionShown(strangerWindow, notebookPage),
    conflict: (await readConflict(strangerWindow)).shown
  };
  writeJson('d8d_stranger.json', outcome);
  await strangerWindow.close();

  expect(
    outcome,
    'a window that has never taken this page up has no revision to write onto'
  ).toEqual({ revision: 1, conflict: true });
});

test('[F2P][D8] The window whose save was refused is told the page was not written over', async ({
  page,
  context,
  request
}) => {
  const { houseWindow } = await twoWindowsOnOnePage(page, context, request);

  const conflict = await readConflict(houseWindow);
  writeJson('d8b_conflict.json', conflict);
  await houseWindow.close();

  expect(
    conflict,
    'the window that was working from the older revision should say the save was refused'
  ).toEqual({ shown: true, saysSomething: true });
});

test('[F2P][D8] A refused save does not move the page on a revision', async ({
  page,
  context,
  request
}) => {
  const { houseWindow, shared } = await twoWindowsOnOnePage(page, context, request);

  const revision = await revisionShown(houseWindow, shared);
  await houseWindow.close();

  expect(
    { revision },
    'one save was taken and one was refused, so the page stands at its second revision'
  ).toEqual({ revision: 2 });
});

/* --- the record keeps its order ----------------------------------- */

// A season long enough that the record has run past nine lines, saved at a
// page on a day two acts of work share.
const LONG_SEASON = [
  WORK.rewrapWest,
  WORK.releaseNursery,
  WORK.bindBarn,
  WORK.signRegister
];

async function seasonPastNineLines(request, hand, sameLightOrder, notebookPage, page) {
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery, ...sameLightOrder]);
  await openWindow(page, hand);
  await writePage(page, notebookPage);
  await walk(request, hand, LONG_SEASON);
  await reopenWindow(page);
  await bringPageBack(page, notebookPage, 4);
}

test('[F2P][D9] A reading taken after a page comes back takes its place at the end of that light', async ({
  page,
  request
}) => {
  const hand = handId('d9a');
  const notebookPage = pageId('order-a');
  await seasonPastNineLines(
    request,
    hand,
    [WORK.releaseWest, WORK.bindEast],
    notebookPage,
    page
  );

  await openVisit(page, 'west-row');
  await readAgain(page);

  const record = await readSeasonRecord(page);
  writeJson('d9a_order.json', { record });

  expect(record, 'the reading happened last, so it reads last in that light').toEqual([
    'west-row:bound',
    'nursery-bed:bound',
    'bud-swell:released',
    'tape-run:bound',
    'west-row:re-read'
  ]);
});

test('[F2P][D9] The same holds when the two acts in that light were done the other way round', async ({
  page,
  request
}) => {
  const hand = handId('d9b');
  const notebookPage = pageId('order-b');
  await seasonPastNineLines(
    request,
    hand,
    [WORK.bindEast, WORK.releaseWest],
    notebookPage,
    page
  );

  await openVisit(page, 'west-row');
  await readAgain(page);

  const record = await readSeasonRecord(page);
  writeJson('d9b_order.json', { record });

  expect(record, 'the tape run came first that midday, and the reading last').toEqual([
    'west-row:bound',
    'nursery-bed:bound',
    'tape-run:bound',
    'bud-swell:released',
    'west-row:re-read'
  ]);
});

test('[F2P][D9] Two readings after a page comes back keep the order they were taken in', async ({
  page,
  request
}) => {
  const hand = handId('d9c');
  const notebookPage = pageId('order-c');
  await seasonPastNineLines(
    request,
    hand,
    [WORK.releaseWest, WORK.bindEast],
    notebookPage,
    page
  );

  await openVisit(page, 'west-row');
  await readAgain(page);
  await openVisit(page, 'nursery-bed');
  await readAgain(page);

  const record = await readSeasonRecord(page);
  writeJson('d9c_order.json', { record });

  expect(record, 'both readings belong after the work, in the order they were taken').toEqual([
    'west-row:bound',
    'nursery-bed:bound',
    'bud-swell:released',
    'tape-run:bound',
    'west-row:re-read',
    'nursery-bed:re-read'
  ]);
});

/* --- what cutting a graft back costs ------------------------------ */

test('[F2P][D11] Cutting a graft back is charged to your standing and to what the orchard is owed', async ({
  page,
  request
}) => {
  const hand = handId('d11a');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'bud-swell', 'cut-west-back');

  const standings = await readStandings(page);
  writeJson('d11a_standings.json', { standings, expected: standingsAfter(['bound', 'cutBack']) });

  expect(
    standings,
    'a graft cut back costs your standing and is owed back to the orchard'
  ).toEqual(standingsAfter(['bound', 'cutBack']));
});

test('[F2P][D11] The visit that a debt to the orchard opens is offered after a graft is cut back', async ({
  page,
  request
}) => {
  const hand = handId('d11b');
  await walk(request, hand, [WORK.bindWest, WORK.leaveStools]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'bud-swell', 'cut-west-back');

  const plan = await readPlan(page);
  expect(
    { windthrow: plan.windthrow },
    'once the orchard is owed enough, the windthrow visit is there to settle it'
  ).toEqual({ windthrow: 'open' });
});

test('[F2P][D11] A charge that would carry a standing below nought leaves it at nought', async ({
  page,
  request
}) => {
  const hand = handId('d11c');
  await walk(request, hand, [
    WORK.bindWest,
    WORK.bindNursery,
    WORK.cutWestBack,
    WORK.pullNursery
  ]);
  await walk(request, hand, [WORK.regraftStump]);
  await openWindow(page, hand);

  const standings = await readStandings(page);
  writeJson('d11c_floor.json', {
    standings,
    expected: standingsAfter([
      'bound',
      'bound',
      'cutBack',
      'cutBack',
      'rewrapped',
      'released',
      'mendRelief'
    ])
  });

  expect(
    standings,
    'two grafts cut back take your standing to nought, and releasing one lifts it from there'
  ).toEqual(
    standingsAfter([
      'bound',
      'bound',
      'cutBack',
      'cutBack',
      'rewrapped',
      'released',
      'mendRelief'
    ])
  );
});

test('[F2P][D11] Releasing a graft that is not standing cut back settles nothing further', async ({
  page,
  request
}) => {
  const hand = handId('d11d');
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery, WORK.cutWestBack]);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'nursery-check', 'release-nursery');

  const standings = await readStandings(page);
  writeJson('d11d_no_relief.json', { standings });

  expect(
    standings,
    'the nursery stool was never cut back, so taking its tape off settles nothing that was owed'
  ).toEqual(standingsAfter(['bound', 'bound', 'cutBack', 'rewrapped', 'released']));
});

/* --- the window at a narrow width --------------------------------- */

async function visitWindowAt(page, request, hand, viewport) {
  await seasonPartWayThrough(request, hand);
  await page.setViewportSize(viewport);
  await openWindow(page, hand, 'bud-swell');
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="choice"]').length === 3
  );
}

async function narrowVisitWindow(page, request, hand) {
  await visitWindowAt(page, request, hand, NARROW);
}

test('[F2P][D10] What Ada says is not cut off in a narrow window', async ({ page, request }) => {
  await narrowVisitWindow(page, request, handId('d10a'));

  const measured = await measureWindow(page);
  writeJson('d10a_narrow.json', measured);
  await page.screenshot({ path: path.join(ARTIFACTS, 'd10a_narrow.png'), fullPage: true });

  expect(
    { lineCutOff: measured.lineCutOff, settingCutOff: measured.settingCutOff },
    'the words of the visit have to be readable in full'
  ).toEqual({ lineCutOff: false, settingCutOff: false });
});

test('[F2P][D10] The choices do not lie on top of one another in a narrow window', async ({
  page,
  request
}) => {
  await narrowVisitWindow(page, request, handId('d10b'));

  const measured = await measureWindow(page);
  writeJson('d10b_narrow.json', measured);

  expect(
    {
      choiceCount: measured.choiceCount,
      overlapping: measured.choicesOverlapping,
      spacedApart: measured.tightestGap !== null && measured.tightestGap >= 4,
      readable: measured.choicesReadable
    },
    'each choice needs its own space so it is clear which words belong to which button'
  ).toEqual({ choiceCount: 3, overlapping: 0, spacedApart: true, readable: true });
});

test('[F2P][D10] The graft board does not cover the visit in a narrow window', async ({
  page,
  request
}) => {
  await narrowVisitWindow(page, request, handId('d10c'));

  const measured = await measureWindow(page);
  writeJson('d10c_narrow.json', measured);

  expect(
    {
      overVisit: measured.boardOverVisit,
      overLine: measured.boardOverLine,
      overChoices: measured.boardOverChoices,
      overTouches: measured.boardOverTouches
    },
    'the board belongs beside or below the visit, never on top of it'
  ).toEqual({ overVisit: 0, overLine: 0, overChoices: 0, overTouches: 0 });
});

test('[F2P][D10] How the season stands does not cover the graft board in a narrow window', async ({
  page,
  request
}) => {
  await narrowVisitWindow(page, request, handId('d10d'));

  const measured = await measureWindow(page);
  writeJson('d10d_narrow.json', measured);

  expect(
    {
      overBoard: measured.standingsOverBoard,
      overVisit: measured.standingsOverVisit,
      overChoices: measured.standingsOverChoices,
      readable: measured.gaugesReadable
    },
    'the three standings need their own room with their numbers readable'
  ).toEqual({ overBoard: 0, overVisit: 0, overChoices: 0, readable: true });
});

test('[F2P][D10] Narrowing a full window keeps the visit clear without opening it again', async ({
  page,
  request
}) => {
  await visitWindowAt(page, request, handId('d10e'), FULL);

  await page.setViewportSize(NARROW);
  await page.waitForFunction((width) => window.innerWidth === width, NARROW.width);

  const measured = await measureWindow(page);
  writeJson('d10e_after_resize.json', measured);
  await page.screenshot({ path: path.join(ARTIFACTS, 'd10e_after_resize.png'), fullPage: true });

  expect(
    {
      lineCutOff: measured.lineCutOff,
      overlapping: measured.choicesOverlapping,
      boardOverVisit: measured.boardOverVisit,
      standingsOverBoard: measured.standingsOverBoard,
      pageWiderThanWindow: measured.pageWiderThanWindow
    },
    'dragging the window narrower should lay the season out for the narrower window'
  ).toEqual({
    lineCutOff: false,
    overlapping: 0,
    boardOverVisit: 0,
    standingsOverBoard: 0,
    pageWiderThanWindow: false
  });
});

/* --- what already works and must keep working --------------------- */

test('[P2P] The season opens on its first day with the standings it starts from', async ({
  page,
  request
}) => {
  const hand = handId('p2p1');
  await walk(request, hand, []);
  await openWindow(page, hand);

  const header = await readHeader(page);
  const plan = await readPlan(page);

  expect(
    {
      day: header.day,
      light: header.light,
      grafts: header.grafts,
      standings: await readStandings(page),
      westRow: plan['west-row'],
      nurseryBed: plan['nursery-bed']
    },
    'a season that has not been worked yet opens on its first day with nothing on the board'
  ).toEqual({
    day: OPENING.day,
    light: OPENING.light,
    grafts: 0,
    standings: standingsAfter([]),
    westRow: 'open',
    nurseryBed: 'open'
  });
});

test('[P2P] Binding the first graft puts one card on the board at the hold it starts on', async ({
  page,
  request
}) => {
  const hand = handId('p2p2');
  await walk(request, hand, []);
  await openWindow(page, hand);

  await walkVisitInWindow(page, 'west-row', 'bind-west');

  const westRow = await readCard(page, 'west-4');
  const header = await readHeader(page);

  expect(
    {
      cards: westRow.cards,
      state: westRow.state,
      hold: westRow.hold,
      onTheBoard: header.grafts,
      standings: await readStandings(page)
    },
    'the first graft of the season should read as one set union'
  ).toEqual({
    cards: 1,
    state: 'set',
    hold: 1,
    onTheBoard: 1,
    standings: standingsAfter(['bound'])
  });
});

test('[P2P] A graft card names the stock, the scion on it and the day it was bound', async ({
  page,
  request
}) => {
  const hand = handId('p2p3');
  await walk(request, hand, [WORK.bindWest]);
  await openWindow(page, hand);

  const expected = FIXTURE.stocks.find((stock) => stock.stock === 'west-4');
  const shown = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="graft-card"][data-stock="west-4"]');
    if (!card) {
      return null;
    }
    return {
      text: card.textContent,
      entries: card.querySelectorAll('[data-testid="graft-history-entry"]').length,
      firstAct: card
        .querySelector('[data-testid="graft-history-entry"]')
        .getAttribute('data-act')
    };
  });

  expect(
    {
      namesStock: shown.text.includes(expected.label),
      namesScion: shown.text.includes(expected.scion),
      entries: shown.entries,
      firstAct: shown.firstAct
    },
    'a card should say which stock it is, what is grafted onto it and what has been done to it'
  ).toEqual({ namesStock: true, namesScion: true, entries: 1, firstAct: 'bound' });
});

test('[P2P] The window names the hand who is working the season', async ({ page, request }) => {
  const hand = handId('p2p4');
  await walk(request, hand, []);
  await openWindow(page, hand);

  const header = await readHeader(page);
  expect(header.hand, 'the season is being worked by somebody and the window should say who').toBe(
    FIXTURE.handName
  );
});

test('[P2P] All three things the season is measured by are shown with their numbers', async ({
  page,
  request
}) => {
  const hand = handId('p2p5');
  await walk(request, hand, [WORK.bindWest, WORK.bindNursery]);
  await openWindow(page, hand);

  const gauges = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="standing"]')).map((gauge) => ({
      field: gauge.getAttribute('data-field'),
      value: Number(gauge.getAttribute('data-value')),
      shows: gauge.textContent.trim().length > 0
    }))
  );

  expect(
    {
      fields: gauges.map((gauge) => gauge.field).sort(),
      allShown: gauges.every((gauge) => gauge.shows && Number.isFinite(gauge.value))
    },
    'canopy, standing and what is owed are three separate things and all three are shown'
  ).toEqual({ fields: ['canopy', 'deadwood', 'standing'], allShown: true });
});

test('[P2P] A page can be written and shows up in the notebook at its first revision', async ({
  page,
  request
}) => {
  const hand = handId('p2p6');
  const notebookPage = pageId('first');
  await walk(request, hand, [WORK.bindWest]);
  await openWindow(page, hand);

  await writePage(page, notebookPage);

  expect(
    { revision: await revisionShown(page, notebookPage) },
    'the first time a page is written it stands at its first revision'
  ).toEqual({ revision: 1 });
});

test('[P2P] One window can write onto its own page twice and the revision moves on each time', async ({
  page,
  request
}) => {
  const hand = handId('p2p10');
  const notebookPage = pageId('twice');
  await walk(request, hand, [WORK.bindWest]);
  await openWindow(page, hand);

  await writePage(page, notebookPage);
  const first = await revisionShown(page, notebookPage);
  await walk(request, hand, [WORK.bindNursery]);
  await reopenWindow(page);
  await writePage(page, notebookPage);
  const second = await revisionShown(page, notebookPage);

  expect(
    { first, second, refused: (await readConflict(page)).shown },
    'a window writing onto the page it last wrote is not in conflict with anybody'
  ).toEqual({ first: 1, second: 2, refused: false });
});

test('[P2P] A window that brought a page back can write onto it', async ({
  page,
  context,
  request
}) => {
  const shedHand = handId('p2p11a');
  const houseHand = handId('p2p11b');
  const notebookPage = pageId('handed-on');

  await walk(request, shedHand, [WORK.bindWest, WORK.bindNursery]);
  await openWindow(page, shedHand);
  await writePage(page, notebookPage);

  const houseWindow = await context.newPage();
  await openWindow(houseWindow, houseHand);
  await bringPageBack(houseWindow, notebookPage, 2);
  await writePage(houseWindow, notebookPage);

  const outcome = {
    revision: await revisionShown(houseWindow, notebookPage),
    refused: (await readConflict(houseWindow)).shown
  };
  await houseWindow.close();

  expect(
    outcome,
    'taking a page up by bringing it back is enough to be allowed to write onto it'
  ).toEqual({ revision: 2, refused: false });
});

test('[P2P] A page that is brought back puts its own season record on the screen', async ({
  page,
  request
}) => {
  const hand = handId('p2p7');
  const notebookPage = pageId('back');
  await walk(request, hand, [WORK.bindWest]);
  await openWindow(page, hand);
  await writePage(page, notebookPage);

  await walk(request, hand, [WORK.bindNursery]);
  await reopenWindow(page);
  await bringPageBack(page, notebookPage, 1);

  expect(
    await readSeasonRecord(page),
    'one act of work had been written down when that page was made'
  ).toEqual(['west-row:bound']);
});

test('[P2P] The record keeps the order it was read in across a plain reload', async ({
  page,
  request
}) => {
  const hand = handId('p2p8');
  await walk(request, hand, [WORK.bindWest, WORK.releaseWest, WORK.bindEast]);
  await openWindow(page, hand);

  const before = await readSeasonRecord(page);
  await reopenWindow(page);
  const after = await readSeasonRecord(page);

  expect(after, 'opening the window again should not shuffle the record').toEqual(before);
});

test('[P2P] A full-width window keeps the visit and the graft board apart', async ({
  page,
  request
}) => {
  await visitWindowAt(page, request, handId('p2p9'), FULL);

  const measured = await measureWindow(page);
  writeJson('p2p9_full_width.json', measured);

  expect(
    {
      lineCutOff: measured.lineCutOff,
      overlapping: measured.choicesOverlapping,
      boardOverVisit: measured.boardOverVisit,
      standingsOverVisit: measured.standingsOverVisit,
      pageWiderThanWindow: measured.pageWiderThanWindow,
      choiceCount: measured.choiceCount
    },
    'a full-width window has room for the visit and the board side by side'
  ).toEqual({
    lineCutOff: false,
    overlapping: 0,
    boardOverVisit: 0,
    standingsOverVisit: 0,
    pageWiderThanWindow: false,
    choiceCount: 3
  });
});
