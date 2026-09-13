const { test, expect } = require('@playwright/test');

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function numberFrom(text) {
  const match = String(text).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

async function ready(page) {
  await expect(page.getByRole('navigation', { name: 'Variance queue' })).toBeVisible();
  await expect(page.getByLabel('Selected case ID')).not.toHaveText('—');
}

test.beforeEach(async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
});

async function select(page, id) {
  await page.getByRole('button', { name: `Select ${id}`, exact: true }).click();
  await expect(page.getByLabel('Selected case ID')).toHaveText(id);
}

async function metric(page, label) {
  return numberFrom(await page.getByLabel(label).innerText());
}

async function status(page) {
  return (await page.getByLabel('Case status').innerText()).trim().toLowerCase();
}

async function recount(page, amount) {
  const input = page.getByLabel('New recount quantity');
  await input.fill(String(amount));
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/recount') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'POST RECOUNT', exact: true }).click(),
  ]);
  await expect(input).toHaveValue('');
}

async function clickEnabled(page, name) {
  const button = page.getByRole('button', { name, exact: true });
  expect(await button.isEnabled()).toBe(true);
  await Promise.all([
    page.waitForResponse(response => response.request().method() === 'POST'),
    button.click(),
  ]);
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function reload(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
}

async function rowBox(page, side, sku) {
  return page.getByLabel(`${side} row ${sku}`).boundingBox();
}

function overlaps(a, b) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x ||
    a.y + a.height <= b.y || b.y + b.height <= a.y);
}

// Pass-to-pass guards

test('[P2P] The variance desk boots with its queue, reconciliation sheet, and decisions.', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'COUNTBACK' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reconciliation sheet' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Decision controls' })).toBeVisible();
});

test('[P2P] A fresh desk shows all six cases and selects CC-104.', async ({ page }) => {
  expect(await metric(page, 'Visible case count')).toBe(6);
  await expect(page.getByLabel('Selected case ID')).toHaveText('CC-104');
});

test('[P2P] Selecting an unfiltered case updates the reconciliation workspace.', async ({ page }) => {
  await select(page, 'CC-509');
  await expect(page.getByLabel('Selected case label')).toContainText('Inbound stock');
});

test('[P2P] The adjacent-bin case visibly carries equal and opposite row variances.', async ({ page }) => {
  await expect(page.getByLabel('Count row AX-14')).toContainText('Variance-3');
  await expect(page.getByLabel('Count row BZ-22')).toContainText('Variance3');
});

test('[P2P] A large unresolved loss cannot be adjusted without another count.', async ({ page }) => {
  await select(page, 'CC-610');
  await expect(page.getByRole('button', { name: 'ADJUST', exact: true })).toBeDisabled();
});

test('[P2P] HOLD marks the selected case without changing its quantities.', async ({ page }) => {
  const before = await metric(page, 'On hand total');
  await clickEnabled(page, 'HOLD');
  expect(await status(page)).toBe('hold');
  expect(await metric(page, 'On hand total')).toBe(before);
});

test('[P2P] Invalid recount input leaves the current count history unchanged.', async ({ page }) => {
  const before = await page.getByLabel('Recount history').innerText();
  await page.getByLabel('New recount quantity').fill('-1');
  await page.getByRole('button', { name: 'POST RECOUNT', exact: true }).click();
  await expect(page.getByLabel('Recount history')).toHaveText(before);
});

test('[P2P] Serial scanning is unavailable for ordinary inventory.', async ({ page }) => {
  await select(page, 'CC-421');
  await expect(page.getByRole('button', { name: 'SCAN MISSING SERIAL', exact: true })).toBeDisabled();
});

// Latest recount semantics

test('[F2P][D1] The second count is the authoritative total for CC-207.', async ({ page }) => {
  await select(page, 'CC-207');
  expect(await metric(page, 'Latest count total')).toBe(48);
});

test('[F2P][D1] CC-207 variance is derived from its second count.', async ({ page }) => {
  await select(page, 'CC-207');
  expect(await metric(page, 'Variance total')).toBe(-2);
});

test('[F2P][D1] Posting 49 makes it the latest count immediately.', async ({ page }) => {
  await select(page, 'CC-207');
  await recount(page, 49);
  expect(await metric(page, 'Latest count total')).toBe(49);
  expect(await metric(page, 'Variance total')).toBe(-1);
});

test('[F2P][D1] Only the last of two new recounts is authoritative.', async ({ page }) => {
  await select(page, 'CC-207');
  await recount(page, 47);
  await recount(page, 51);
  expect(await metric(page, 'Latest count total')).toBe(51);
  expect(await metric(page, 'Variance total')).toBe(1);
});

test('[F2P][D1] A posted recount and its latest total survive refresh.', async ({ page }) => {
  await select(page, 'CC-207');
  await recount(page, 49);
  await reload(page);
  await expect(page.getByLabel('Selected case ID')).toHaveText('CC-207');
  expect(await metric(page, 'Latest count total')).toBe(49);
  await expect(page.getByLabel('Recount history')).toContainText('44 → 48 → 49');
});

test('[F2P][D1] UNDO removes the newest recount and restores the prior authoritative count.', async ({ page }) => {
  await select(page, 'CC-207');
  await recount(page, 49);
  await clickEnabled(page, 'UNDO');
  expect(await metric(page, 'Latest count total')).toBe(48);
  await expect(page.getByLabel('Recount history')).not.toContainText('49');
});

// In-transit accounting

test('[F2P][D2] Inbound units are included in Available for CC-509.', async ({ page }) => {
  await select(page, 'CC-509');
  expect(await metric(page, 'Available total')).toBe(16);
});

test('[F2P][D2] Inbound units are excluded from the physical variance for CC-509.', async ({ page }) => {
  await select(page, 'CC-509');
  expect(await metric(page, 'Variance total')).toBe(0);
});

test('[F2P][D2] A recount of 14 changes variance but not the Available total.', async ({ page }) => {
  await select(page, 'CC-509');
  await recount(page, 14);
  expect({
    available: await metric(page, 'Available total'),
    latest: await metric(page, 'Latest count total'),
    variance: await metric(page, 'Variance total'),
  }).toEqual({ available: 16, latest: 14, variance: 2 });
});

// Adjacent-bin transposition lifecycle

test('[F2P][D3] LINK TRANSPOSE is available for the adjacent equal-and-opposite pair.', async ({ page }) => {
  expect(await page.getByRole('button', { name: 'LINK TRANSPOSE', exact: true }).isEnabled()).toBe(true);
});

test('[F2P][D3] Linking the adjacent exchange resolves CC-104.', async ({ page }) => {
  await clickEnabled(page, 'LINK TRANSPOSE');
  expect(await status(page)).toBe('resolved');
});

test('[F2P][D3] The linked decision identifies CC-104 without changing stock totals.', async ({ page }) => {
  const before = {
    onHand: await metric(page, 'On hand total'),
    latest: await metric(page, 'Latest count total'),
  };
  await clickEnabled(page, 'LINK TRANSPOSE');
  await expect(page.getByLabel('Decision summary')).toContainText(/link.*CC-104/i);
  expect({
    onHand: await metric(page, 'On hand total'),
    latest: await metric(page, 'Latest count total'),
  }).toEqual(before);
});

test('[F2P][D3] A linked transposition remains resolved after refresh.', async ({ page }) => {
  await clickEnabled(page, 'LINK TRANSPOSE');
  await reload(page);
  expect(await status(page)).toBe('resolved');
  await expect(page.getByLabel('Decision summary')).toContainText(/link/i);
});

test('[F2P][D3] UNDO restores a linked pair to its complete open state.', async ({ page }) => {
  await clickEnabled(page, 'LINK TRANSPOSE');
  await clickEnabled(page, 'UNDO');
  expect(await status(page)).toBe('open');
  await expect(page.getByLabel('Decision summary')).toContainText(/no decision/i);
  await expect(page.getByRole('button', { name: 'LINK TRANSPOSE', exact: true })).toBeEnabled();
});

test('[F2P][D3] A pair can be linked again after undo and remains durable.', async ({ page }) => {
  await clickEnabled(page, 'LINK TRANSPOSE');
  await clickEnabled(page, 'UNDO');
  await clickEnabled(page, 'LINK TRANSPOSE');
  await reload(page);
  expect(await status(page)).toBe('resolved');
});

// Threshold boundary

test('[F2P][D4] The exact five-unit CC-421 boundary is adjustable.', async ({ page }) => {
  await select(page, 'CC-421');
  expect(await page.getByRole('button', { name: 'ADJUST', exact: true }).isEnabled()).toBe(true);
});

test('[F2P][D4] Adjusting the exact boundary resolves CC-421.', async ({ page }) => {
  await select(page, 'CC-421');
  await clickEnabled(page, 'ADJUST');
  expect(await status(page)).toBe('resolved');
});

test('[F2P][D4] Boundary adjustment updates on-hand stock and clears variance.', async ({ page }) => {
  await select(page, 'CC-421');
  await clickEnabled(page, 'ADJUST');
  expect(await metric(page, 'On hand total')).toBe(15);
  expect(await metric(page, 'Variance total')).toBe(0);
});

test('[F2P][D4] The boundary adjustment survives refresh with its decision.', async ({ page }) => {
  await select(page, 'CC-421');
  await clickEnabled(page, 'ADJUST');
  await reload(page);
  expect(await status(page)).toBe('resolved');
  expect(await metric(page, 'On hand total')).toBe(15);
});

test('[F2P][D4] Recounting the large loss to the boundary enables adjustment.', async ({ page }) => {
  await select(page, 'CC-610');
  await recount(page, 35);
  expect(await metric(page, 'Variance total')).toBe(-5);
  expect(await page.getByRole('button', { name: 'ADJUST', exact: true }).isEnabled()).toBe(true);
});

// Serialized evidence

test('[F2P][D5] Serialized shortage cannot adjust before its missing serial is scanned.', async ({ page }) => {
  await select(page, 'CC-318');
  expect(await page.getByRole('button', { name: 'ADJUST', exact: true }).isDisabled()).toBe(true);
});

test('[F2P][D5] Serialized shortage initially reports zero of one required scans.', async ({ page }) => {
  await select(page, 'CC-318');
  expect(await page.getByLabel('Serial scan coverage').innerText()).toContain('0/1');
});

test('[F2P][D5] Scanning the missing serial completes the evidence coverage.', async ({ page }) => {
  await select(page, 'CC-318');
  await clickEnabled(page, 'SCAN MISSING SERIAL');
  expect(await page.getByLabel('Serial scan coverage').innerText()).toContain('1/1');
  expect(await page.getByRole('button', { name: 'ADJUST', exact: true }).isEnabled()).toBe(true);
});

test('[F2P][D5] A fully evidenced serialized adjustment resolves the case.', async ({ page }) => {
  await select(page, 'CC-318');
  await clickEnabled(page, 'SCAN MISSING SERIAL');
  await clickEnabled(page, 'ADJUST');
  expect(await status(page)).toBe('resolved');
});

test('[F2P][D5] Serialized evidence and adjustment survive refresh.', async ({ page }) => {
  await select(page, 'CC-318');
  await clickEnabled(page, 'SCAN MISSING SERIAL');
  await clickEnabled(page, 'ADJUST');
  await reload(page);
  expect(await status(page)).toBe('resolved');
  expect(await page.getByLabel('Serial scan coverage').innerText()).toContain('1/1');
});

// Selection must be independent of queue filters

for (const [id, filter] of [['CC-509', 'SERIALIZED'], ['CC-421', 'OPEN'], ['CC-318', 'ALL']]) {
  test(`[F2P][D6] Applying ${filter} does not replace selected case ${id}.`, async ({ page }) => {
    await select(page, id);
    await page.getByRole('button', { name: filter, exact: true }).click();
    expect((await page.getByLabel('Selected case ID').innerText()).trim()).toBe(id);
  });
}

test('[F2P][D6] Repeated filter changes leave the reviewed case and evidence unchanged.', async ({ page }) => {
  await select(page, 'CC-509');
  const before = {
    id: await page.getByLabel('Selected case ID').innerText(),
    available: await metric(page, 'Available total'),
    variance: await metric(page, 'Variance total'),
  };
  for (const filter of ['OPEN', 'SERIALIZED', 'RESOLVED', 'ALL']) {
    await page.getByRole('button', { name: filter, exact: true }).click();
  }
  expect({
    id: await page.getByLabel('Selected case ID').innerText(),
    available: await metric(page, 'Available total'),
    variance: await metric(page, 'Variance total'),
  }).toEqual(before);
});

// Persistence and full undo snapshots

test('[F2P][D7] HOLD remains attached to the selected case after refresh.', async ({ page }) => {
  await select(page, 'CC-509');
  await clickEnabled(page, 'HOLD');
  await reload(page);
  expect(await status(page)).toBe('hold');
  await expect(page.getByLabel('Decision summary')).toContainText(/hold.*CC-509/i);
});

test('[F2P][D7] UNDO after HOLD restores the complete open case.', async ({ page }) => {
  await select(page, 'CC-509');
  await clickEnabled(page, 'HOLD');
  await clickEnabled(page, 'UNDO');
  expect(await status(page)).toBe('open');
  await expect(page.getByLabel('Decision summary')).toContainText(/no decision/i);
});

test('[F2P][D7] UNDO after adjustment restores stock, count history, and status together.', async ({ page }) => {
  await select(page, 'CC-207');
  await recount(page, 49);
  await clickEnabled(page, 'ADJUST');
  await clickEnabled(page, 'UNDO');
  expect({
    status: await status(page),
    onHand: await metric(page, 'On hand total'),
    latest: await metric(page, 'Latest count total'),
  }).toEqual({ status: 'open', onHand: 50, latest: 49 });
  await expect(page.getByLabel('Recount history')).toContainText('44 → 48 → 49');
});

test('[F2P][D7] Boundary recount, adjustment, and undo preserve the recount but restore stock.', async ({ page }) => {
  await select(page, 'CC-610');
  await recount(page, 35);
  await clickEnabled(page, 'ADJUST');
  await clickEnabled(page, 'UNDO');
  expect({
    status: await status(page),
    onHand: await metric(page, 'On hand total'),
    latest: await metric(page, 'Latest count total'),
    variance: await metric(page, 'Variance total'),
  }).toEqual({ status: 'open', onHand: 40, latest: 35, variance: -5 });
});

// Objective split-sheet layout

for (const sku of ['AX-14', 'BZ-22']) {
  test(`[F2P][D8] Expected and counted ${sku} rows share one horizontal register.`, async ({ page }) => {
    const system = await rowBox(page, 'System', sku);
    const counted = await rowBox(page, 'Count', sku);
    expect(Math.abs(system.y - counted.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(system.height - counted.height)).toBeLessThanOrEqual(1);
  });
}

test('[F2P][D9] The reconciliation sheet remains contained at phone width.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await page.getByRole('region', { name: 'Reconciliation sheet' }).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test('[F2P][D9] The inventory summary remains contained at phone width.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await page.getByRole('region', { name: 'Inventory summary' }).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test('[F2P][D9] Every decision control remains contained and mutually separated on a phone.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const boxes = [];
  for (const name of ['LINK TRANSPOSE', 'ADJUST', 'HOLD', 'UNDO']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    boxes.push(box);
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) expect(overlaps(boxes[i], boxes[j])).toBe(false);
  }
});

test('[F2P][D9] Live resize preserves alignment without document-level sideways overflow.', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.setViewportSize({ width: 375, height: 760 });
  const system = await rowBox(page, 'System', 'AX-14');
  const counted = await rowBox(page, 'Count', 'AX-14');
  expect(Math.abs(system.y - counted.y)).toBeLessThanOrEqual(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
