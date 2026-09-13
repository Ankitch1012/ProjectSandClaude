const { test, expect } = require('@playwright/test');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

function numberFrom(text) {
  const match = String(text).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

async function ready(page) {
  await expect(page.getByRole('heading', { name: 'Seat Spring Survey', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open CHAIR-41', exact: true })).toHaveAttribute('aria-pressed', 'true');
}

test.beforeEach(async ({ page }) => {
  await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
  await ready(page);
});

async function openRecord(page, id) {
  const response = page.waitForResponse((entry) => (
    entry.url().includes('/api/start') && entry.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: `Open ${id}`, exact: true }).click();
  await response;
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
  const response = page.waitForResponse((entry) => entry.url().includes('/api/course-finding'));
  await page.getByRole('button', { name, exact: true }).click();
  await response;
}

async function propose(page, label) {
  const response = page.waitForResponse((entry) => entry.url().includes('/api/replacement'));
  await page.getByRole('button', { name: label, exact: true }).click();
  await response;
}

async function inspectContacts(page) {
  const response = page.waitForResponse((entry) => entry.url().includes('/api/inspect-contacts'));
  await page.getByRole('button', { name: 'RECORD ALL CONTACTS INSPECTED', exact: true }).click();
  await response;
}

async function metric(page, label) {
  return numberFrom(await page.getByLabel(label, { exact: true }).innerText());
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

test('[P2P] The primary underside exposes twelve cord courses and four selectable coils.', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Recorded cord courses' }).getByRole('button')).toHaveCount(12);
  for (const id of ['C1', 'C2', 'C3', 'C4']) {
    await expect(page.getByRole('button', { name: `Select coil ${id}`, exact: true })).toBeVisible();
  }
});

test('[P2P] The application uses documentation and review states without treatment authorization.', async ({ page }) => {
  await expect(page.getByLabel('Survey completion status')).toContainText('SURVEY');
  await expect(page.getByLabel('Conservator review status')).toBeVisible();
  await expect(page.getByRole('button', { name: /release|approve|safe to cut/i })).toHaveCount(0);
});

// Evidence decoding

test('[F2P][D1] False and zero-valued findings remain present in the record register.', async ({ page }) => {
  await expect(page.getByLabel('Recorded finding count')).toHaveText('2');
});

// Record-driven orientation

test('[F2P][D2] Chair 41 mirrors its east chair-left anchor onto the left side of the underside view.', async ({ page }) => {
  const east = await page.getByLabel('Frame anchor A-E1').boundingBox();
  const west = await page.getByLabel('Frame anchor A-W1').boundingBox();
  expect(east.x).toBeLessThan(west.x);
});

test('[F2P][D2] Chair 63 rotates its north chair-left marker to the left of its south marker.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  const north = await page.getByLabel('Frame anchor K-N', { exact: true }).boundingBox();
  const south = await page.getByLabel('Frame anchor K-S', { exact: true }).boundingBox();
  expect(north.x).toBeLessThan(south.x);
});

// Replacement-profile comparison

test('[F2P][D3] A height-only match with the wrong gauge and turn count requires review.', async ({ page }) => {
  await selectCoil(page, 'C1');
  await propose(page, 'Profile B');
  await expect(page.getByLabel('C1 replacement profile status')).toHaveText('REVIEW');
});

test('[F2P][D3] A matching height and turn count still rejects the wrong top diameter.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await selectCoil(page, 'K1');
  await propose(page, 'Narrow profile');
  await expect(page.getByLabel('K1 replacement profile status')).toHaveText('REVIEW');
});

// Failed webbing remains reviewable

test('[F2P][D4] Failed webbing remains attached to its coils and requires conservator review.', async ({ page }) => {
  await selectCoil(page, 'C2');
  await expect(page.getByLabel('C2 webbing status')).toHaveText('FAILED');
  await expect(page.getByLabel('Conservator review status')).toHaveText('REQUIRED');
  await expect(page.getByLabel('Conservator review reasons')).toContainText('failed webbing');
});

// Object-space axes

test('[F2P][D5] The skewed K-H course keeps its posted crosswise axis family.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await selectCourse(page, 'K-H');
  await expect(page.getByLabel('Selected course axis')).toHaveText('crosswise');
});

// Direction-independent course identity

test('[F2P][D6] Reversed storage leaves R-V2 identified as the same physical course.', async ({ page }) => {
  await selectCourse(page, 'R-V2');
  await expect(page.getByLabel('Selected course identity')).toHaveText('R-V2');
});

test('[F2P][D6] Anchor naming never replaces the stable R-H1 physical course identity.', async ({ page }) => {
  await selectCourse(page, 'R-H1');
  await expect(page.getByLabel('Selected course identity')).toHaveText('R-H1');
});

// Crossing and lashing semantics

test('[F2P][D7] Free and lashed crossings preserve all twelve primary course identities.', async ({ page }) => {
  await expect(page.getByLabel('Independent topology group count')).toHaveText('12');
});

test('[F2P][D7] The settee lashing preserves four independent physical courses.', async ({ page }) => {
  await openRecord(page, 'SETTEE-08');
  await expect(page.getByLabel('Independent topology group count')).toHaveText('4');
});

// Physical continuation through crossings

test('[F2P][D8] Marking R-D1C does not mark the free-crossing R-D2B course.', async ({ page }) => {
  await selectCourse(page, 'R-D1C');
  await markSelected(page, 'affected');
  await expect(page.getByLabel('Selected course finding')).toHaveText('AFFECTED');
  await selectCourse(page, 'R-D2B');
  await expect(page.getByLabel('Selected course finding')).toHaveText('CLEAR');
});

// Polygon and shared anchors

test('[F2P][D9] Every primary course resolves both ends to observed frame stations.', async ({ page }) => {
  await expect(page.getByLabel('Anchored cord course count')).toHaveText('12');
});

test('[F2P][D9] Chamfered and shared stations anchor all four Chair 63 courses.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await expect(page.getByLabel('Anchored cord course count')).toHaveText('4');
});

// Four distinct axis pairs

test('[F2P][D10] Four contacts with a duplicated falling axis leave K1 incomplete.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await selectCoil(page, 'K1');
  await expect(page.getByLabel('K1 restraint status')).toHaveText('INCOMPLETE');
  await expect(page.getByLabel('K1 axis families')).not.toContainText('rising');
});

// Course-wide affected aggregation

test('[F2P][D11] Marking one R-H1 span marks every span in that physical course.', async ({ page }) => {
  await selectCourse(page, 'R-H1');
  await markSelected(page, 'affected');
  await expect(page.getByLabel('Selected course affected span count')).toHaveText('3');
});

test('[F2P][D11] An affected R-H1 course keeps all spans marked after selecting another course.', async ({ page }) => {
  await selectCourse(page, 'R-H1');
  await markSelected(page, 'affected');
  await selectCourse(page, 'R-V1');
  await selectCourse(page, 'R-H1');
  await expect(page.getByLabel('Selected course affected span count')).toHaveText('3');
  await expect(page.getByLabel('Selected course finding')).toHaveText('AFFECTED');
});

// Replacement contact invalidation

test('[F2P][D12] A replacement proposal invalidates every previously inspected C1 contact.', async ({ page }) => {
  await selectCoil(page, 'C1');
  await inspectContacts(page);
  await expect(page.getByLabel('C1 inspected contacts')).toHaveText('4 / 4');
  await propose(page, 'Profile A');
  await expect(page.getByLabel('C1 inspected contacts')).toHaveText('0 / 4');
  await expect(page.getByLabel('C1 reinspection count')).toHaveText('4');
});

test('[F2P][D12] Proposing another C1 profile invalidates the contacts a second time.', async ({ page }) => {
  await selectCoil(page, 'C1');
  await propose(page, 'Profile A');
  await inspectContacts(page);
  await propose(page, 'Profile B');
  await expect(page.getByLabel('C1 reinspection count')).toHaveText('4');
});

// Unique course count

test('[F2P][D13] The course summary counts physical runs rather than rendered spans.', async ({ page }) => {
  await expect(page.getByLabel('Unique cord course count')).toHaveText('12');
});

// Fixture-specific front evidence

test('[F2P][D14] The settee uses its recorded wire continuity instead of hard-edge course counts.', async ({ page }) => {
  await openRecord(page, 'SETTEE-08');
  await expect(page.getByLabel('Front-edge evidence status')).toHaveText('COMPLETE');
});

test('[F2P][D14] Chair 63 satisfies its posted one-course hard-edge requirement.', async ({ page }) => {
  await openRecord(page, 'CHAIR-63');
  await expect(page.getByLabel('Front-edge evidence status')).toHaveText('COMPLETE');
});

// Stable React entity binding

test('[F2P][D15] Selecting the sorted R-D2A control opens R-D2A rather than another course.', async ({ page }) => {
  await selectCourse(page, 'R-D2A');
  await expect(page.getByRole('heading', { name: 'R-D2A', exact: true })).toBeVisible();
});

test('[F2P][D15] Selecting the sorted R-D2C control opens R-D2C consistently.', async ({ page }) => {
  await selectCourse(page, 'R-D2C');
  await expect(page.getByRole('heading', { name: 'R-D2C', exact: true })).toBeVisible();
});

// SVG coordinate transform

async function clickCourseAt(page, width, height) {
  await page.setViewportSize({ width, height });
  const first = await page.getByLabel('Frame anchor A-W1', { exact: true }).boundingBox();
  const second = await page.getByLabel('Frame anchor A-E1', { exact: true }).boundingBox();
  await page.mouse.click(
    (first.x + first.width / 2 + second.x + second.width / 2) / 2,
    (first.y + first.height / 2 + second.y + second.height / 2) / 2,
  );
}

test('[F2P][D16] A physical press on the upper cross course selects R-H1 at desktop scale.', async ({ page }) => {
  await clickCourseAt(page, 1280, 900);
  await expect(page.getByRole('heading', { name: 'R-H1', exact: true })).toBeVisible();
});

test('[F2P][D16] The same physical upper-course press remains R-H1 after live phone resize.', async ({ page }) => {
  await clickCourseAt(page, 1280, 900);
  await page.getByRole('button', { name: 'Close detail loupe', exact: true }).click();
  await clickCourseAt(page, 390, 844);
  await expect(page.getByRole('heading', { name: 'R-H1', exact: true })).toBeVisible();
});

// Responsive conservation surface

test('[F2P][D17] The complete underside view remains inside a 390-pixel document.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const stage = await page.getByRole('region', { name: 'Underside spring record' }).boundingBox();
  expect(stage.x).toBeGreaterThanOrEqual(0);
  expect(stage.x + stage.width).toBeLessThanOrEqual(390.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('[F2P][D17] Every course control stays reachable without horizontal clipping on a phone.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const button of await page.getByRole('navigation', { name: 'Recorded cord courses' }).getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
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
      .evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
    expect(fit).toBe(true);
  }
});

test('[F2P][D17] The open phone loupe remains contained and does not cover the front anchor.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await selectCoil(page, 'C3');
  const loupe = await page.getByRole('complementary', { name: 'Survey detail loupe' }).boundingBox();
  const anchor = await page.getByLabel('Frame anchor A-S1').boundingBox();
  expect(loupe.x).toBeGreaterThanOrEqual(0);
  expect(loupe.x + loupe.width).toBeLessThanOrEqual(390.5);
  expect(overlaps(loupe, anchor)).toBe(false);
});
