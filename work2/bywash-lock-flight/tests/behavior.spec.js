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
const NARROW = { width: 900, height: 780 };
const FULL = { width: 1280, height: 900 };
const INCHES_PER_FOOT = 12;

function chamber(id) {
  return FIXTURE.chambers.find((entry) => entry.id === id);
}

function pound(id) {
  return FIXTURE.pounds.find((entry) => entry.id === id);
}

// The gauge book keeps areas in square feet and rises in feet and inches, so a
// lockful in cubic feet is the area times the rise brought to feet.
function lockful(id) {
  const held = chamber(id);
  return (held.areaSqFt * held.riseInches) / INCHES_PER_FOOT;
}

// What a volume does to a pound's level, in inches.
function levelChange(poundId, cuFt) {
  return (cuFt * INCHES_PER_FOOT) / pound(poundId).surfaceSqFt;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function passageId(tag) {
  return `${FIXTURE.passages.main}-${tag}`;
}

function writeJson(name, data) {
  try {
    fs.writeFileSync(path.join(ARTIFACTS, name), JSON.stringify(data, null, 2));
  } catch (e) {
    void e;
  }
}

/* ------------------------------------------------------------------ *
 * plan fragments, written the way a keeper would work the flight
 * ------------------------------------------------------------------ */

const OPEN_TAIL = (id) => ({ chamber: id, operation: 'open-tail-gate' });
const SHUT_TAIL = (id) => ({ chamber: id, operation: 'shut-tail-gate' });
const OPEN_HEAD = (id) => ({ chamber: id, operation: 'open-head-gate' });
const SHUT_HEAD = (id) => ({ chamber: id, operation: 'shut-head-gate' });
const RAISE_HEAD = (id) => ({ chamber: id, operation: 'raise-head-paddle' });
const DROP_HEAD = (id) => ({ chamber: id, operation: 'drop-head-paddle' });
const RAISE_TAIL = (id) => ({ chamber: id, operation: 'raise-tail-paddle' });
const DROP_TAIL = (id) => ({ chamber: id, operation: 'drop-tail-paddle' });
const BOAT_UP = { operation: 'boat-up' };

// Fill a chamber from the water above it and let it back out at the tail, which
// leaves the flight as it was found and moves one lockful down the hill.
const RUN_A_LOCKFUL_THROUGH = (id) => [
  RAISE_HEAD(id),
  DROP_HEAD(id),
  RAISE_TAIL(id),
  DROP_TAIL(id)
];

// Take the boat up through the bottom lock of the flight.
const UP_THROUGH_WHARF = [
  OPEN_TAIL('wharf-tail'),
  BOAT_UP,
  SHUT_TAIL('wharf-tail'),
  RAISE_HEAD('wharf-tail'),
  DROP_HEAD('wharf-tail'),
  OPEN_HEAD('wharf-tail'),
  BOAT_UP,
  SHUT_HEAD('wharf-tail')
];

// Take the boat up through the staircase pair.
const UP_THROUGH_STAIRCASE = [
  OPEN_TAIL('stair-foot'),
  BOAT_UP,
  SHUT_TAIL('stair-foot'),
  RAISE_HEAD('stair-head'),
  DROP_HEAD('stair-head'),
  RAISE_HEAD('stair-foot'),
  DROP_HEAD('stair-foot'),
  OPEN_HEAD('stair-foot'),
  BOAT_UP
];

// Both chambers of the staircase left standing full, which puts water on both
// sides of the wall they share.
const BOTH_STAIRCASE_CHAMBERS_FULL = [
  RAISE_HEAD('stair-head'),
  DROP_HEAD('stair-head'),
  RAISE_HEAD('stair-foot'),
  DROP_HEAD('stair-foot'),
  RAISE_HEAD('stair-head'),
  DROP_HEAD('stair-head')
];

/* ------------------------------------------------------------------ *
 * setting a scenario out
 * ------------------------------------------------------------------ */

async function clearFlight(request) {
  const response = await request.post(`${BACKEND}/api/test/reset`);
  expect(response.ok(), 'the flight should be cleared before each scenario').toBeTruthy();
}

async function setPlan(request, passage, steps) {
  const response = await request.post(`${BACKEND}/api/test/plan`, {
    data: { passage, steps }
  });
  expect(response.ok(), 'the scenario plan should be written onto the passage').toBeTruthy();
  return response.json();
}

/* ------------------------------------------------------------------ *
 * driving the window
 * ------------------------------------------------------------------ */

async function openWindow(page, passage) {
  await page.goto(`${FRONTEND}/?passage=${encodeURIComponent(passage)}`, {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForSelector('[data-testid="chamber"]');
  await page.waitForSelector('[data-testid="pound-gauge"]');
}

async function reopenWindow(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="chamber"]');
}

async function addStep(page, chamberId, operation) {
  const before = await page.locator('[data-testid="step-row"]').count();
  if (chamberId) {
    await page.selectOption('[data-testid="pick-chamber"]', chamberId);
  }
  await page.selectOption('[data-testid="pick-operation"]', operation);
  await page.click('[data-testid="add-step"]');
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid="step-row"]').length === count,
    before + 1
  );
}

async function takeBackLastStep(page) {
  const before = await page.locator('[data-testid="step-row"]').count();
  await page.click('[data-testid="undo-step"]');
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid="step-row"]').length === count,
    before - 1
  );
}

/* ------------------------------------------------------------------ *
 * reading the window
 * ------------------------------------------------------------------ */

function readHeader(page) {
  return page.evaluate(() => ({
    boat: document.querySelector('[data-testid="boat-name"]').textContent.trim(),
    place: document.querySelector('[data-testid="boat-place"]').getAttribute('data-place'),
    workedCount: Number(
      document.querySelector('[data-testid="worked-count"]').getAttribute('data-count')
    )
  }));
}

function readChambers(page) {
  return page.evaluate(() => {
    const held = {};
    document.querySelectorAll('[data-testid="chamber"]').forEach((node) => {
      held[node.getAttribute('data-chamber')] = {
        levelIn: Number(node.getAttribute('data-level')),
        riseIn: Number(node.getAttribute('data-rise')),
        headGate: node.getAttribute('data-head-gate'),
        tailGate: node.getAttribute('data-tail-gate'),
        headPaddle: node.getAttribute('data-head-paddle'),
        tailPaddle: node.getAttribute('data-tail-paddle'),
        holdsBoat: node.getAttribute('data-boat') === 'true'
      };
    });
    return held;
  });
}

function readPounds(page) {
  return page.evaluate(() => {
    const held = {};
    document.querySelectorAll('[data-testid="pound-gauge"]').forEach((node) => {
      held[node.getAttribute('data-pound')] = {
        drawnIn: Number(node.getAttribute('data-drawn-in')),
        drawnCuFt: Number(node.getAttribute('data-drawn-cuft')),
        deliveredCuFt: Number(node.getAttribute('data-delivered-cuft')),
        withinBand: node.getAttribute('data-within-band') === 'true'
      };
    });
    return held;
  });
}

function readLedger(page) {
  return page.evaluate(() => {
    const held = {};
    document.querySelectorAll('[data-testid="account-figure"]').forEach((node) => {
      held[node.getAttribute('data-field')] = Number(node.getAttribute('data-value'));
    });
    held.balances =
      document.querySelector('[data-testid="account-balances"]').getAttribute('data-balances')
      === 'true';
    return held;
  });
}

function readSteps(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="step-row"]')).map((node) => ({
      at: Number(node.getAttribute('data-at')),
      chamber: node.getAttribute('data-chamber'),
      operation: node.getAttribute('data-operation'),
      worked: node.getAttribute('data-worked') === 'true',
      reason: node.getAttribute('data-reason') || null
    }))
  );
}

function readRefusal(page) {
  return page.evaluate(() => {
    const node = document.querySelector('[data-testid="refusal"]');
    if (!node || node.hidden) {
      return null;
    }
    return {
      at: Number(node.getAttribute('data-at')),
      chamber: node.getAttribute('data-chamber') || null,
      reason: node.getAttribute('data-reason')
    };
  });
}

function readWorked(page) {
  return page.evaluate(() => ({
    chambers: Array.from(document.querySelectorAll('[data-testid="worked-chamber"]')).map((node) =>
      node.getAttribute('data-chamber')
    ),
    complete:
      document.querySelector('[data-testid="passage-state"]').getAttribute('data-complete') === 'true'
  }));
}

function readLockfuls(page) {
  return page.evaluate(() => {
    const held = {};
    document.querySelectorAll('[data-testid="lockful"]').forEach((node) => {
      held[node.getAttribute('data-chamber')] = Number(node.getAttribute('data-value'));
    });
    return held;
  });
}

function readLowPounds(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="pound-gauge"]'))
      .filter((node) => node.getAttribute('data-within-band') === 'false')
      .map((node) => node.getAttribute('data-pound'))
  );
}

/* ------------------------------------------------------------------ *
 * measuring the window
 * ------------------------------------------------------------------ */

function measureWindow(page) {
  return page.evaluate(() => {
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

    const chambers = Array.from(document.querySelectorAll('[data-testid="chamber"]'));
    const boxes = chambers.map(boxOf);

    let chambersOverlapping = 0;
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        chambersOverlapping = Math.max(chambersOverlapping, overlapArea(boxes[i], boxes[j]));
      }
    }

    const stage = one('[data-testid="flight-stage"]');
    const insideStage = boxes.every(
      (box) =>
        box.top >= stage.top - 0.5
        && box.bottom <= stage.bottom + 0.5
        && box.left >= stage.left - 0.5
        && box.right <= stage.right + 0.5
    );

    const namesReadable = chambers.every((node) => {
      const name = node.querySelector('[data-testid="chamber-name"]');
      if (!name) {
        return false;
      }
      const nameBox = boxOf(name);
      const chamberBox = boxOf(node);
      return (
        name.textContent.trim().length > 0
        && name.scrollWidth <= name.clientWidth + 1
        && nameBox.left >= chamberBox.left - 0.5
        && nameBox.right <= chamberBox.right + 0.5
        && nameBox.bottom <= chamberBox.bottom + 0.5
      );
    });

    const gaugesReadable = Array.from(document.querySelectorAll('[data-testid="pound-gauge"]')).every(
      (node) => {
        const figure = node.querySelector('[data-testid="pound-figure"]');
        return Boolean(figure) && figure.textContent.trim().length > 0;
      }
    );

    return {
      viewportWidth: window.innerWidth,
      pageWiderThanWindow: document.documentElement.scrollWidth > window.innerWidth + 1,
      chamberCount: chambers.length,
      chambersOverlapping,
      chambersInsideStage: insideStage,
      chamberNamesReadable: namesReadable,
      gaugesReadable,
      planOverStage: overlapArea(one('[data-testid="plan-panel"]'), stage),
      planOverElevation: overlapArea(one('[data-testid="plan-panel"]'), one('[data-testid="elevation"]')),
      accountOverDesk: overlapArea(one('[data-testid="account"]'), one('[data-testid="passage-state"]'))
    };
  });
}

async function flightWindowAt(page, request, passage, viewport, steps) {
  await setPlan(request, passage, steps || UP_THROUGH_WHARF.concat(UP_THROUGH_STAIRCASE.slice(0, 7)));
  await page.setViewportSize(viewport);
  await openWindow(page, passage);
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid="chamber"]').length === count,
    4
  );
}

/* ------------------------------------------------------------------ *
 * checks
 * ------------------------------------------------------------------ */

test.beforeEach(async ({ request }) => {
  await clearFlight(request);
});

/* --- the wall a staircase pair shares ----------------------------- */

test('[F2P][D1] The shared gate stays shut when water is standing on both sides of it', async ({
  page,
  request
}) => {
  const passage = passageId('d1a');
  await setPlan(request, passage, BOTH_STAIRCASE_CHAMBERS_FULL.concat([OPEN_HEAD('stair-foot')]));
  await openWindow(page, passage);

  const steps = await readSteps(page);
  const chambers = await readChambers(page);
  writeJson('d1a_shared_wall.json', { steps, chambers, refusal: await readRefusal(page) });

  expect(
    {
      upperFull: chambers['stair-head'].levelIn === chambers['stair-head'].riseIn,
      lowerFull: chambers['stair-foot'].levelIn === chambers['stair-foot'].riseIn,
      gateWorked: steps[6].worked,
      gateState: chambers['stair-foot'].headGate
    },
    'with both chambers standing full the water is not level across the wall they share'
  ).toEqual({ upperFull: true, lowerFull: true, gateWorked: false, gateState: 'shut' });
});

test('[F2P][D1] A boat cannot be taken through a shared gate with water on both sides', async ({
  page,
  request
}) => {
  const passage = passageId('d1c');
  await setPlan(
    request,
    passage,
    UP_THROUGH_WHARF.concat([
      OPEN_TAIL('stair-foot'),
      BOAT_UP,
      SHUT_TAIL('stair-foot'),
      RAISE_HEAD('stair-head'),
      DROP_HEAD('stair-head'),
      RAISE_HEAD('stair-foot'),
      DROP_HEAD('stair-foot'),
      RAISE_HEAD('stair-head'),
      DROP_HEAD('stair-head'),
      OPEN_HEAD('stair-foot'),
      BOAT_UP
    ])
  );
  await openWindow(page, passage);

  const header = await readHeader(page);
  const chambers = await readChambers(page);
  writeJson('d1c_boat_held.json', { header, chambers, steps: await readSteps(page) });

  expect(
    {
      bothFull:
        chambers['stair-head'].levelIn === chambers['stair-head'].riseIn
        && chambers['stair-foot'].levelIn === chambers['stair-foot'].riseIn,
      place: header.place,
      sharedGate: chambers['stair-foot'].headGate
    },
    'the boat stays where it is while there is a head of water on the shared wall'
  ).toEqual({ bothFull: true, place: 'stair-foot', sharedGate: 'shut' });
});

/* --- a paddle and the gate at the other end ----------------------- */

test('[F2P][D2] The head paddle stays down while the tail gate is open', async ({
  page,
  request
}) => {
  const passage = passageId('d2a');
  await setPlan(request, passage, [OPEN_TAIL('wharf-tail'), RAISE_HEAD('wharf-tail')]);
  await openWindow(page, passage);

  const steps = await readSteps(page);
  const chambers = await readChambers(page);
  writeJson('d2a_paddle.json', { steps, chambers, pounds: await readPounds(page) });

  expect(
    {
      worked: steps[1].worked,
      paddle: chambers['wharf-tail'].headPaddle,
      level: chambers['wharf-tail'].levelIn
    },
    'a paddle at one end may not be raised with the gate at the other end open'
  ).toEqual({ worked: false, paddle: 'down', level: 0 });
});

test('[F2P][D2] The tail paddle stays down while the head gate is open', async ({
  page,
  request
}) => {
  const passage = passageId('d2b');
  await setPlan(
    request,
    passage,
    [
      RAISE_HEAD('wharf-tail'),
      DROP_HEAD('wharf-tail'),
      OPEN_HEAD('wharf-tail'),
      RAISE_TAIL('wharf-tail')
    ]
  );
  await openWindow(page, passage);

  const steps = await readSteps(page);
  const chambers = await readChambers(page);
  writeJson('d2b_paddle.json', { steps, chambers });

  expect(
    {
      worked: steps[3].worked,
      paddle: chambers['wharf-tail'].tailPaddle,
      stillFull: chambers['wharf-tail'].levelIn === chambers['wharf-tail'].riseIn
    },
    'the tail paddle may not be raised with the head gate open'
  ).toEqual({ worked: false, paddle: 'down', stillFull: true });
});

/* --- what a lockful comes to -------------------------------------- */

test('[F2P][D3] The gauge book gives each lockful in cubic feet', async ({ page, request }) => {
  const passage = passageId('d3a');
  await setPlan(request, passage, []);
  await openWindow(page, passage);

  const shown = await readLockfuls(page);
  const expected = {};
  FIXTURE.chambers.forEach((entry) => {
    expected[entry.id] = lockful(entry.id);
  });
  writeJson('d3a_lockfuls.json', { shown, expected });

  expect(shown, 'a lockful is the chamber area times its rise, brought to cubic feet').toEqual(
    expected
  );
});

test('[F2P][D3] The two chambers of the staircase hold the same lockful', async ({
  page,
  request
}) => {
  const passage = passageId('d3b');
  await setPlan(request, passage, []);
  await openWindow(page, passage);

  const shown = await readLockfuls(page);
  expect(
    { head: shown['stair-head'], foot: shown['stair-foot'], sameRise: chamber('stair-head').riseInches === chamber('stair-foot').riseInches },
    'the staircase chambers were built to one rise, so they hold one lockful each'
  ).toEqual({
    head: lockful('stair-head'),
    foot: lockful('stair-foot'),
    sameRise: true
  });
});

test('[F2P][D3] One lockful drawn lowers its pound by the inches that volume comes to', async ({
  page,
  request
}) => {
  const passage = passageId('d3c');
  await setPlan(request, passage, [RAISE_HEAD('bank-top'), DROP_HEAD('bank-top')]);
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d3c_drawdown.json', {
    pounds,
    expectedIn: round2(levelChange('summit', lockful('bank-top')))
  });

  expect(
    { drawnCuFt: pounds.summit.drawnCuFt, drawnIn: pounds.summit.drawnIn },
    'the summit gives up one lockful and falls by what that volume comes to over its surface'
  ).toEqual({
    drawnCuFt: lockful('bank-top'),
    drawnIn: round2(levelChange('summit', lockful('bank-top')))
  });
});

test('[F2P][D3] The whole flight account is kept in the same cubic feet as the gauge book', async ({
  page,
  request
}) => {
  const passage = passageId('d3d');
  await setPlan(request, passage, UP_THROUGH_WHARF);
  await openWindow(page, passage);

  const ledger = await readLedger(page);
  writeJson('d3d_ledger.json', { ledger, expected: lockful('wharf-tail') });

  expect(
    { drawn: ledger.drawn, standing: ledger.standing },
    'one lockful was drawn to lift the boat and it is standing in that chamber'
  ).toEqual({ drawn: lockful('wharf-tail'), standing: lockful('wharf-tail') });
});

/* --- the depth a pound may be drawn to ---------------------------- */

test('[F2P][D4] A pound standing exactly at its permitted depth is still within its band', async ({
  page,
  request
}) => {
  const passage = passageId('d4a');
  const perLockful = levelChange('summit', lockful('bank-top'));
  const rounds = Math.round(pound('summit').permittedDrawIn / perLockful);
  const plan = [];
  for (let index = 0; index < rounds; index += 1) {
    plan.push(...RUN_A_LOCKFUL_THROUGH('bank-top'));
  }
  await setPlan(request, passage, plan);
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d4a_band_edge.json', { rounds, pounds, permitted: pound('summit').permittedDrawIn });

  expect(
    { drawnIn: pounds.summit.drawnIn, withinBand: pounds.summit.withinBand },
    'a pound may be drawn to its permitted depth, and standing exactly there is permitted'
  ).toEqual({ drawnIn: pound('summit').permittedDrawIn, withinBand: true });
});

test('[F2P][D4] A pound drawn past its permitted depth is out of its band', async ({
  page,
  request
}) => {
  const passage = passageId('d4b');
  const perLockful = levelChange('summit', lockful('bank-top'));
  const rounds = Math.round(pound('summit').permittedDrawIn / perLockful) + 1;
  const plan = [];
  for (let index = 0; index < rounds; index += 1) {
    plan.push(...RUN_A_LOCKFUL_THROUGH('bank-top'));
  }
  await setPlan(request, passage, plan);
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d4b_past_band.json', { rounds, pounds });

  expect(
    {
      pastPermitted: pounds.summit.drawnIn > pound('summit').permittedDrawIn,
      withinBand: pounds.summit.withinBand
    },
    'one lockful past the permitted depth puts the pound out of its band'
  ).toEqual({ pastPermitted: true, withinBand: false });
});

test('[F2P][D4] The pound that has been drawn too far is the one that is named', async ({
  page,
  request
}) => {
  const passage = passageId('d4c');
  const perLockful = levelChange('summit', lockful('bank-top'));
  const rounds = Math.round(pound('summit').permittedDrawIn / perLockful) + 1;
  const plan = [];
  for (let index = 0; index < rounds; index += 1) {
    plan.push(...RUN_A_LOCKFUL_THROUGH('bank-top'));
  }
  await setPlan(request, passage, plan);
  await openWindow(page, passage);

  const low = await readLowPounds(page);
  writeJson('d4c_named.json', { low });

  expect(low, 'the summit is the pound that fed those lockfuls, so it is the one named').toEqual([
    'summit'
  ]);
});

/* --- which water a chamber draws on and sends to ------------------ */

test('[F2P][D5] Filling a chamber draws on the water standing above it', async ({
  page,
  request
}) => {
  const passage = passageId('d5a');
  await setPlan(request, passage, [RAISE_HEAD('bank-top'), DROP_HEAD('bank-top')]);
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d5a_above.json', { pounds });

  expect(
    { summit: pounds.summit.drawnCuFt, mill: pounds.mill.drawnCuFt },
    'the bank top lock fills from the summit above it, not from the mill pound below'
  ).toEqual({ summit: lockful('bank-top'), mill: 0 });
});

test('[F2P][D5] Emptying a chamber sends its lockful into the water below it', async ({
  page,
  request
}) => {
  const passage = passageId('d5b');
  await setPlan(request, passage, RUN_A_LOCKFUL_THROUGH('bank-top'));
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d5b_below.json', { pounds });

  expect(
    { millDelivered: pounds.mill.deliveredCuFt, summitDelivered: pounds.summit.deliveredCuFt },
    'the lockful runs out of the bank top lock into the mill pound below it'
  ).toEqual({ millDelivered: lockful('bank-top'), summitDelivered: 0 });
});

test('[F2P][D5] A lockful run down the hill leaves one pound lower and the next higher', async ({
  page,
  request
}) => {
  const passage = passageId('d5c');
  await setPlan(request, passage, RUN_A_LOCKFUL_THROUGH('bank-top'));
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d5c_hill.json', { pounds });

  expect(
    {
      summitDown: pounds.summit.drawnIn > 0,
      millDown: pounds.mill.drawnIn,
      millCredited: pounds.mill.deliveredCuFt
    },
    'the summit is down by that lockful and the mill has it'
  ).toEqual({ summitDown: true, millDown: 0, millCredited: lockful('bank-top') });
});

test('[F2P][D5] The tail water takes a lockful without a band to answer to', async ({
  page,
  request
}) => {
  const passage = passageId('d5d');
  await setPlan(request, passage, RUN_A_LOCKFUL_THROUGH('wharf-tail'));
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  const gauged = FIXTURE.pounds.filter((entry) => entry.banded).map((entry) => entry.id).sort();
  writeJson('d5d_tail.json', { pounds, gauged });

  expect(
    {
      basinDrawn: pounds.basin.drawnCuFt,
      gaugedPounds: Object.keys(pounds).sort()
    },
    'the wharf tail lock draws on the basin, and the tail water below it is not gauged'
  ).toEqual({ basinDrawn: lockful('wharf-tail'), gaugedPounds: gauged });
});

/* --- the wall the staircase shares -------------------------------- */

test('[F2P][D6] Water crossing the shared wall is charged to no pound at all', async ({
  page,
  request
}) => {
  const passage = passageId('d6a');
  await setPlan(
    request,
    passage,
    [
      RAISE_HEAD('stair-head'),
      DROP_HEAD('stair-head'),
      RAISE_HEAD('stair-foot'),
      DROP_HEAD('stair-foot')
    ]
  );
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d6a_shared.json', { pounds, chambers: await readChambers(page) });

  expect(
    { mill: pounds.mill.drawnCuFt, basin: pounds.basin.drawnCuFt },
    'filling the upper chamber costs the mill one lockful and the crossing costs nothing'
  ).toEqual({ mill: lockful('stair-head'), basin: 0 });
});

test('[F2P][D6] A crossing of the shared wall costs the flight one lockful, not two', async ({
  page,
  request
}) => {
  const passage = passageId('d6b');
  await setPlan(
    request,
    passage,
    [
      RAISE_HEAD('stair-head'),
      DROP_HEAD('stair-head'),
      RAISE_HEAD('stair-foot'),
      DROP_HEAD('stair-foot')
    ]
  );
  await openWindow(page, passage);

  const ledger = await readLedger(page);
  const chambers = await readChambers(page);
  writeJson('d6b_ledger.json', { ledger, chambers });

  expect(
    {
      drawn: ledger.drawn,
      standing: ledger.standing,
      upperEmpty: chambers['stair-head'].levelIn === 0,
      lowerFull: chambers['stair-foot'].levelIn === chambers['stair-foot'].riseIn
    },
    'one lockful came out of the mill to fill the upper chamber and it is now standing in the lower one'
  ).toEqual({
    drawn: lockful('stair-head'),
    standing: lockful('stair-foot'),
    upperEmpty: true,
    lowerFull: true
  });
});

test('[F2P][D6] Taking a boat up the staircase draws the mill pound once for each fill', async ({
  page,
  request
}) => {
  const passage = passageId('d6c');
  await setPlan(request, passage, UP_THROUGH_WHARF.concat(UP_THROUGH_STAIRCASE));
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d6c_staircase.json', { pounds, header: await readHeader(page) });

  expect(
    { millCuFt: pounds.mill.drawnCuFt, millIn: pounds.mill.drawnIn },
    'one fill of the upper chamber went out of the mill, and the crossing added nothing'
  ).toEqual({
    millCuFt: lockful('stair-head'),
    millIn: round2(levelChange('mill', lockful('stair-head')))
  });
});

/* --- the account -------------------------------------------------- */

test('[F2P][D7] Water sent back into a pound is put to that pound credit', async ({
  page,
  request
}) => {
  const passage = passageId('d7a');
  await setPlan(request, passage, RUN_A_LOCKFUL_THROUGH('wharf-tail'));
  await openWindow(page, passage);

  const ledger = await readLedger(page);
  writeJson('d7a_credit.json', { ledger, pounds: await readPounds(page) });

  expect(
    { drawn: ledger.drawn, delivered: ledger.delivered, standing: ledger.standing },
    'the lockful came out of the basin and went into the tail water, so nothing is standing'
  ).toEqual({ drawn: lockful('wharf-tail'), delivered: lockful('wharf-tail'), standing: 0 });
});

test('[F2P][D7] The account balances when a lockful has been drawn and sent on', async ({
  page,
  request
}) => {
  const passage = passageId('d7b');
  await setPlan(request, passage, RUN_A_LOCKFUL_THROUGH('bank-top'));
  await openWindow(page, passage);

  const ledger = await readLedger(page);
  writeJson('d7b_balance.json', { ledger });

  expect(
    { balances: ledger.balances, drawnEqualsRest: ledger.drawn === ledger.delivered + ledger.standing },
    'everything the pounds gave up is either back in a pound or standing in a chamber'
  ).toEqual({ balances: true, drawnEqualsRest: true });
});

test('[F2P][D7] A pound that gave a lockful and had one back stands where it started', async ({
  page,
  request
}) => {
  const passage = passageId('d7c');
  await setPlan(
    request,
    passage,
    RUN_A_LOCKFUL_THROUGH('bank-top').concat(RUN_A_LOCKFUL_THROUGH('stair-head'))
  );
  await openWindow(page, passage);

  const pounds = await readPounds(page);
  writeJson('d7c_evens.json', { pounds });

  expect(
    {
      millDrawn: pounds.mill.drawnCuFt,
      millDelivered: pounds.mill.deliveredCuFt,
      millLevel: pounds.mill.drawnIn
    },
    'the mill gave the staircase a lockful and had one from the bank top, so it is level again'
  ).toEqual({
    millDrawn: lockful('stair-head'),
    millDelivered: lockful('bank-top'),
    millLevel: 0
  });
});

/* --- how a plan is walked ----------------------------------------- */

test('[F2P][D8] The first step that cannot be worked is the one reported', async ({
  page,
  request
}) => {
  const passage = passageId('d8a');
  await setPlan(
    request,
    passage,
    [OPEN_HEAD('wharf-tail'), RAISE_HEAD('wharf-tail'), OPEN_TAIL('wharf-tail')]
  );
  await openWindow(page, passage);

  const refusal = await readRefusal(page);
  writeJson('d8a_first_refusal.json', { refusal, steps: await readSteps(page) });

  expect(
    { at: refusal && refusal.at, chamber: refusal && refusal.chamber },
    'the head gate on an empty chamber is the first thing that cannot be worked'
  ).toEqual({ at: 0, chamber: 'wharf-tail' });
});

test('[F2P][D8] Nothing after a refused step is worked', async ({ page, request }) => {
  const passage = passageId('d8b');
  await setPlan(
    request,
    passage,
    [OPEN_HEAD('wharf-tail'), OPEN_TAIL('wharf-tail'), RAISE_HEAD('wharf-tail')]
  );
  await openWindow(page, passage);

  const steps = await readSteps(page);
  const chambers = await readChambers(page);
  writeJson('d8b_after_refusal.json', { steps, chambers });

  expect(
    {
      worked: steps.map((step) => step.worked),
      tailGate: chambers['wharf-tail'].tailGate,
      level: chambers['wharf-tail'].levelIn
    },
    'the plan stops at the refusal, so the gate below stays shut and no water runs'
  ).toEqual({ worked: [false, false, false], tailGate: 'shut', level: 0 });
});

/* --- which chambers the boat has been through --------------------- */

test('[F2P][D9] Opening a head gate does not count the chamber as worked through', async ({
  page,
  request
}) => {
  const passage = passageId('d9a');
  await setPlan(
    request,
    passage,
    [
      RAISE_HEAD('wharf-tail'),
      DROP_HEAD('wharf-tail'),
      OPEN_HEAD('wharf-tail')
    ]
  );
  await openWindow(page, passage);

  const worked = await readWorked(page);
  const header = await readHeader(page);
  writeJson('d9a_worked.json', { worked, header });

  expect(
    { chambers: worked.chambers, count: header.workedCount, place: header.place },
    'the boat has not been near the lock, so nothing has been worked through'
  ).toEqual({ chambers: [], count: 0, place: 'tail' });
});

test('[F2P][D9] A chamber counts as worked through once the boat is out of it', async ({
  page,
  request
}) => {
  const passage = passageId('d9b');
  await setPlan(
    request,
    passage,
    UP_THROUGH_WHARF.concat([
      RAISE_HEAD('stair-head'),
      DROP_HEAD('stair-head'),
      OPEN_HEAD('stair-head')
    ])
  );
  await openWindow(page, passage);

  const worked = await readWorked(page);
  const header = await readHeader(page);
  writeJson('d9b_worked.json', { worked, header });

  expect(
    { chambers: worked.chambers, count: header.workedCount, place: header.place, complete: worked.complete },
    'the boat went through the wharf tail lock; the stair head only had its gate opened'
  ).toEqual({ chambers: ['wharf-tail'], count: 1, place: 'basin', complete: false });
});

/* --- the paddles before a gate ------------------------------------ */

test('[F2P][D11] A gate stays shut while the head paddle on its chamber is raised', async ({
  page,
  request
}) => {
  const passage = passageId('d11a');
  await setPlan(request, passage, [RAISE_HEAD('wharf-tail'), OPEN_HEAD('wharf-tail')]);
  await openWindow(page, passage);

  const steps = await readSteps(page);
  const chambers = await readChambers(page);
  writeJson('d11a_paddle_up.json', { steps, chambers });

  expect(
    { worked: steps[1].worked, gate: chambers['wharf-tail'].headGate },
    'the paddles come down before a gate is touched'
  ).toEqual({ worked: false, gate: 'shut' });
});

test('[F2P][D11] A gate stays shut while the tail paddle on its chamber is raised', async ({
  page,
  request
}) => {
  const passage = passageId('d11b');
  await setPlan(
    request,
    passage,
    [
      RAISE_HEAD('wharf-tail'),
      DROP_HEAD('wharf-tail'),
      RAISE_TAIL('wharf-tail'),
      OPEN_TAIL('wharf-tail')
    ]
  );
  await openWindow(page, passage);

  const steps = await readSteps(page);
  const chambers = await readChambers(page);
  writeJson('d11b_paddle_up.json', { steps, chambers });

  expect(
    { worked: steps[3].worked, gate: chambers['wharf-tail'].tailGate },
    'the tail paddle comes down before the tail gate is opened'
  ).toEqual({ worked: false, gate: 'shut' });
});

/* --- the window at a narrow width --------------------------------- */

test('[F2P][D10] The chambers do not lie on top of one another in a narrow window', async ({
  page,
  request
}) => {
  await flightWindowAt(page, request, FIXTURE.passages.narrow, NARROW);

  const measured = await measureWindow(page);
  writeJson('d10a_narrow.json', measured);
  await page.screenshot({ path: path.join(ARTIFACTS, 'd10a_narrow.png'), fullPage: true });

  expect(
    { chamberCount: measured.chamberCount, overlapping: measured.chambersOverlapping },
    'each chamber of the flight needs its own room on the elevation'
  ).toEqual({ chamberCount: 4, overlapping: 0 });
});

test('[F2P][D10] Every chamber stays inside the elevation in a narrow window', async ({
  page,
  request
}) => {
  await flightWindowAt(page, request, FIXTURE.passages.narrow, NARROW);

  const measured = await measureWindow(page);
  writeJson('d10b_narrow.json', measured);

  expect(
    { inside: measured.chambersInsideStage, wider: measured.pageWiderThanWindow },
    'the flight is drawn within the frame it is given'
  ).toEqual({ inside: true, wider: false });
});

test('[F2P][D10] The chamber names stay readable in a narrow window', async ({ page, request }) => {
  await flightWindowAt(page, request, FIXTURE.passages.narrow, NARROW);

  const measured = await measureWindow(page);
  writeJson('d10c_narrow.json', measured);

  expect(
    { names: measured.chamberNamesReadable, gauges: measured.gaugesReadable },
    'a keeper has to be able to tell which chamber is which and how each pound stands'
  ).toEqual({ names: true, gauges: true });
});

test('[F2P][D10] The plan does not cover the elevation in a narrow window', async ({
  page,
  request
}) => {
  await flightWindowAt(page, request, FIXTURE.passages.narrow, NARROW);

  const measured = await measureWindow(page);
  writeJson('d10d_narrow.json', measured);

  expect(
    { overStage: measured.planOverStage, overElevation: measured.planOverElevation },
    'the plan belongs beside or below the elevation, never on top of it'
  ).toEqual({ overStage: 0, overElevation: 0 });
});

test('[F2P][D10] Narrowing a full window keeps the elevation clear without opening it again', async ({
  page,
  request
}) => {
  await flightWindowAt(page, request, FIXTURE.passages.narrow, FULL);

  await page.setViewportSize(NARROW);
  await page.waitForFunction((width) => window.innerWidth === width, NARROW.width);

  const measured = await measureWindow(page);
  writeJson('d10e_after_resize.json', measured);
  await page.screenshot({ path: path.join(ARTIFACTS, 'd10e_after_resize.png'), fullPage: true });

  expect(
    {
      overlapping: measured.chambersOverlapping,
      inside: measured.chambersInsideStage,
      names: measured.chamberNamesReadable,
      planOverStage: measured.planOverStage,
      wider: measured.pageWiderThanWindow
    },
    'dragging the window narrower should lay the flight out for the narrower window'
  ).toEqual({
    overlapping: 0,
    inside: true,
    names: true,
    planOverStage: 0,
    wider: false
  });
});

/* --- what already works and must keep working --------------------- */

test('[P2P] The gauge book lists the flight from the top of the hill down', async ({
  page,
  request
}) => {
  const passage = passageId('p2p1');
  await setPlan(request, passage, []);
  await openWindow(page, passage);

  const listed = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="lockful"]')).map((node) =>
      node.getAttribute('data-chamber')
    )
  );

  expect(listed, 'the gauge book reads bank top first and wharf tail last').toEqual(
    FIXTURE.chambers.map((entry) => entry.id)
  );
});

test('[P2P] A flight with no plan on it stands empty with the boat below', async ({
  page,
  request
}) => {
  const passage = passageId('p2p2');
  await setPlan(request, passage, []);
  await openWindow(page, passage);

  const chambers = await readChambers(page);
  const header = await readHeader(page);

  expect(
    {
      levels: Object.keys(chambers).map((id) => chambers[id].levelIn),
      gates: Object.keys(chambers).map((id) => chambers[id].headGate),
      place: header.place,
      worked: header.workedCount
    },
    'the keeper finds the flight empty, shut up, with the boat on the tail water'
  ).toEqual({
    levels: [0, 0, 0, 0],
    gates: ['shut', 'shut', 'shut', 'shut'],
    place: 'tail',
    worked: 0
  });
});

test('[P2P] A step added from the composer appears in the plan', async ({ page, request }) => {
  const passage = passageId('p2p3');
  await setPlan(request, passage, []);
  await openWindow(page, passage);

  await addStep(page, 'wharf-tail', 'open-tail-gate');

  const steps = await readSteps(page);
  expect(
    { count: steps.length, chamber: steps[0].chamber, operation: steps[0].operation },
    'writing a step down puts it on the plan'
  ).toEqual({ count: 1, chamber: 'wharf-tail', operation: 'open-tail-gate' });
});

test('[P2P] A paddle raised with both gates shut is worked', async ({ page, request }) => {
  const passage = passageId('p2p4');
  await setPlan(request, passage, [RAISE_HEAD('wharf-tail')]);
  await openWindow(page, passage);

  const steps = await readSteps(page);
  const chambers = await readChambers(page);

  expect(
    { worked: steps[0].worked, paddle: chambers['wharf-tail'].headPaddle, full: chambers['wharf-tail'].levelIn === chambers['wharf-tail'].riseIn },
    'with the chamber shut up the paddle may be raised and the chamber fills'
  ).toEqual({ worked: true, paddle: 'raised', full: true });
});

test('[P2P] A paddle is not raised when there is nothing for it to move', async ({
  page,
  request
}) => {
  const passage = passageId('p2p12');
  await setPlan(
    request,
    passage,
    [
      RAISE_HEAD('wharf-tail'),
      DROP_HEAD('wharf-tail'),
      RAISE_HEAD('wharf-tail'),
      RAISE_HEAD('stair-foot')
    ]
  );
  await openWindow(page, passage);

  const steps = await readSteps(page);
  writeJson('p2p12_nothing_to_move.json', { steps });

  expect(
    {
      filled: steps[0].worked,
      againOnAFullChamber: steps[2].worked,
      acrossAnEmptyWall: steps[3].worked
    },
    'a full chamber has no room, and a shared wall with nothing behind it has nothing to give'
  ).toEqual({ filled: true, againOnAFullChamber: false, acrossAnEmptyWall: false });
});

test('[P2P] Shutting a gate and dropping a paddle are always worked', async ({ page, request }) => {
  const passage = passageId('p2p5');
  await setPlan(
    request,
    passage,
    [SHUT_HEAD('wharf-tail'), SHUT_TAIL('wharf-tail'), DROP_HEAD('wharf-tail'), DROP_TAIL('wharf-tail')]
  );
  await openWindow(page, passage);

  const steps = await readSteps(page);
  expect(
    steps.map((step) => step.worked),
    'shutting up and dropping paddles is never refused'
  ).toEqual([true, true, true, true]);
});

test('[P2P] A plan that can be worked all the way through reports no refusal', async ({
  page,
  request
}) => {
  const passage = passageId('p2p6');
  await setPlan(request, passage, UP_THROUGH_WHARF);
  await openWindow(page, passage);

  const refusal = await readRefusal(page);
  const steps = await readSteps(page);

  expect(
    { refusal, allWorked: steps.every((step) => step.worked), count: steps.length },
    'taking the boat up the bottom lock is a plan that works'
  ).toEqual({ refusal: null, allWorked: true, count: UP_THROUGH_WHARF.length });
});

test('[P2P] Taking back the last step removes it from the plan', async ({ page, request }) => {
  const passage = passageId('p2p7');
  await setPlan(request, passage, [OPEN_TAIL('wharf-tail'), BOAT_UP]);
  await openWindow(page, passage);

  await takeBackLastStep(page);

  const steps = await readSteps(page);
  expect(
    { count: steps.length, operation: steps[0].operation },
    'the plan loses its last step and keeps the rest'
  ).toEqual({ count: 1, operation: 'open-tail-gate' });
});

test('[P2P] The window names the boat being worked through', async ({ page, request }) => {
  const passage = passageId('p2p8');
  await setPlan(request, passage, []);
  await openWindow(page, passage);

  const header = await readHeader(page);
  expect(header.boat, 'a boat is going up the flight and the window says which').toBe(
    FIXTURE.boatName
  );
});

test('[P2P] Opening the window again shows the same plan', async ({ page, request }) => {
  const passage = passageId('p2p9');
  await setPlan(request, passage, UP_THROUGH_WHARF);
  await openWindow(page, passage);

  const before = await readSteps(page);
  await reopenWindow(page);
  const after = await readSteps(page);

  expect(after, 'the plan is where the keeper left it').toEqual(before);
});

test('[P2P] The shared gate opens once the chamber above has been let down into the one below', async ({
  page,
  request
}) => {
  const passage = passageId('p2p11');
  await setPlan(
    request,
    passage,
    [
      RAISE_HEAD('stair-head'),
      DROP_HEAD('stair-head'),
      RAISE_HEAD('stair-foot'),
      DROP_HEAD('stair-foot'),
      OPEN_HEAD('stair-foot')
    ]
  );
  await openWindow(page, passage);

  const chambers = await readChambers(page);
  const steps = await readSteps(page);
  writeJson('d1b_shared_wall.json', { steps, chambers });

  expect(
    {
      upperEmpty: chambers['stair-head'].levelIn === 0,
      lowerFull: chambers['stair-foot'].levelIn === chambers['stair-foot'].riseIn,
      gateWorked: steps[4].worked,
      gateState: chambers['stair-foot'].headGate
    },
    'the water is level across the shared wall once it has all run into the lower chamber'
  ).toEqual({ upperEmpty: true, lowerFull: true, gateWorked: true, gateState: 'open' });
});

test('[P2P] A full-width window keeps the elevation and the plan apart', async ({
  page,
  request
}) => {
  await flightWindowAt(page, request, FIXTURE.passages.spare, FULL);

  const measured = await measureWindow(page);
  writeJson('p2p10_full_width.json', measured);

  expect(
    {
      chamberCount: measured.chamberCount,
      overlapping: measured.chambersOverlapping,
      inside: measured.chambersInsideStage,
      names: measured.chamberNamesReadable,
      planOverStage: measured.planOverStage,
      wider: measured.pageWiderThanWindow
    },
    'a full-width window has room for the elevation and the plan side by side'
  ).toEqual({
    chamberCount: 4,
    overlapping: 0,
    inside: true,
    names: true,
    planOverStage: 0,
    wider: false
  });
});
