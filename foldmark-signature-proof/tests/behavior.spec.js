const { test, expect } = require('@playwright/test');
const fs = require('fs');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';
const FIXTURE_PATH = process.env.FIXTURE_PATH || '/logs/verifier/fixture.json';

function readFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

async function resetJob(request) {
  const response = await request.post(`${BACKEND}/api/test/reset`);
  expect(response.ok(), 'the sample print job should reset before each scenario').toBeTruthy();
}

async function openJob(page) {
  await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Atlas Field Guide/ })).toBeVisible();
  await expect(proofSeal(page)).not.toHaveText('—');
}

function proofSeal(page) {
  return page.getByLabel('Proof seal').locator('strong');
}

function revisionBadge(page) {
  return page.getByLabel('Current revision').locator('strong');
}

async function metricText(page, termName) {
  const term = page
    .getByLabel('Current proof geometry')
    .getByText(termName, { exact: true });
  return (await term.locator('xpath=following-sibling::dd[1]').textContent()).trim();
}

async function surfacePages(page, side, sheetNumber) {
  const surface = page.getByRole('article', {
    name: `${side} sheet ${sheetNumber}`,
    exact: true
  });
  await expect(surface).toBeVisible();
  const labels = await surface.getByRole('group').evaluateAll((groups) => (
    groups.map((group) => group.getAttribute('aria-label') || '')
  ));
  return labels.map((label) => {
    const match = label.match(/page (\d+)|blank/i);
    return match && match[1] ? Number(match[1]) : null;
  });
}

async function regenerate(page) {
  const response = page.waitForResponse((item) => (
    item.url().includes(`/api/jobs/atlas-field-guide/preview`)
    && item.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: 'Regenerate proof', exact: true }).click();
  await response;
  await expect(page.getByRole('button', { name: 'Regenerate proof', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Save revision', exact: true })).toBeEnabled();
}

async function setSelect(page, label, value) {
  await page.getByLabel(label).selectOption(value);
}

async function setBleed(page, value) {
  await page.getByLabel('Bleed (mm)').fill(String(value));
}

async function optionValueContaining(select, phrase) {
  return select.locator('option').evaluateAll((options, text) => {
    const found = options.find((option) => option.textContent.includes(text));
    return found ? found.value : null;
  }, phrase);
}

async function chooseAssignmentSlots(page, firstPhrase, secondPhrase) {
  const first = page.getByLabel('First physical slot');
  const second = page.getByLabel('Second physical slot');
  const firstValue = await optionValueContaining(first, firstPhrase);
  const secondValue = await optionValueContaining(second, secondPhrase);
  expect(firstValue, `a physical slot containing "${firstPhrase}" should be available`).toBeTruthy();
  expect(secondValue, `a physical slot containing "${secondPhrase}" should be available`).toBeTruthy();
  await first.selectOption(firstValue);
  await second.selectOption(secondValue);
}

async function swapSelectedPages(page) {
  const response = page.waitForResponse((item) => (
    item.url().includes(`/api/jobs/atlas-field-guide/preview`)
    && item.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: 'Swap pages', exact: true }).click();
  await response;
  await expect(page.getByRole('button', { name: 'Regenerate proof', exact: true })).toBeEnabled();
}

async function clearSelectedSlot(page) {
  const response = page.waitForResponse((item) => (
    item.url().includes(`/api/jobs/atlas-field-guide/preview`)
    && item.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: 'Leave first slot blank', exact: true }).click();
  await response;
  await expect(page.getByText(/Signature is incomplete/)).toBeVisible();
}

async function saveRevision(page) {
  const responsePromise = page.waitForResponse((item) => (
    item.url().endsWith(`/api/jobs/atlas-field-guide`)
    && item.request().method() === 'PUT'
  ));
  await page.getByRole('button', { name: 'Save revision', exact: true }).click();
  return responsePromise;
}

async function reopenJob(page) {
  const response = page.waitForResponse((item) => (
    item.url().endsWith(`/api/jobs/atlas-field-guide`)
    && item.request().method() === 'GET'
  ));
  await page.getByRole('button', { name: 'Reopen saved job', exact: true }).click();
  await response;
  await expect(page.getByText(/Reopened saved revision/)).toBeVisible();
}

async function releaseProof(page) {
  const response = page.waitForResponse((item) => (
    item.url().endsWith(`/api/jobs/atlas-field-guide/release`)
    && item.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: 'Release for production', exact: true }).click();
  return response;
}

async function goToSheet(page, zeroBasedIndex) {
  for (let index = 0; index < zeroBasedIndex; index += 1) {
    const next = page.getByRole('button', { name: 'Next sheet', exact: true });
    await next.focus();
    await next.press('Enter');
  }
}

async function proofDiagnostic(page) {
  const heading = (await page.getByRole('heading', { name: /Signature \d+ · Sheet \d+/ }).textContent()).trim();
  const front = await surfacePages(page, 'Front', Number(heading.match(/Sheet (\d+)/)[1]));
  const back = await surfacePages(page, 'Back', Number(heading.match(/Sheet (\d+)/)[1]));
  return {
    heading,
    front,
    back,
    sheet: await metricText(page, 'Sheet'),
    duplex: await metricText(page, 'Duplex turn'),
    bleed: await metricText(page, 'Bleed boundary'),
    fold: await metricText(page, 'Fold positions'),
    seal: (await proofSeal(page).textContent()).trim()
  };
}

async function operationLabels(page) {
  const entries = await page.getByLabel('Revision ledger').getByRole('listitem').allTextContents();
  return entries.map((entry) => entry.replace(/cycle\s+\d+\s+·\s+\d+$/i, '').trim());
}

async function bounds(locator) {
  const box = await locator.boundingBox();
  expect(box, 'the visible element should have measurable bounds').not.toBeNull();
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

test.beforeEach(async ({ request }) => {
  await resetJob(request);
});

test('[F2P][D1] An eight-page saddle signature places the outer and opening pages in their physical front positions.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Page count', '8');
  await regenerate(page);

  expect(await surfacePages(page, 'Front', 1)).toEqual([8, 1]);
});

test('[F2P][D1] A larger saddle signature preserves physical ordering on an inner sheet.', async ({ page }) => {
  await openJob(page);
  await goToSheet(page, 1);

  expect(await surfacePages(page, 'Front', 2)).toEqual([14, 3]);
});

test('[F2P][D1] Section-sewn binding restarts imposition within each physical signature.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Binding', 'section-sewn');
  await regenerate(page);
  await goToSheet(page, 2);

  await expect(page.getByRole('heading', { name: 'Signature 2 · Sheet 1', exact: true })).toBeVisible();
  expect(await surfacePages(page, 'Front', 1)).toEqual([16, 9]);
});

test('[F2P][D2] The back of a duplex sheet maps to the matching physical positions on its front.', async ({ page }) => {
  await openJob(page);

  expect(await surfacePages(page, 'Back', 1)).toEqual([2, 15]);
});

test('[F2P][D2] Back-side physical positions remain correct after their pages are reassigned.', async ({ page }) => {
  await openJob(page);
  await chooseAssignmentSlots(page, 'Back left', 'Back right');
  await swapSelectedPages(page);

  expect(await surfacePages(page, 'Back', 1)).toEqual([15, 2]);
});

test('[F2P][D2] Portrait stock changes the duplex turn used by the displayed proof.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Orientation', 'portrait');
  await regenerate(page);

  expect((await metricText(page, 'Duplex turn')).toLowerCase()).toBe('short edge');
});

test('[F2P][D3] Increasing bleed regenerates every displayed proof boundary.', async ({ page }) => {
  const fixture = readFixture();
  await openJob(page);
  await setBleed(page, fixture.bleedIncrease);
  await regenerate(page);

  expect(Number.parseFloat(await metricText(page, 'Bleed boundary'))).toBe(fixture.bleedIncrease);
  await expect(page.getByLabel(`Bleed boundary ${fixture.bleedIncrease} mm`).first()).toBeVisible();
});

test('[F2P][D3] Decreasing bleed restores the matching physical boundary.', async ({ page }) => {
  const fixture = readFixture();
  await openJob(page);
  await setBleed(page, fixture.bleedDecrease);
  await regenerate(page);

  expect(Number.parseFloat(await metricText(page, 'Bleed boundary'))).toBe(fixture.bleedDecrease);
});

test('[F2P][D3] A larger bleed value visibly expands the page boundary rather than only changing the control.', async ({ page }) => {
  await openJob(page);
  const before = await bounds(page.getByLabel('Bleed boundary 3 mm').first());
  await setBleed(page, 7);
  await regenerate(page);
  const after = await bounds(page.getByLabel('Bleed boundary 7 mm').first());

  expect(after.width).toBeGreaterThan(before.width + 2);
  expect(after.height).toBeGreaterThan(before.height + 2);
});

test('[F2P][D4] Parallel folding replaces the center guide with both physical fold positions.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Fold plan', 'parallel');
  await regenerate(page);

  const guides = page.getByRole('article', { name: 'Front sheet 1' }).getByRole('img', { name: /^Fold guide/ });
  await expect(guides).toHaveCount(2);
  expect(await metricText(page, 'Fold positions')).toContain('112.5 mm');
  expect(await metricText(page, 'Fold positions')).toContain('337.5 mm');
});

test('[F2P][D4] Reassigning pages leaves cut guides anchored to the physical sheet.', async ({ page }) => {
  await openJob(page);
  const guides = page.getByRole('article', { name: 'Front sheet 1' }).getByRole('img', { name: /^Cut guide/ });
  const before = await guides.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().x));
  await chooseAssignmentSlots(page, 'Front left', 'Front right');
  await swapSelectedPages(page);
  const after = await guides.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().x));

  expect(after.map((value, index) => Number((value - before[index]).toFixed(1)))).toEqual([0, 0]);
});

test('[F2P][D4] Changing paper dimensions recalculates fold and cut positions for that sheet.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Paper', 'A3');
  await regenerate(page);

  expect(await metricText(page, 'Fold positions')).toBe('210 mm');
  const cutLabels = await page
    .getByRole('article', { name: 'Front sheet 1' })
    .getByRole('img', { name: /^Cut guide/ })
    .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
  expect(cutLabels).toEqual(['Cut guide at 18 mm', 'Cut guide at 402 mm']);
});

test('[F2P][D5] A reassigned proof reopens with the same physical positions that were saved.', async ({ page }) => {
  await openJob(page);
  await chooseAssignmentSlots(page, 'Front left', 'Front right');
  await swapSelectedPages(page);
  const shownBeforeSave = await proofDiagnostic(page);
  await saveRevision(page);
  await expect(revisionBadge(page)).toHaveText('R13');
  await reopenJob(page);

  expect(await proofDiagnostic(page)).toEqual(shownBeforeSave);
});

test('[F2P][D5] A saved orientation reopens with the identical proof geometry and duplex state.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Orientation', 'portrait');
  await regenerate(page);
  const shownBeforeSave = await proofDiagnostic(page);
  await saveRevision(page);
  await reopenJob(page);

  expect(await proofDiagnostic(page)).toEqual(shownBeforeSave);
});

test('[F2P][D5] Interleaved setup and assignment edits save as one coherent proof snapshot.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Binding', 'section-sewn');
  await regenerate(page);
  await chooseAssignmentSlots(page, 'Front left', 'Front right');
  await swapSelectedPages(page);
  await setSelect(page, 'Fold plan', 'parallel');
  await setBleed(page, 5.5);
  await regenerate(page);
  const shownBeforeSave = await proofDiagnostic(page);
  await saveRevision(page);
  await reopenJob(page);

  expect(await proofDiagnostic(page)).toEqual(shownBeforeSave);
});

test('[F2P][D6] A stale editing session receives a visible revision conflict when it saves second.', async ({ page, context }) => {
  await openJob(page);
  const stalePage = await context.newPage();
  await openJob(stalePage);

  await setSelect(page, 'Paper', 'A3');
  await regenerate(page);
  expect((await saveRevision(page)).status()).toBe(200);

  await setBleed(stalePage, 6);
  await regenerate(stalePage);
  expect((await saveRevision(stalePage)).status()).toBe(409);
  await expect(stalePage.getByText(/Revision conflict/)).toBeVisible();
});

test('[F2P][D6] A rejected stale save cannot overwrite the newer saved proof.', async ({ page, context }) => {
  await openJob(page);
  const stalePage = await context.newPage();
  await openJob(stalePage);

  await setSelect(page, 'Paper', 'A3');
  await regenerate(page);
  await saveRevision(page);

  await setBleed(stalePage, 6.5);
  await regenerate(stalePage);
  await saveRevision(stalePage);
  await reopenJob(page);

  await expect(page.getByLabel('Paper')).toHaveValue('A3');
  expect(await metricText(page, 'Sheet')).toContain('A3');
});

test('[F2P][D7] An incomplete saved signature cannot remain eligible for production release.', async ({ page }) => {
  await openJob(page);
  await clearSelectedSlot(page);
  await saveRevision(page);

  await expect(page.getByText(/Signature is incomplete/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Release for production' })).toBeDisabled();
});

test('[F2P][D7] Releasing an unchanged valid proof records the current revision.', async ({ page }) => {
  await openJob(page);
  expect((await releaseProof(page)).status()).toBe(200);

  await expect(
    page.getByLabel('Validation and release').getByText('Released revision R12.', { exact: true })
  ).toBeVisible();
});

test('[F2P][D7] A newly saved valid proof releases its own revision rather than an earlier valid one.', async ({ page }) => {
  await openJob(page);
  await chooseAssignmentSlots(page, 'Front left', 'Front right');
  await swapSelectedPages(page);
  await saveRevision(page);
  await expect(revisionBadge(page)).toHaveText('R13');
  await releaseProof(page);

  await expect(
    page.getByLabel('Validation and release').getByText('Released revision R13.', { exact: true })
  ).toBeVisible();
});

test('[F2P][D7] An unsaved change immediately removes release eligibility from the displayed proof.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Orientation', 'portrait');

  await expect(page.getByRole('button', { name: 'Release for production' })).toBeDisabled();
  await expect(page.getByText('Regeneration required', { exact: true })).toBeVisible();
});

test('[F2P][D8] Edits in one proof cycle retain the order in which the operator applied them.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Paper', 'A3');
  await setBleed(page, 5);
  await setSelect(page, 'Fold plan', 'parallel');
  await regenerate(page);
  await saveRevision(page);

  expect((await operationLabels(page)).slice(-3)).toEqual([
    'Paper changed',
    'Bleed changed',
    'Fold plan changed'
  ]);
});

test('[F2P][D8] Same-cycle operation order remains stable after the revision is reopened.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Fold plan', 'parallel');
  await setBleed(page, 4.5);
  await setSelect(page, 'Paper', 'A3');
  await regenerate(page);
  await saveRevision(page);
  await reopenJob(page);

  expect((await operationLabels(page)).slice(-3)).toEqual([
    'Fold plan changed',
    'Bleed changed',
    'Paper changed'
  ]);
});

test('[F2P][D9] The desktop validation rail stays outside the physical proof stage.', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openJob(page);
  const workspace = await bounds(page.getByLabel('Signature proof workspace'));
  const rail = await bounds(page.getByLabel('Validation and release'));

  expect(overlaps(workspace, rail)).toBe(false);
  expect(rail.right).toBeLessThanOrEqual(1280);
});

test('[F2P][D9] Desktop production controls leave both physical sheet faces unobstructed.', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openJob(page);
  const rail = await bounds(page.getByLabel('Validation and release'));
  const front = await bounds(page.getByRole('article', { name: 'Front sheet 1' }));
  const back = await bounds(page.getByRole('article', { name: 'Back sheet 1' }));

  expect(overlaps(rail, front)).toBe(false);
  expect(overlaps(rail, back)).toBe(false);
});

test('[F2P][D9] The narrow workstation has no horizontal overflow or off-screen panels.', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await openJob(page);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const panels = await Promise.all([
    bounds(page.getByLabel('Proof controls')),
    bounds(page.getByLabel('Signature proof workspace')),
    bounds(page.getByLabel('Validation and release'))
  ]);

  expect(scrollWidth).toBeLessThanOrEqual(760);
  expect(panels.every((panel) => panel.left >= 0 && panel.right <= 760)).toBe(true);
});

test('[F2P][D9] Narrow proof labels, validation, and release controls remain unobstructed and reachable.', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await openJob(page);
  const rail = await bounds(page.getByLabel('Validation and release'));
  const front = await bounds(page.getByRole('article', { name: 'Front sheet 1' }));
  const back = await bounds(page.getByRole('article', { name: 'Back sheet 1' }));
  const status = await bounds(page.getByText('Production checks pass', { exact: true }));
  const release = await bounds(page.getByRole('button', { name: 'Release for production' }));

  expect(overlaps(rail, front)).toBe(false);
  expect(overlaps(rail, back)).toBe(false);
  expect(status.right).toBeLessThanOrEqual(760);
  expect(release.left).toBeGreaterThanOrEqual(0);
  expect(release.right).toBeLessThanOrEqual(760);
});

test('[P2P] The default sample print job opens with its saved revision and proof.', async ({ page }) => {
  await openJob(page);

  await expect(revisionBadge(page)).toHaveText('R12');
  await expect(page.getByRole('article', { name: 'Front sheet 1' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Back sheet 1' })).toBeVisible();
});

test('[P2P] Sheet navigation continues to display both surfaces of the selected sheet.', async ({ page }) => {
  await openJob(page);
  await goToSheet(page, 1);

  await expect(page.getByRole('heading', { name: 'Signature 1 · Sheet 2' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Front sheet 2' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Back sheet 2' })).toBeVisible();
});

test('[P2P] Saving an unchanged proof creates a new revision without changing its visible seal.', async ({ page }) => {
  await openJob(page);
  const seal = (await proofSeal(page).textContent()).trim();
  expect((await saveRevision(page)).status()).toBe(200);

  await expect(revisionBadge(page)).toHaveText('R13');
  await expect(proofSeal(page)).toHaveText(seal);
});

test('[P2P] The validation summary remains available for a complete sample signature.', async ({ page }) => {
  await openJob(page);

  await expect(page.getByText('Production checks pass', { exact: true })).toBeVisible();
  await expect(page.getByText('Physical slots are complete.', { exact: true })).toBeVisible();
});

test('[P2P] Switching to another supported paper size keeps both proof surfaces usable.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Paper', 'A3');
  await regenerate(page);

  await expect(page.getByRole('article', { name: 'Front sheet 1' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Back sheet 1' })).toBeVisible();
  expect(await metricText(page, 'Sheet')).toContain('A3');
});

test('[P2P] Swapping two occupied slots preserves a complete validation result.', async ({ page }) => {
  await openJob(page);
  const before = await surfacePages(page, 'Front', 1);
  await chooseAssignmentSlots(page, 'Front left', 'Front right');
  await swapSelectedPages(page);

  expect(await surfacePages(page, 'Front', 1)).toEqual([before[1], before[0]]);
  await expect(page.getByText('Production checks pass', { exact: true })).toBeVisible();
});

test('[P2P] Reopening an unchanged job preserves its revision and proof seal.', async ({ page }) => {
  await openJob(page);
  const seal = (await proofSeal(page).textContent()).trim();
  await reopenJob(page);

  await expect(revisionBadge(page)).toHaveText('R12');
  await expect(proofSeal(page)).toHaveText(seal);
});

test('[P2P] The eight-page configuration remains navigable as two physical sheets.', async ({ page }) => {
  await openJob(page);
  await setSelect(page, 'Page count', '8');
  await regenerate(page);

  await expect(page.getByLabel('Sheet navigation')).toContainText('1 / 2');
  await expect(page.getByRole('article', { name: 'Front sheet 1' }).getByRole('group')).toHaveCount(2);
  await goToSheet(page, 1);
  await expect(page.getByRole('article', { name: 'Front sheet 2' })).toBeVisible();
});
