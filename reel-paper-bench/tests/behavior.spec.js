const { test, expect } = require('@playwright/test');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const STATIONS = [
  'Drive end',
  'Drive quarter',
  'Center',
  'Non-drive quarter',
  'Non-drive end',
];

function numberFrom(text) {
  const match = String(text).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

async function ready(page) {
  await expect(page.getByRole('heading', { name: 'Reel Paper Bench', exact: true })).toBeVisible();
  await expect(page.getByLabel('Active fixture ID')).toHaveText('UNIT-A7');
}

test.beforeEach(async ({ page }) => {
  await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
  await ready(page);
});

async function useFixture(page, id) {
  const response = page.waitForResponse((entry) => (
    entry.url().includes('/api/start') && entry.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: `Use ${id}`, exact: true }).click();
  await response;
  await expect(page.getByLabel('Active fixture ID')).toHaveText(id);
}

async function selectBlade(page, blade) {
  await page.getByRole('button', { name: `Blade ${blade}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Blade ${blade}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

function paperRadio(page, station, mode, outcome) {
  return page
    .getByLabel(`${station} paper swatch`, { exact: true })
    .getByRole('radio', { name: `${station} ${mode}: ${outcome}`, exact: true });
}

async function setOutcome(page, station, mode, outcome) {
  const response = page.waitForResponse((entry) => (
    entry.url().includes('/api/result') && entry.request().method() === 'POST'
  ));
  await paperRadio(page, station, mode, outcome).check();
  await response;
  await expect(paperRadio(page, station, mode, outcome)).toBeChecked();
}

async function setPassAt(page, station) {
  await setOutcome(page, station, 'lengthwise', 'Light even drag');
  await setOutcome(page, station, 'upright', 'Clean cut');
}

async function fillBladePass(page, blade) {
  await selectBlade(page, blade);
  for (const station of STATIONS) await setPassAt(page, station);
}

async function fillAllPass(page, bladeCount, skip = null) {
  for (let blade = 1; blade <= bladeCount; blade += 1) {
    await selectBlade(page, blade);
    for (const station of STATIONS) {
      if (skip?.blade !== blade || skip.station !== station || skip.mode !== 'lengthwise') {
        await setOutcome(page, station, 'lengthwise', 'Light even drag');
      }
      if (skip?.blade !== blade || skip.station !== station || skip.mode !== 'upright') {
        await setOutcome(page, station, 'upright', 'Clean cut');
      }
    }
  }
}

async function setFreeSpin(page) {
  const response = page.waitForResponse((entry) => (
    entry.url().includes('/api/free-spin') && entry.request().method() === 'POST'
  ));
  await page.getByRole('checkbox', { name: 'Full free-spin check', exact: true }).check();
  await response;
}

async function metric(page, label) {
  return numberFrom(await page.getByLabel(label, { exact: true }).innerText());
}

async function text(page, label) {
  return (await page.getByLabel(label, { exact: true }).innerText()).trim();
}

function overlaps(first, second) {
  return !(first.x + first.width <= second.x || second.x + second.width <= first.x
    || first.y + first.height <= second.y || second.y + second.height <= first.y);
}

// Stable surface

test('[P2P] The paper bench opens with its fixture plate, service mat, and release controls.', async ({ page }) => {
  await expect(page.getByLabel('Cutting-unit fixture plate')).toBeVisible();
  await expect(page.getByLabel('Reel paper service mat')).toBeVisible();
  await expect(page.getByLabel('Release controls')).toBeVisible();
});

test('[P2P] Unit A7 posts seven blades and five ordered paper stations.', async ({ page }) => {
  await expect(page.getByLabel('Fixture blade count')).toHaveText('7');
  await expect(page.getByLabel('No-drag correction')).toContainText('0.019 mm');
  await expect(page.getByLabel('Binding correction')).toContainText('0.021 mm');
  const stations = page.getByLabel('Five paper stations').getByRole('article');
  await expect(stations).toHaveCount(5);
  expect(await stations.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))).toEqual(
    STATIONS.map((station) => `${station} paper swatch`),
  );
});

test('[P2P] The blade tape reaches its first, middle, and final blade.', async ({ page }) => {
  for (const blade of [1, 4, 7]) await selectBlade(page, blade);
});

test('[P2P] Every paper station exposes both orientations and all six observations.', async ({ page }) => {
  for (const station of STATIONS) {
    const swatch = page.getByLabel(`${station} paper swatch`, { exact: true });
    await expect(swatch.getByRole('group', { name: `${station} lengthwise paper` })).toBeVisible();
    await expect(swatch.getByRole('group', { name: `${station} upright paper` })).toBeVisible();
    await expect(swatch.getByRole('radio')).toHaveCount(6);
  }
});

test('[P2P] An untouched proof remains on hold with no recorded observations.', async ({ page }) => {
  await expect(page.getByLabel('Completed observations')).toHaveText('0');
  await expect(page.getByRole('button', { name: 'RELEASE CUTTING UNIT', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Release status')).toHaveText('HOLD');
});

// Compound observation identity

test('[F2P][D1] Different blade and station coordinates keep independent observations.', async ({ page }) => {
  await selectBlade(page, 1);
  await setOutcome(page, 'Non-drive end', 'lengthwise', 'No drag');
  await selectBlade(page, 2);
  await setOutcome(page, 'Drive end', 'lengthwise', 'Light even drag');
  await selectBlade(page, 1);
  await expect(paperRadio(page, 'Non-drive end', 'lengthwise', 'No drag')).toBeChecked();
  await selectBlade(page, 2);
  await expect(paperRadio(page, 'Drive end', 'lengthwise', 'Light even drag')).toBeChecked();
});

// Paper mode semantics

test('[F2P][D2] A ragged upright cut keeps an otherwise correct station from passing.', async ({ page }) => {
  await setOutcome(page, 'Center', 'lengthwise', 'Light even drag');
  await setOutcome(page, 'Center', 'upright', 'Ragged / partial');
  await expect(page.getByLabel('Center check status')).toHaveText('CHECK');
});

test('[F2P][D2] An upright-only paper result never creates bedbar movement.', async ({ page }) => {
  await setOutcome(page, 'Non-drive end', 'upright', 'Ragged / partial');
  await expect(page.getByLabel('Non-drive click count')).toHaveText('0');
  await expect(page.getByLabel('Non-drive recommendation status')).toHaveText('NO MOVE');
});

// Blade and station topology

test('[F2P][D3] A drive-end defect on the last blade still drives its adjuster.', async ({ page }) => {
  await selectBlade(page, 7);
  await setOutcome(page, 'Drive end', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Non-drive click count')).toHaveText('0');
});

test('[F2P][D3] The center paper mark contributes to both bedbar adjusters.', async ({ page }) => {
  await setOutcome(page, 'Center', 'lengthwise', 'No drag');
  expect(await metric(page, 'Drive-end click count')).toBeGreaterThan(0);
  expect(await metric(page, 'Non-drive click count')).toBeGreaterThan(0);
});

test('[F2P][D3] The drive-quarter mark affects only the physical drive adjuster.', async ({ page }) => {
  await setOutcome(page, 'Drive quarter', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Non-drive click count')).toHaveText('0');
});

// Worst-case and conflicting demands

test('[F2P][D4] Passing marks cannot average away one required drive-end movement.', async ({ page }) => {
  await setOutcome(page, 'Drive end', 'lengthwise', 'No drag');
  await setOutcome(page, 'Center', 'lengthwise', 'Light even drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
});

test('[F2P][D4] Opposing demands assigned to one adjuster withhold its recommendation.', async ({ page }) => {
  await setOutcome(page, 'Drive end', 'lengthwise', 'No drag');
  await setOutcome(page, 'Center', 'lengthwise', 'Binding');
  await expect(page.getByLabel('Drive-end recommendation status')).toHaveText('WITHHOLD');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('0');
});

// Physical orientation

test('[F2P][D5] Unit B5 places its physical drive-end paper station on the right.', async ({ page }) => {
  await useFixture(page, 'UNIT-B5');
  const labels = await page.getByLabel('Five paper stations').getByRole('article')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  expect(labels[0]).toBe('Non-drive end paper swatch');
  expect(labels[4]).toBe('Drive end paper swatch');
  await expect(page.getByLabel('Drive end screen side')).toHaveText('right');
});

test('[F2P][D5] A no-drag result on Unit B5s rightmost swatch affects the drive adjuster.', async ({ page }) => {
  await useFixture(page, 'UNIT-B5');
  const last = page.getByLabel('Five paper stations').getByRole('article').last();
  await expect(last).toHaveAttribute('aria-label', 'Drive end paper swatch');
  const response = page.waitForResponse((entry) => entry.url().includes('/api/result'));
  await last.getByRole('radio', { name: 'Drive end lengthwise: No drag', exact: true }).check();
  await response;
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Non-drive click count')).toHaveText('0');
});

// Fixture-specific adjuster profiles

test('[F2P][D6] Unit B5 maps drive-end closing movement through its posted CCW direction.', async ({ page }) => {
  await useFixture(page, 'UNIT-B5');
  await setOutcome(page, 'Drive end', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive adjuster closing direction', { exact: true })).toHaveText('CCW');
  await expect(page.getByLabel('Drive-end turn direction')).toHaveText('CCW');
});

test('[F2P][D6] Unit B5 uses its own click pitch and limit for a drive-end correction.', async ({ page }) => {
  await useFixture(page, 'UNIT-B5');
  await setOutcome(page, 'Drive end', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Drive-end movement')).toContainText('0.050 mm');
});

// Quantization and cap

test('[F2P][D7] A nonintegral opening movement rounds outward to two whole clicks.', async ({ page }) => {
  await setOutcome(page, 'Drive end', 'lengthwise', 'Binding');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Drive-end turn direction')).toHaveText('CCW');
});

test('[F2P][D7] A recommendation beyond the Unit B5 cap exposes the reached limit.', async ({ page }) => {
  await useFixture(page, 'UNIT-B5');
  await setOutcome(page, 'Drive end', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Drive-end limit status')).toHaveText('LIMIT REACHED');
});

// Unit presentation

test('[F2P][D8] Switching to inches preserves observations, clicks, and turn direction.', async ({ page }) => {
  await setOutcome(page, 'Drive end', 'lengthwise', 'Binding');
  await page.getByRole('button', { name: 'SHOW INCHES', exact: true }).click();
  await expect(paperRadio(page, 'Drive end', 'lengthwise', 'Binding')).toBeChecked();
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Drive-end turn direction')).toHaveText('CCW');
  await expect(page.getByLabel('Click pitch', { exact: true })).toContainText('in');
});

test('[F2P][D8] Displayed inch movement remains the click count times the posted pitch.', async ({ page }) => {
  await setOutcome(page, 'Drive end', 'lengthwise', 'Binding');
  await page.getByRole('button', { name: 'SHOW INCHES', exact: true }).click();
  const clicks = await metric(page, 'Drive-end click count');
  const pitch = await metric(page, 'Click pitch');
  const movement = await metric(page, 'Drive-end movement');
  expect(Math.abs(movement - clicks * pitch)).toBeLessThan(0.00011);
  await page.getByRole('button', { name: 'SHOW MILLIMETRES', exact: true }).click();
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
});

// Authoritative release universe

test('[F2P][D9] Completing only the selected blade cannot complete a seven-blade proof.', async ({ page }) => {
  await fillBladePass(page, 1);
  await setFreeSpin(page);
  await expect(page.getByLabel('Completed observations')).toHaveText('10');
  await expect(page.getByRole('button', { name: 'RELEASE CUTTING UNIT', exact: true })).toBeDisabled();
});

test('[F2P][D9] Replacing one existing result cannot substitute for a missing matrix coordinate.', async ({ page }) => {
  await fillAllPass(page, 7, { blade: 7, station: 'Non-drive end', mode: 'upright' });
  await selectBlade(page, 7);
  await setOutcome(page, 'Drive end', 'lengthwise', 'Binding');
  await setFreeSpin(page);
  await expect(page.getByLabel('Completed observations')).toHaveText('69');
  await expect(page.getByRole('button', { name: 'RELEASE CUTTING UNIT', exact: true })).toBeDisabled();
});

test('[F2P][D9] One nonpassing result keeps a complete free-spinning proof on hold.', async ({ page }) => {
  await fillAllPass(page, 7);
  await selectBlade(page, 7);
  await setOutcome(page, 'Non-drive end', 'upright', 'Ragged / partial');
  await setFreeSpin(page);
  await expect(page.getByLabel('Completed observations')).toHaveText('70');
  await expect(page.getByRole('button', { name: 'RELEASE CUTTING UNIT', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Release status')).toHaveText('HOLD');
});

// Form grouping

test('[F2P][D10] Rapid paper checks keep the newer complete snapshot when responses cross.', async ({ page }) => {
  const lengthwiseResponse = page.waitForResponse((entry) => (
    entry.url().includes('/api/result')
      && entry.request().postData()?.includes('"mode":"lengthwise"')
  ));
  const uprightResponse = page.waitForResponse((entry) => (
    entry.url().includes('/api/result')
      && entry.request().postData()?.includes('"mode":"upright"')
  ));
  await paperRadio(page, 'Drive end', 'lengthwise', 'Light even drag').check();
  await paperRadio(page, 'Drive end', 'upright', 'Clean cut').check();
  await Promise.all([lengthwiseResponse, uprightResponse]);
  await expect(paperRadio(page, 'Drive end', 'lengthwise', 'Light even drag')).toBeChecked();
  await expect(paperRadio(page, 'Drive end', 'upright', 'Clean cut')).toBeChecked();
  await expect(page.getByLabel('Completed observations')).toHaveText('2');
});

test('[F2P][D10] A delayed observation from the prior proof cannot replace a newly selected fixture.', async ({ page }) => {
  const oldResponse = page.waitForResponse((entry) => (
    entry.url().includes('/api/result')
      && entry.request().postData()?.includes('"mode":"lengthwise"')
  ));
  await paperRadio(page, 'Center', 'lengthwise', 'No drag').check();
  const newProof = page.waitForResponse((entry) => entry.url().includes('/api/start'));
  await page.getByRole('button', { name: 'Use UNIT-B5', exact: true }).click();
  await Promise.all([oldResponse, newProof]);
  await expect(page.getByLabel('Active fixture ID')).toHaveText('UNIT-B5');
  await expect(page.getByLabel('Fixture blade count')).toHaveText('5');
  await expect(page.getByLabel('Completed observations')).toHaveText('0');
});

// Blade-edge pattern safeguard

test('[F2P][D13] One blade repeated across the width with passing peers withholds both bedbar turns.', async ({ page }) => {
  await selectBlade(page, 1);
  for (const station of ['Drive end', 'Center', 'Non-drive end']) {
    await setOutcome(page, station, 'lengthwise', 'Light even drag');
  }
  await selectBlade(page, 4);
  for (const station of ['Drive end', 'Center', 'Non-drive end']) {
    await setOutcome(page, station, 'lengthwise', 'No drag');
  }
  await expect(page.getByLabel('Service hold status')).toContainText(/BLADE 4.*CHECK/i);
  await expect(page.getByLabel('Drive-end recommendation status')).toHaveText('WITHHOLD');
  await expect(page.getByLabel('Non-drive recommendation status')).toHaveText('WITHHOLD');
});

test('[F2P][D13] The same correction at one mark across several blades remains a bedbar result.', async ({ page }) => {
  for (const blade of [1, 2, 3]) {
    await selectBlade(page, blade);
    await setOutcome(page, 'Drive end', 'lengthwise', 'No drag');
  }
  await expect(page.getByLabel('Service hold status')).toHaveText('CLEAR');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
});

test('[F2P][D14] A right-drive fixture places its non-drive and drive adjusters on their physical screen sides.', async ({ page }) => {
  await useFixture(page, 'UNIT-B5');
  const labels = await page.getByLabel('Bedbar adjusters').getByRole('article')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  expect(labels).toEqual(['Non-drive adjuster', 'Drive-end adjuster']);
});

// Coupled bedbar movement

test('[F2P][D15] A center correction uses the smallest coupled whole-click pair.', async ({ page }) => {
  await setOutcome(page, 'Center', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Non-drive click count')).toHaveText('1');
});

test('[F2P][D15] Matching quarter-mark corrections avoid an unnecessary fourth click.', async ({ page }) => {
  await setOutcome(page, 'Drive quarter', 'lengthwise', 'No drag');
  await setOutcome(page, 'Non-drive quarter', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Non-drive click count')).toHaveText('1');
});

test('[F2P][D15] An infeasible center close and non-drive-end opening pair withholds both ends.', async ({ page }) => {
  await setOutcome(page, 'Center', 'lengthwise', 'No drag');
  await setOutcome(page, 'Non-drive end', 'lengthwise', 'Binding');
  await expect(page.getByLabel('Drive-end recommendation status')).toHaveText('WITHHOLD');
  await expect(page.getByLabel('Non-drive recommendation status')).toHaveText('WITHHOLD');
});

// Per-end pitches and reversal take-up

test('[F2P][D16] Unit C6 uses the non-drive pitch and reversal take-up posted for that end.', async ({ page }) => {
  await useFixture(page, 'UNIT-C6');
  await expect(page.getByLabel('Non-drive click pitch')).toContainText('0.020 mm');
  await expect(page.getByLabel('Non-drive click limit')).toHaveText('3 clicks');
  await setOutcome(page, 'Non-drive end', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Non-drive click count')).toHaveText('3');
  await expect(page.getByLabel('Non-drive movement')).toContainText('0.040 mm');
  await expect(page.getByLabel('Non-drive turn direction')).toHaveText('CCW');
});

test('[F2P][D17] Reversing the Unit C6 drive adjuster adds take-up without adding movement.', async ({ page }) => {
  await useFixture(page, 'UNIT-C6');
  await expect(page.getByLabel('Drive last approach', { exact: true })).toHaveText('CCW');
  await expect(page.getByLabel('Drive reversal take-up', { exact: true })).toHaveText('1 click');
  await setOutcome(page, 'Drive end', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('4');
  await expect(page.getByLabel('Drive-end movement')).toContainText('0.036 mm');
  await expect(page.getByLabel('Drive-end limit status')).toHaveText('LIMIT REACHED');
});

test('[F2P][D17] Continuing the Unit C6 drive approach needs no extra take-up click.', async ({ page }) => {
  await useFixture(page, 'UNIT-C6');
  await setOutcome(page, 'Drive end', 'lengthwise', 'Binding');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Drive-end movement')).toContainText('0.024 mm');
  await expect(page.getByLabel('Drive-end turn direction')).toHaveText('CCW');
});

test('[F2P][D17] Unit C6 center correction minimizes total handle clicks across unequal end pitches.', async ({ page }) => {
  await useFixture(page, 'UNIT-C6');
  await setOutcome(page, 'Center', 'lengthwise', 'No drag');
  await expect(page.getByLabel('Drive-end click count')).toHaveText('2');
  await expect(page.getByLabel('Non-drive click count')).toHaveText('3');
  await expect(page.getByLabel('Drive-end movement')).toContainText('0.012 mm');
  await expect(page.getByLabel('Non-drive movement')).toContainText('0.040 mm');
});

// Responsive work mat

test('[F2P][D11] All five paper stations remain horizontally contained at desktop, tablet, and phone widths.', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 760, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const boxes = await page.getByLabel('Five paper stations').getByRole('article')
      .evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, right: box.right, width: box.width };
      }));
    expect(boxes).toHaveLength(5);
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.width).toBeGreaterThan(120);
    }
  }
});

test('[F2P][D11] Live resize keeps blade, paper, free-spin, and release controls reachable without sideways overflow.', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectBlade(page, 7);
  await page.setViewportSize({ width: 390, height: 844 });
  const controls = [
    page.getByRole('button', { name: 'Blade 7', exact: true }),
    paperRadio(page, 'Non-drive end', 'upright', 'Clean cut'),
    page.getByRole('checkbox', { name: 'Full free-spin check', exact: true }),
    page.getByRole('button', { name: 'RELEASE CUTTING UNIT', exact: true }),
  ];
  for (const control of controls) {
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('[F2P][D12] Narrow adjusters do not cover a paper swatch or the release apron.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const swatches = await page.getByLabel('Five paper stations').getByRole('article').all();
  const adjusters = [
    await page.getByRole('article', { name: 'Drive-end adjuster', exact: true }).boundingBox(),
    await page.getByRole('article', { name: 'Non-drive adjuster', exact: true }).boundingBox(),
  ];
  const release = await page.getByLabel('Release controls').boundingBox();
  for (const adjuster of adjusters) {
    expect(adjuster.x).toBeGreaterThanOrEqual(0);
    expect(adjuster.x + adjuster.width).toBeLessThanOrEqual(390.5);
    expect(overlaps(adjuster, release)).toBe(false);
    for (const swatch of swatches) {
      expect(overlaps(adjuster, await swatch.boundingBox())).toBe(false);
    }
  }
});
