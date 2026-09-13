const { test, expect } = require('@playwright/test');
const fs = require('fs');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';
const FIXTURE_PATH = process.env.FIXTURE_PATH || '/logs/verifier/fixture.json';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

async function seedCase(request, caseName) {
  const study = fixture().cases[caseName];
  expect(study, `the ${caseName} verifier fixture should exist`).toBeTruthy();
  const response = await request.post(`${BACKEND}/api/test/reset`, {
    data: { study }
  });
  expect(response.ok(), `the ${caseName} field fixture should load`).toBeTruthy();
}

async function openStudy(page) {
  await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Willow Bend/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anchor A1', exact: true })).toBeVisible();
}

async function analyze(page) {
  const response = page.waitForResponse((item) => (
    item.url().endsWith('/api/analyze') && item.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: 'Analyze current reach', exact: true }).click();
  await response;
  await expect(page.getByRole('button', { name: 'Analyze current reach', exact: true })).toBeEnabled();
}

async function openCase(page, request, caseName) {
  await seedCase(request, caseName);
  await openStudy(page);
  await analyze(page);
}

async function selectAnchor(page, anchorId) {
  await page.getByLabel('Selected anchor', { exact: true }).selectOption(anchorId);
  await expect(page.getByRole('heading', { name: `Anchor ${anchorId}`, exact: true })).toBeVisible();
}

async function tagMetric(page, label) {
  const labels = {
    'BED ELEVATION': 'Selected bed elevation',
    'EST. WATER CONTACT': 'Estimated water contact',
    'PAIR STATUS': 'Selected pair eligibility',
    'COARSE − FINE': 'Selected pair contrast'
  };
  return (await page.getByLabel(labels[label], { exact: true }).textContent()).trim();
}

async function selectedBagDetails(page, mesh) {
  const prefix = mesh === 'coarse' ? 'Coarse' : 'Fine';
  return {
    loss: (await page.getByLabel(`${prefix} proportional mass loss`, { exact: true }).textContent()).trim(),
    detail: (
      await page.getByLabel(new RegExp(`^${prefix} (?:normalization|AFDM)`, 'i')).textContent()
    ).trim()
  };
}

async function normalizationNumbers(page, mesh) {
  const detail = (await selectedBagDetails(page, mesh)).detail;
  return (detail.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}

function includesNumber(values, expected) {
  return values.some((value) => Math.abs(value - expected) < 0.001);
}

async function reachSummary(page) {
  return {
    mean: (await page.getByLabel('Reach mean contrast', { exact: true }).textContent()).trim(),
    n: (await page.getByLabel('Eligible anchor count', { exact: true }).textContent()).trim()
  };
}

async function bounds(locator) {
  const box = await locator.boundingBox();
  expect(box, 'the spatial field element should have measurable bounds').not.toBeNull();
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height
  };
}

function overlaps(left, right) {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

function center(box) {
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2
  };
}

test.beforeEach(async ({ request }) => {
  await seedCase(request, 'baseline');
});

test('[F2P][D1] Signed datum offsets are added before stage levels are compared with anchor thresholds.', async ({ page, request }) => {
  await openCase(page, request, 'datum-offset');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe('120.0 min estimated');
});

test('[F2P][D1] Conflicting duplicate stage timestamps make water-contact estimates indeterminate.', async ({ page, request }) => {
  await openCase(page, request, 'duplicate-conflict');

  await expect(page.getByLabel('Stage quality result', { exact: true })).toContainText(/Indeterminate/);
  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe('Indeterminate');
});

test('[F2P][D1] A stage segment exactly equal to the posted gap limit remains usable.', async ({ page, request }) => {
  await openCase(page, request, 'gap-equality');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe('60.0 min estimated');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[F2P][D2] A threshold crossing contributes the interpolated wet fraction of its stage segment.', async ({ page, request }) => {
  await openCase(page, request, 'crossing');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe(
    `${fixture().expected.crossingWetMinutes.toFixed(1)} min estimated`
  );
});

test('[F2P][D2] Water contact is clipped to the half-open deployment and retrieval window.', async ({ page, request }) => {
  await openCase(page, request, 'window-clip');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe(
    `${fixture().expected.clippedWetMinutes.toFixed(1)} min estimated`
  );
});

test('[F2P][D2] Missing stage coverage at either deployment boundary stays indeterminate without extrapolation.', async ({ page, request }) => {
  await openCase(page, request, 'no-bracket');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe('Indeterminate');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
});

test('[F2P][D2] Interpolated wet durations are summed before the displayed estimate is rounded.', async ({ page, request }) => {
  await openCase(page, request, 'sum-round');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe(
    `${fixture().expected.roundedWetMinutes.toFixed(1)} min estimated`
  );
});

test('[F2P][D3] Recovered AFDM subtracts both dry tare and ash tare from their respective gross masses.', async ({ page, request }) => {
  await openCase(page, request, 'tare-ash');
  const coarse = await selectedBagDetails(page, 'coarse');

  expect(includesNumber(await normalizationNumbers(page, 'coarse'), 5)).toBe(true);
  expect(coarse.loss).toBe('37.5%');
});

test('[F2P][D3] Ash mass above corrected dry mass makes the recovery unavailable instead of clamping it.', async ({ page, request }) => {
  await openCase(page, request, 'ash-exceeds');

  expect((await selectedBagDetails(page, 'coarse')).detail).toContain('AFDM unavailable');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
});

test('[F2P][D3] A nonpositive corrected initial AFDM cannot produce a proportional mass loss.', async ({ page, request }) => {
  await openCase(page, request, 'nonpositive-initial');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('Unavailable');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
});

test('[F2P][D4] Control normalization never falls back to a different handling cohort.', async ({ page, request }) => {
  await openCase(page, request, 'cohort-key');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('50.0%');
});

test('[F2P][D4] Control normalization never falls back to a different field batch.', async ({ page, request }) => {
  await openCase(page, request, 'batch-key');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('50.0%');
});

test('[F2P][D4] Coarse and fine bags use controls with the same mesh category.', async ({ page, request }) => {
  await openCase(page, request, 'mesh-key');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('50.0%');
});

test('[F2P][D4] Multiple matching controls are normalized as the mean of individual recovery ratios.', async ({ page, request }) => {
  await openCase(page, request, 'mean-ratios');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('42.9%');
});

test('[F2P][D5] A disturbed bag remains visible but its anchor leaves inferential summaries.', async ({ page, request }) => {
  await openCase(page, request, 'disturbed');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
  expect((await reachSummary(page)).n).toBe('2');
});

test('[F2P][D5] A lost bag is unavailable rather than a zero-mass observation.', async ({ page, request }) => {
  await openCase(page, request, 'lost');

  expect((await selectedBagDetails(page, 'coarse')).detail).toContain('AFDM unavailable');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
});

test('[F2P][D5] A missing exact control makes the affected bag and pair ineligible.', async ({ page, request }) => {
  await openCase(page, request, 'missing-control');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
  expect((await reachSummary(page)).mean).toBe('Unavailable');
});

test('[F2P][D6] Coarse and fine mates pair by stable replicate identity rather than display order.', async ({ page, request }) => {
  await openCase(page, request, 'reordered-bags');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
  expect(await tagMetric(page, 'COARSE − FINE')).toBe('20.0%');
});

test('[F2P][D6] Pair elevations compare at the posted study precision rather than raw floating point.', async ({ page, request }) => {
  await openCase(page, request, 'elevation-precision');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[F2P][D6] Equivalent deployment windows pair after timezone normalization.', async ({ page, request }) => {
  await openCase(page, request, 'timezone-window');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[F2P][D6] Pair members with different stable study identities remain incompatible.', async ({ page, request }) => {
  await openCase(page, request, 'pair-mismatch');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
  expect((await reachSummary(page)).n).toBe('2');
});

test('[F2P][D6] A missing mate excludes only that anchor without corrupting neighboring pairs.', async ({ page, request }) => {
  await openCase(page, request, 'missing-mate');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
  expect((await reachSummary(page)).n).toBe('2');
});

test('[F2P][D7] Reach contrast is the equal-weight mean of eligible anchor contrasts.', async ({ page, request }) => {
  await openCase(page, request, 'equal-weight');

  expect((await reachSummary(page)).mean).toBe('10.0%');
});

test('[F2P][D7] Reach sample size counts eligible anchors rather than individual bags.', async ({ page, request }) => {
  await openCase(page, request, 'equal-weight');

  expect((await reachSummary(page)).n).toBe('2');
});

test('[F2P][D7] A negative coarse-minus-fine contrast remains visible without clamping.', async ({ page, request }) => {
  await openCase(page, request, 'negative');

  expect((await reachSummary(page)).mean).toBe('-30.0%');
  expect(await tagMetric(page, 'COARSE − FINE')).toBe('-30.0%');
});

test('[F2P][D8] Filtering out the selected anchor clears selection instead of transferring it.', async ({ page, request }) => {
  await openCase(page, request, 'disturbed');
  await page.getByLabel('Visible anchors', { exact: true }).selectOption('eligible');

  await expect(page.getByLabel('Selected anchor', { exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'No anchor selected', exact: true })).toBeVisible();
});

test('[F2P][D8] Filtering retains the same selected anchor when that stable identity remains visible.', async ({ page, request }) => {
  await openCase(page, request, 'filter-keep');
  await selectAnchor(page, 'A2');
  await page.getByLabel('Visible anchors', { exact: true }).selectOption('intact');

  await expect(page.getByLabel('Selected anchor', { exact: true })).toHaveValue('A2');
  await expect(page.getByRole('heading', { name: 'Anchor A2', exact: true })).toBeVisible();
});

test('[F2P][D10] A stage gap wholly before deployment does not invalidate complete in-window coverage.', async ({ page, request }) => {
  await openCase(page, request, 'pre-gap-outside');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe('120.0 min estimated');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[F2P][D10] An invalid observation outside deployment does not block in-window interpolation.', async ({ page, request }) => {
  await openCase(page, request, 'invalid-outside');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe('30.0 min estimated');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[F2P][D10] An invalid observation inside deployment prevents interpolation across that break.', async ({ page, request }) => {
  await openCase(page, request, 'invalid-inside');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe('Indeterminate');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
});

test('[F2P][D10] An over-limit stage gap inside deployment makes that anchor estimate ineligible.', async ({ page, request }) => {
  await openCase(page, request, 'gap-inside');

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe('Indeterminate');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
});

test('[F2P][D11] An unusable matching control is excluded while another exact control remains usable.', async ({ page, request }) => {
  await openCase(page, request, 'invalid-control');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('50.0%');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[F2P][D12] Repeated records for one control identity contribute that control only once.', async ({ page, request }) => {
  await openCase(page, request, 'duplicate-control');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('42.9%');
});

test('[F2P][D12] Conflicting records for one control identity do not poison another valid control.', async ({ page, request }) => {
  await openCase(page, request, 'conflicting-control');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('50.0%');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[F2P][D12] A control identity that conflicts outside the bag key is unusable before matching.', async ({ page, request }) => {
  await openCase(page, request, 'cross-key-conflict');

  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('55.6%');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[F2P][D13] Coarse and fine records with the same bag identity cannot form a pair.', async ({ page, request }) => {
  await openCase(page, request, 'same-bag-id');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
  expect((await reachSummary(page)).n).toBe('2');
});

test('[F2P][D13] One replicate identity cannot contribute from two spatial anchors.', async ({ page, request }) => {
  await openCase(page, request, 'replicate-reused');

  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Ineligible pair');
  expect((await reachSummary(page)).n).toBe('1');
});

test('[F2P][D14] A lost bag cannot expose stale recovery as measured AFDM or proportional loss.', async ({ page, request }) => {
  await openCase(page, request, 'lost-stale');

  const coarse = await selectedBagDetails(page, 'coarse');
  expect(coarse.loss).toBe('Unavailable');
  expect(coarse.detail).toContain('AFDM unavailable');
  expect((await reachSummary(page)).n).toBe('2');
});

test('[F2P][D15] Reanalysis clears a filtered-out selection without reviving it when the filter widens.', async ({ page }) => {
  await openStudy(page);
  await page.getByLabel('Visible anchors', { exact: true }).selectOption('eligible');
  await page.getByLabel('Disposition', { exact: true }).selectOption('disturbed');
  await analyze(page);
  await expect(page.getByLabel('Selected anchor', { exact: true })).toHaveValue('');
  await page.getByLabel('Visible anchors', { exact: true }).selectOption('all');

  await expect(page.getByLabel('Selected anchor', { exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'No anchor selected', exact: true })).toBeVisible();
});

test('[F2P][D16] Each visible bag exposes the normalization values used for its proportional loss.', async ({ page }) => {
  await openStudy(page);

  const coarseNumbers = await normalizationNumbers(page, 'coarse');
  const fineNumbers = await normalizationNumbers(page, 'fine');
  expect(includesNumber(coarseNumbers, 4) && includesNumber(coarseNumbers, 8)).toBe(true);
  expect(includesNumber(fineNumbers, 5.6) && includesNumber(fineNumbers, 8)).toBe(true);
  expect(
    (includesNumber(coarseNumbers, 0.8) || includesNumber(coarseNumbers, 80))
    && (includesNumber(fineNumbers, 0.8) || includesNumber(fineNumbers, 80))
  ).toBe(true);
  expect((await selectedBagDetails(page, 'coarse')).loss).toBe('50.0%');
  expect((await selectedBagDetails(page, 'fine')).loss).toBe('30.0%');
});

test('[F2P][D9] The desktop recovery tag and laboratory controls remain outside the spatial channel map.', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStudy(page);
  const channel = await bounds(page.getByLabel('Spatial channel recovery map'));
  const tag = await bounds(page.getByLabel('Selected anchor recovery tag'));
  const controls = await bounds(page.getByLabel('Selected bag laboratory values'));

  expect(overlaps(channel, tag)).toBe(false);
  expect(overlaps(channel, controls)).toBe(false);
});

test('[F2P][D9] At tablet width the filter shoal does not cover the downstream anchor glyph.', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await openStudy(page);
  const filter = await bounds(page.getByLabel('Anchor visibility filter'));
  const glyph = await bounds(page.getByRole('img', { name: 'Anchor A3 spatial glyph' }));

  expect(overlaps(filter, glyph)).toBe(false);
});

test('[F2P][D9] The phone-width field sheet has no page-level horizontal overflow or clipped analysis action.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openStudy(page);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const analyzeBounds = await bounds(page.getByRole('button', { name: 'Analyze current reach' }));

  expect(scrollWidth).toBeLessThanOrEqual(390);
  expect(analyzeBounds.left).toBeGreaterThanOrEqual(0);
  expect(analyzeBounds.right).toBeLessThanOrEqual(390);
});

test('[F2P][D9] Anchor hit targets realign with their spatial glyphs after live resize.', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStudy(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const glyphCenter = center(await bounds(page.getByRole('img', { name: 'Anchor A2 spatial glyph' })));
  const target = page.getByRole('button', { name: 'Select anchor A2' });
  const targetCenter = center(await bounds(target));

  expect(Math.abs(glyphCenter.x - targetCenter.x)).toBeLessThanOrEqual(25);
  expect(Math.abs(glyphCenter.y - targetCenter.y)).toBeLessThanOrEqual(32);
  await target.click();
  await expect(page.getByRole('heading', { name: 'Anchor A2', exact: true })).toBeVisible();
});

test('[P2P] The baseline anchor analysis remains eligible with its complete estimated exposure.', async ({ page }) => {
  await openStudy(page);
  await analyze(page);

  expect(await tagMetric(page, 'EST. WATER CONTACT')).toBe(
    `${fixture().expected.baselineWetMinutes.toFixed(1)} min estimated`
  );
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[P2P] A zero coarse-minus-fine contrast remains a valid visible result.', async ({ page }) => {
  await openStudy(page);
  await selectAnchor(page, 'A3');

  expect(await tagMetric(page, 'COARSE − FINE')).toBe('0.0%');
  expect(await tagMetric(page, 'PAIR STATUS')).toBe('Eligible pair');
});

test('[P2P] Visibility filtering does not change the reach summary membership.', async ({ page }) => {
  await openStudy(page);
  const before = await reachSummary(page);
  await page.getByLabel('Visible anchors', { exact: true }).selectOption('eligible');
  const after = await reachSummary(page);

  expect(after).toEqual(before);
});

test('[P2P] Selecting a mapped anchor updates the semantic recovery tag.', async ({ page }) => {
  await openStudy(page);
  await selectAnchor(page, 'A2');

  expect(await tagMetric(page, 'BED ELEVATION')).toBe('0.90 m');
});

test('[P2P] Switching between coarse and fine bag tags preserves their own laboratory values.', async ({ page }) => {
  await openStudy(page);
  await page.getByLabel('Bag mesh', { exact: true }).selectOption('fine');

  await expect(page.getByLabel('Dry gross mass')).toHaveValue('6.8');
  await page.getByLabel('Bag mesh', { exact: true }).selectOption('coarse');
  await expect(page.getByLabel('Dry gross mass')).toHaveValue('5.2');
});

test('[P2P] The seeded spatial map exposes all fixed anchor selection controls.', async ({ page }) => {
  await openStudy(page);

  await expect(page.getByRole('button', { name: /^Select anchor A/ })).toHaveCount(3);
  await expect(page.getByRole('img', { name: /spatial glyph/ })).toHaveCount(3);
});
