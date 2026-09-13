const { test, expect } = require('@playwright/test');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

function numberFrom(text) {
  const match = String(text).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function numbersFrom(text) {
  return Array.from(String(text).matchAll(/-?\d+(?:\.\d+)?/g), (match) => Number(match[0]));
}

async function ready(page) {
  await expect(page.getByText('CHAIR-41', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Survey completion status')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
  await ready(page);
});

async function openRecord(page, id) {
  await page.getByRole('button', { name: `Open ${id}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Open ${id}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

async function selectCourse(page, id) {
  await page.getByRole('button', { name: `Select ${id}`, exact: true }).click();
  await expect(page.getByLabel('Selected course identity')).toBeVisible();
}

async function selectCoil(page, id) {
  await page.getByRole('button', { name: `Select coil ${id}`, exact: true }).click();
  await expect(page.getByLabel(`${id} restraint status`)).toBeVisible();
}

async function markSelected(page, state) {
  const name = state === 'affected' ? 'MARK COURSE AFFECTED' : 'MARK COURSE CLEAR';
  const before = await metric(page, 'Recorded update number');
  const button = page.getByRole('button', { name, exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => metric(page, 'Recorded update number')).toBe(before + 1);
}

async function propose(page, label) {
  const before = await metric(page, 'Recorded update number');
  const button = page.getByRole('button', { name: label, exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => metric(page, 'Recorded update number')).toBe(before + 1);
}

async function inspectContacts(page) {
  const before = await metric(page, 'Recorded update number');
  const button = page.getByRole('button', { name: 'RECORD ALL CONTACTS INSPECTED', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => metric(page, 'Recorded update number')).toBe(before + 1);
}

async function metric(page, label) {
  return numberFrom(await page.getByLabel(label, { exact: true }).innerText());
}

function tokenSet(text) {
  return new Set((String(text).toLowerCase().match(/[a-z]+/g) || []));
}

async function expectSemantic(locator, accepted, rejected = []) {
  await expect.poll(async () => {
    const tokens = tokenSet(await locator.innerText());
    return accepted.some((word) => tokens.has(word))
      && rejected.every((word) => !tokens.has(word));
  }).toBe(true);
}

async function expectReviewRequired(page) {
  await expectSemantic(
    page.getByLabel('Conservator review status'),
    ['required', 'needed', 'yes', 'review'],
    ['not', 'no', 'none', 'optional'],
  );
}

function overlaps(first, second) {
  return !(first.x + first.width <= second.x || second.x + second.width <= first.x
    || first.y + first.height <= second.y || second.y + second.height <= first.y);
}

// Stable documentation surface

test('[P2P] The survey opens with record tags, an underside view, course controls, and documentation summary.', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Underside records' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Underside spring record' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Recorded cord courses' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Survey summary' })).toBeVisible();
});

test('[P2P] All three deterministic underside records are available.', async ({ page }) => {
  for (const id of ['CHAIR-41', 'SETTEE-08', 'CHAIR-63']) {
    await expect(page.getByRole('button', { name: `Open ${id}`, exact: true })).toBeVisible();
  }
});

test('[P2P] The active record visibly posts its front and chair-left orientation.', async ({ page }) => {
  await expect(page.getByLabel('Recorded front edge')).toContainText('south');
  await expect(page.getByLabel('Recorded chair-left edge')).toContainText('east');
});

test('[P2P] The primary underside exposes twelve cord courses and its sound-webbing coils.', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Recorded cord courses' }).getByRole('button')).toHaveCount(12);
  for (const id of ['C1', 'C3']) {
    await expect(page.getByRole('button', { name: `Select coil ${id}`, exact: true })).toBeVisible();
  }
});

test('[P2P] An exact spring profile remains a documented match alongside separate survey and review states.', async ({ page }) => {
  await expect(page.getByText('PRE-TREATMENT DOCUMENTATION', { exact: true })).toBeVisible();
  await selectCoil(page, 'C1');
  await propose(page, 'Profile A');
  const profile = page.getByLabel('C1 replacement profile status');
  await expectSemantic(profile, ['match', 'compatible', 'consistent'], ['mismatch', 'review', 'different', 'not']);
  await expectSemantic(page.getByLabel('C1 restraint status'), ['complete', 'mapped'], ['incomplete', 'unmapped', 'open', 'missing', 'not']);
  const axes = (await page.getByLabel('C1 axis families').innerText()).toLowerCase();
  for (const axis of ['crosswise', 'lengthwise', 'falling', 'rising']) expect(axes).toContain(axis);
  await expect(page.getByLabel('Survey completion status')).toBeVisible();
  await expect(page.getByLabel('Conservator review status')).toBeVisible();
});

// Evidence decoding

test('[F2P][D1] False and zero-valued findings remain present in the record register.', async ({ page }) => {
  const register = await page.getByLabel('Finding register').innerText();
  expect(await metric(page, 'Recorded finding count')).toBe(2);
  const normalized = register.replace(/\s+/g, ' ');
  for (const id of ['R-H1', 'R-V1']) {
    expect(normalized).toMatch(new RegExp(`\\b${id}\\b\\s+\\bclear\\b`, 'i'));
  }
});

// Record-driven orientation

test('[F2P][D2] Chair 41 mirrors its east chair-left anchor onto the left side of the underside view.', async ({ page }) => {
  const east = await page.getByText('A-E1', { exact: true }).boundingBox();
  const west = await page.getByText('A-W1', { exact: true }).boundingBox();
  expect(east.x).toBeLessThan(west.x);
});

test('[F2P][D2] Chair 63 and Settee 08 follow their posted non-south orientations.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  const north = await page.getByText('K-N', { exact: true }).boundingBox();
  const south = await page.getByText('K-S', { exact: true }).boundingBox();
  expect(north.x).toBeLessThan(south.x);
  await openRecord(page, 'SETTEE-08');
  const front = await page.getByText('B-N', { exact: true }).boundingBox();
  const back = await page.getByText('B-S', { exact: true }).boundingBox();
  const chairLeft = await page.getByText('B-W', { exact: true }).boundingBox();
  const chairRight = await page.getByText('B-E', { exact: true }).boundingBox();
  expect(front.y).toBeGreaterThan(back.y);
  expect(chairLeft.x).toBeLessThan(chairRight.x);
});

// Replacement-profile comparison

test('[F2P][D3] A profile with only the wrong wire gauge requires review.', async ({ page }) => {
  await selectCoil(page, 'C1');
  await propose(page, 'Gauge comparison');
  await expectSemantic(page.getByLabel('C1 replacement profile status'), ['review', 'mismatch', 'different'], ['match', 'compatible', 'not', 'no']);
  await expectReviewRequired(page);
});

test('[F2P][D3] A matching height and turn count still flags the wrong top diameter.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await selectCoil(page, 'K1');
  await propose(page, 'Narrow profile');
  await expectSemantic(page.getByLabel('K1 replacement profile status'), ['review', 'mismatch', 'different'], ['match', 'compatible', 'not', 'no']);
  await expectReviewRequired(page);
});

test('[F2P][D3] A profile differing only in turn count requires review.', async ({ page }) => {
  await selectCoil(page, 'C1');
  await propose(page, 'Turn-count comparison');
  await expectSemantic(page.getByLabel('C1 replacement profile status'), ['review', 'mismatch', 'different'], ['match', 'compatible', 'not', 'no']);
  await expectReviewRequired(page);
});

test('[F2P][D3] A profile differing only in bottom diameter requires review.', async ({ page }) => {
  await selectCoil(page, 'C1');
  await propose(page, 'Bottom-diameter comparison');
  await expectSemantic(page.getByLabel('C1 replacement profile status'), ['review', 'mismatch', 'different'], ['match', 'compatible', 'not', 'no']);
  await expectReviewRequired(page);
});

// Failed webbing remains reviewable

test('[F2P][D4] Failed webbing remains attached to its coils and requires conservator review.', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Select coil C2', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select coil C4', exact: true })).toBeVisible();
  await selectCoil(page, 'C2');
  await expectSemantic(page.getByLabel('C2 webbing status'), ['failed', 'unsound'], ['sound', 'clear', 'not']);
  await expectSemantic(page.getByLabel('Survey completion status'), ['complete'], ['incomplete', 'open', 'missing', 'not']);
  await expectReviewRequired(page);
});

// Object-space axes

test('[F2P][D5] The skewed K-H course keeps its posted crosswise axis family.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await selectCourse(page, 'K-H');
  await expectSemantic(page.getByLabel('Selected course axis'), ['crosswise'], ['non', 'lengthwise', 'falling', 'rising']);
});

// Direction-independent course identity

test('[F2P][D6] Reversed storage leaves R-V2 identified as the same physical course.', async ({ page }) => {
  await selectCourse(page, 'R-V2');
  await expect(page.getByLabel('Selected course identity')).toContainText('R-V2');
});

// Crossing and lashing semantics

test('[F2P][D7] Free and lashed crossings preserve all twelve primary course identities.', async ({ page }) => {
  const visibleCourses = await page.getByRole('navigation', { name: 'Recorded cord courses' })
    .getByRole('button').count();
  expect(visibleCourses).toBeGreaterThan(0);
  expect(await metric(page, 'Independent topology group count')).toBe(visibleCourses);
});

test('[F2P][D7] The settee lashing preserves four independent physical courses.', async ({ page }) => {
  await openRecord(page, 'SETTEE-08');
  const visibleCourses = await page.getByRole('navigation', { name: 'Recorded cord courses' })
    .getByRole('button').count();
  expect(visibleCourses).toBeGreaterThan(0);
  expect(await metric(page, 'Independent topology group count')).toBe(visibleCourses);
});

// Physical continuation through crossings

test('[F2P][D8] Marking R-D1C does not mark the free-crossing R-D2B course.', async ({ page }) => {
  await selectCourse(page, 'R-D1C');
  await markSelected(page, 'affected');
  await selectCourse(page, 'R-D2B');
  await expectSemantic(page.getByLabel('Selected course finding'), ['clear', 'unaffected', 'sound'], ['unclear', 'affected', 'unsound', 'damaged', 'not']);
});

test('[F2P][D8] Marking R-D1D does not mark the separately identified lashed R-D2C course.', async ({ page }) => {
  await selectCourse(page, 'R-D1D');
  await markSelected(page, 'affected');
  await selectCourse(page, 'R-D2C');
  await expectSemantic(page.getByLabel('Selected course finding'), ['clear', 'unaffected', 'sound'], ['unclear', 'affected', 'unsound', 'damaged', 'not']);
});

// Polygon and shared anchors

test('[F2P][D9] Every primary course resolves both ends to observed frame stations.', async ({ page }) => {
  const visibleCourses = await page.getByRole('navigation', { name: 'Recorded cord courses' })
    .getByRole('button').count();
  expect(visibleCourses).toBeGreaterThan(0);
  expect(await metric(page, 'Anchored cord course count')).toBe(visibleCourses);
});

test('[F2P][D9] Chamfered stations anchor every visible Chair 63 course.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  const visibleCourses = await page.getByRole('navigation', { name: 'Recorded cord courses' })
    .getByRole('button').count();
  expect(visibleCourses).toBeGreaterThan(0);
  expect(await metric(page, 'Anchored cord course count')).toBe(visibleCourses);
});

// Four distinct axis pairs

test('[F2P][D10] Four contacts with a duplicated falling axis leave K1 incomplete.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await selectCoil(page, 'K1');
  await expectSemantic(page.getByLabel('K1 restraint status'), ['incomplete', 'open', 'missing'], ['complete', 'mapped', 'not']);
  const axes = (await page.getByLabel('K1 axis families').innerText()).toLowerCase();
  for (const axis of ['crosswise', 'lengthwise', 'falling']) expect(axes).toContain(axis);
  expect(axes).not.toContain('rising');
});

// Course-wide affected aggregation

test('[F2P][D11] An R-H1 finding follows the physical course after selecting away and back.', async ({ page }) => {
  await selectCourse(page, 'R-H1');
  await markSelected(page, 'affected');
  await selectCourse(page, 'R-V1');
  await selectCourse(page, 'R-H1');
  for (const label of [
    'Selected course finding',
    'Selected course start finding',
    'Selected course end finding',
  ]) {
    await expectSemantic(page.getByLabel(label), ['affected', 'damaged'], ['unaffected', 'clear', 'not']);
  }
});

// Replacement contact invalidation

test('[F2P][D12] A replacement proposal invalidates every previously inspected C1 contact.', async ({ page }) => {
  await selectCoil(page, 'C1');
  await inspectContacts(page);
  await expect.poll(async () => (
    numbersFrom(await page.getByLabel('C1 inspected contacts').innerText())
  )).toEqual([4, 4]);
  await propose(page, 'Profile A');
  await expect.poll(async () => (
    numbersFrom(await page.getByLabel('C1 inspected contacts').innerText())
  )).toEqual([0, 4]);
  await expect.poll(() => metric(page, 'C1 reinspection count')).toBe(4);
});

test('[F2P][D12] Proposing another C1 profile invalidates the contacts a second time.', async ({ page }) => {
  await selectCoil(page, 'C1');
  await propose(page, 'Profile A');
  await expect.poll(() => metric(page, 'C1 reinspection count')).toBe(4);
  await inspectContacts(page);
  await expect.poll(() => metric(page, 'C1 reinspection count')).toBe(0);
  await expect.poll(async () => (
    numbersFrom(await page.getByLabel('C1 inspected contacts').innerText())
  )).toEqual([4, 4]);
  await propose(page, 'Gauge comparison');
  await expect.poll(() => metric(page, 'C1 reinspection count')).toBe(4);
});

// Unique course count

test('[F2P][D13] The course summary counts physical runs rather than rendered spans.', async ({ page }) => {
  const visibleCourses = await page.getByRole('navigation', { name: 'Recorded cord courses' })
    .getByRole('button').count();
  expect(visibleCourses).toBeGreaterThan(0);
  expect(await metric(page, 'Unique cord course count')).toBe(visibleCourses);
});

// Fixture-specific front evidence

test('[F2P][D14] The settee uses its recorded wire continuity instead of hard-edge course counts.', async ({ page }) => {
  await openRecord(page, 'SETTEE-08');
  await expectSemantic(page.getByLabel('Front-edge evidence status'), ['complete', 'satisfied', 'recorded'], ['incomplete', 'unsatisfied', 'unrecorded', 'missing', 'not']);
  expect(await metric(page, 'Observed front evidence')).toBe(1);
  expect(await metric(page, 'Required front evidence')).toBe(1);
});

test('[F2P][D14] Chair 63 satisfies its posted one-course hard-edge requirement.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await expectSemantic(page.getByLabel('Front-edge evidence status'), ['complete', 'satisfied', 'recorded'], ['incomplete', 'unsatisfied', 'unrecorded', 'missing', 'not']);
  expect(await metric(page, 'Observed front evidence')).toBe(1);
  expect(await metric(page, 'Required front evidence')).toBe(1);
});

// Stable React entity binding

test('[F2P][D15] Every sorted course control keeps its own printed tag in the selected detail.', async ({ page }) => {
  for (const id of ['R-D2A', 'R-D2C']) {
    await selectCourse(page, id);
    await expect(page.getByLabel('Selected course tag')).toContainText(id);
  }
});

// SVG coordinate transform

async function clickCourseAt(page, width, height) {
  await page.setViewportSize({ width, height });
  const first = await page.getByText('A-NW', { exact: true }).boundingBox();
  const second = await page.getByRole('button', { name: 'Select coil C1', exact: true }).boundingBox();
  await page.mouse.click(
    (first.x + first.width / 2 + second.x + second.width / 2) / 2,
    (first.y + first.height / 2 + second.y + second.height / 2) / 2,
  );
}

test('[F2P][D16] A physical press on the asymmetric C1 falling course selects its printed tag at desktop scale.', async ({ page }) => {
  await clickCourseAt(page, 1280, 900);
  await expect(page.getByLabel('Selected course tag')).toContainText('R-D1A');
});

test('[F2P][D16] The same asymmetric C1 falling-course press keeps its tag after live phone resize.', async ({ page }) => {
  await clickCourseAt(page, 1280, 900);
  await expect(page.getByLabel('Selected course tag')).toContainText('R-D1A');
  await page.getByRole('button', { name: 'Close detail loupe', exact: true }).click();
  await clickCourseAt(page, 390, 844);
  await expect(page.getByLabel('Selected course tag')).toContainText('R-D1A');
});

// Responsive conservation surface

test('[F2P][D17] The complete underside view remains inside a 390-pixel document.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const stage = await page.getByRole('region', { name: 'Underside spring record' }).boundingBox();
  expect(stage.x).toBeGreaterThanOrEqual(0);
  expect(stage.x + stage.width).toBeLessThanOrEqual(390.5);
  for (const label of ['Frame anchor A-NW', 'Frame anchor A-SE', 'Frame anchor A-S1']) {
    const anchor = await page.getByText(label.replace('Frame anchor ', ''), { exact: true }).boundingBox();
    expect(anchor.width).toBeGreaterThan(0);
    expect(anchor.height).toBeGreaterThan(0);
    expect(anchor.x).toBeGreaterThanOrEqual(stage.x - 1);
    expect(anchor.x + anchor.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
  }
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
});

test('[F2P][D17] Every course control stays reachable without horizontal clipping on a phone.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const buttons = page.getByRole('navigation', { name: 'Recorded cord courses' }).getByRole('button');
  await expect(buttons).toHaveCount(12);
  for (const button of await buttons.all()) {
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
  }
  for (const id of ['R-H1', 'R-D2D']) {
    await page.getByRole('button', { name: `Select ${id}`, exact: true }).click();
    await expect(page.getByLabel('Selected course tag')).toContainText(id);
  }
});

test('[F2P][D17] The phone summary remains contained and its values are not clipped.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const summary = await page.getByRole('region', { name: 'Survey summary' }).boundingBox();
  expect(summary.x).toBeGreaterThanOrEqual(0);
  expect(summary.x + summary.width).toBeLessThanOrEqual(390.5);
  for (const label of [
    'Unique cord course count',
    'Recorded finding count',
    'Independent topology group count',
    'Anchored cord course count',
    'Front-edge evidence status',
    'Survey completion status',
    'Conservator review status',
  ]) {
    const fit = await page.getByLabel(label, { exact: true })
      .evaluate((node) => {
        const box = node.getBoundingClientRect();
        return {
          visible: box.width > 0 && box.height > 0,
          contained: node.scrollWidth <= node.clientWidth + 1
            && node.scrollHeight <= node.clientHeight + 1,
        };
      });
    expect(fit).toEqual({ visible: true, contained: true });
  }
});

test('[F2P][D17] The open phone loupe remains contained and does not cover the front anchor.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await selectCoil(page, 'C3');
  const loupe = await page.getByRole('complementary', { name: 'Survey detail loupe' }).boundingBox();
  const anchor = await page.getByText('A-S1', { exact: true }).boundingBox();
  expect(loupe.x).toBeGreaterThanOrEqual(0);
  expect(loupe.x + loupe.width).toBeLessThanOrEqual(390.5);
  expect(overlaps(loupe, anchor)).toBe(false);
});
