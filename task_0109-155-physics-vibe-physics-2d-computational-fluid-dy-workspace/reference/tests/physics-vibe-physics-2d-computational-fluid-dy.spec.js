const { test, expect } = require('@playwright/test');

const APP_URL = process.env.APP_URL;

function numberFrom(text) {
  const match = String(text).replace(/,/g, '').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  return match ? Number(match[0]) : NaN;
}

async function waitForReady(page) {
  await expect(page.getByRole('status', { name: 'Solver validation' })).toContainText(/validated/i);
  await expect(page.getByRole('slider', { name: 'Velocity', exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReady(page);
});

async function metric(page, label) {
  return numberFrom(await page.locator(`[aria-label="${label}"]`).innerText());
}

async function setSlider(page, name, value) {
  const slider = page.getByRole('slider', { name, exact: true });
  await slider.fill(String(value));
  await expect(slider).toHaveValue(String(value));
}

async function setPoint(page, { velocity, depth, temp }) {
  await setSlider(page, 'Velocity', velocity);
  await setSlider(page, 'Depth', depth);
  await setSlider(page, 'Water temperature', temp);
}

async function selectPreset(page, name, expectedVelocity) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByLabel('Velocity readout')).toContainText(String(expectedVelocity));
}

async function pointSnapshot(page) {
  return {
    controls: {
      velocity: Number(await page.getByRole('slider', { name: 'Velocity', exact: true }).inputValue()),
      depth: Number(await page.getByRole('slider', { name: 'Depth', exact: true }).inputValue()),
      temp: Number(await page.getByRole('slider', { name: 'Water temperature', exact: true }).inputValue()),
    },
    readouts: {
      velocity: numberFrom(await page.getByLabel('Velocity readout').innerText()),
      depth: numberFrom(await page.getByLabel('Depth readout').innerText()),
      temp: numberFrom(await page.getByLabel('Water temperature readout').innerText()),
    },
  };
}

function expectedPoint(velocity, depth, temp) {
  return {
    controls: { velocity, depth, temp },
    readouts: { velocity, depth, temp },
  };
}

async function recentRows(page) {
  const rows = page.getByRole('region', { name: 'Recent samples' }).getByRole('row');
  const result = [];
  for (let index = 1; index < await rows.count(); index += 1) {
    const cells = await rows.nth(index).getByRole('cell').allTextContents();
    if (cells.length !== 8) continue;
    result.push({
      trial: numberFrom(cells[0]),
      ordinal: numberFrom(cells[1]),
      time: numberFrom(cells[2]),
      velocity: numberFrom(cells[3]),
      depth: numberFrom(cells[4]),
      temp: numberFrom(cells[5]),
      Cd: numberFrom(cells[6]),
      drag: numberFrom(cells[7]),
    });
  }
  return result;
}

async function publicSnapshot(page) {
  return {
    point: await pointSnapshot(page),
    trial: await metric(page, 'Trial number telemetry'),
    samples: await metric(page, 'History samples telemetry'),
    retained: await metric(page, 'Retained samples telemetry'),
    elapsed: await metric(page, 'Elapsed time telemetry'),
    paused: await page.getByRole('button', { name: /play/i }).isVisible(),
    rows: await recentRows(page),
  };
}

async function pinSnapshot(page, name) {
  return {
    trial: await metric(page, `${name} Trial`),
    ordinal: await metric(page, `${name} Sample`),
    velocity: await metric(page, `${name} Velocity`),
    depth: await metric(page, `${name} Depth`),
    temp: await metric(page, `${name} Temp`),
    Cd: await metric(page, `${name} Cd`),
    drag: await metric(page, `${name} Drag`),
  };
}

async function comparisonSnapshot(page) {
    return {
    reference: await pinSnapshot(page, 'Reference'),
    candidate: await pinSnapshot(page, 'Candidate'),
    cdDelta: await metric(page, 'Drag coefficient delta'),
    dragDelta: await metric(page, 'Drag force delta'),
  };
}

async function stepTimes(page, count) {
  const step = page.getByRole('button', { name: 'STEP', exact: true });
  for (let index = 0; index < count; index += 1) await step.click();
}

async function playUntil(page, minimum) {
  await page.getByRole('button', { name: /play/i }).click();
  await expect.poll(() => metric(page, 'History samples telemetry')).toBeGreaterThanOrEqual(minimum);
}

async function pause(page) {
  await page.getByRole('button', { name: /pause/i }).click();
  await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
}

async function reloadReady(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReady(page);
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

function density(temp) {
  return 1000 - 0.004 * (temp - 4) ** 2 - 0.07 * Math.max(0, temp - 4);
}

function viscosity(temp) {
  return 2.414e-5 * Math.exp(247.8 / (temp + 273.15 + 140));
}

function relativeError(actual, expected) {
  return Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x ||
    a.y + a.height <= b.y || b.y + b.height <= a.y);
}

function visibleHeight(box, viewportHeight) {
  return Math.max(0, Math.min(box.y + box.height, viewportHeight) - Math.max(box.y, 0));
}

// Pass-to-pass guards

test('[P2P] The laboratory boots with controls, flow, trial telemetry, and recent history.', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /cavitation lab/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
  await expect(page.getByLabel('Flow visualization')).toBeVisible();
  await expect(page.getByLabel('Trial number telemetry')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent samples' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Trial comparison' })).toBeVisible();
});

test('[P2P] Clean storage opens the documented paused default trial.', async ({ page }) => {
  expect(await publicSnapshot(page)).toEqual({
    point: expectedPoint(20, 50, 20),
    trial: 1,
    samples: 0,
    retained: 0,
    elapsed: 0,
    paused: true,
    rows: [],
  });
});

test('[P2P] Direct non-round slider input keeps controls and readouts synchronized.', async ({ page }) => {
  await setPoint(page, { velocity: 37.5, depth: 61, temp: 33 });
  expect(await pointSnapshot(page)).toEqual(expectedPoint(37.5, 61, 33));
});

test('[P2P] Zero velocity produces zero coefficient, force, power, and kinetic energy.', async ({ page }) => {
  await setSlider(page, 'Velocity', 0);
  expect({
    cd: await metric(page, 'Drag coefficient telemetry'),
    drag: await metric(page, 'Drag force telemetry'),
    power: await metric(page, 'Power telemetry'),
    energy: await metric(page, 'Kinetic energy telemetry'),
  }).toEqual({ cd: 0, drag: 0, power: 0, energy: 0 });
});

test('[P2P] A non-round operating point follows the displayed run basis.', async ({ page }) => {
  const velocity = 37.5;
  const depth = 61;
  const temp = 33;
  await setPoint(page, { velocity, depth, temp });
  const rho = density(temp);
  const expectedRe = rho * velocity * 2 / viscosity(temp);
  const expectedAmbient = (101325 + rho * 9.81 * depth) / 1000;
  const cd = await metric(page, 'Drag coefficient telemetry');
  const expectedDrag = 0.5 * cd * rho * velocity ** 2 * 0.0707;
  const drag = await metric(page, 'Drag force telemetry');
  expect(relativeError(await metric(page, 'Reynolds number telemetry'), expectedRe)).toBeLessThan(0.006);
  expect(Math.abs(await metric(page, 'Ambient pressure telemetry') - expectedAmbient)).toBeLessThan(0.12);
  expect(relativeError(drag, expectedDrag)).toBeLessThan(0.012);
  expect(relativeError(await metric(page, 'Power telemetry'), drag * velocity)).toBeLessThan(0.012);
  expect(relativeError(await metric(page, 'Kinetic energy telemetry'), 0.5 * 50 * velocity ** 2)).toBeLessThan(0.006);
});

test('[P2P] Shallow Sprint applies the complete point advertised by its control.', async ({ page }) => {
  await selectPreset(page, 'Shallow Sprint', 80);
  expect(await pointSnapshot(page)).toEqual(expectedPoint(80, 5, 20));
});

test('[P2P] One fresh STEP advances the public clock once and remains paused.', async ({ page }) => {
  await stepTimes(page, 1);
  expect({
    samples: await metric(page, 'History samples telemetry'),
    elapsed: await metric(page, 'Elapsed time telemetry'),
    paused: await page.getByRole('button', { name: /play/i }).isVisible(),
  }).toEqual({ samples: 1, elapsed: 0.017, paused: true });
});

test('[P2P] PLAY grows the trial and PAUSE freezes its public counters.', async ({ page }) => {
  await playUntil(page, 3);
  await pause(page);
  const frozen = {
    samples: await metric(page, 'History samples telemetry'),
    elapsed: await metric(page, 'Elapsed time telemetry'),
  };
  await twoFrames(page);
  expect({
    samples: await metric(page, 'History samples telemetry'),
    elapsed: await metric(page, 'Elapsed time telemetry'),
  }).toEqual(frozen);
});

// Atomic point transitions

for (const [name, value] of [['Velocity', 37.5]]) {
  test(`[F2P] Changing ${name.toLowerCase()} after two samples opens one empty paused trial.`, async ({ page }) => {
    await stepTimes(page, 2);
    const before = await metric(page, 'Trial number telemetry');
    await setSlider(page, name, value);
    expect({
      trial: await metric(page, 'Trial number telemetry'),
      samples: await metric(page, 'History samples telemetry'),
      retained: await metric(page, 'Retained samples telemetry'),
      elapsed: await metric(page, 'Elapsed time telemetry'),
      paused: await page.getByRole('button', { name: /play/i }).isVisible(),
    }).toEqual({ trial: before + 1, samples: 0, retained: 0, elapsed: 0, paused: true });
  });
}

test('[F2P] Changing temperature during playback commits a clean paused trial.', async ({ page }) => {
  await playUntil(page, 3);
  const before = await metric(page, 'Trial number telemetry');
  await setSlider(page, 'Water temperature', 47);
  expect(await publicSnapshot(page)).toEqual({
    point: expectedPoint(20, 50, 47),
    trial: before + 1,
    samples: 0,
    retained: 0,
    elapsed: 0,
    paused: true,
    rows: [],
  });
});

test('[F2P] A preset during playback creates one trial whose first sample contains only that point.', async ({ page }) => {
  await playUntil(page, 3);
  const before = await metric(page, 'Trial number telemetry');
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  const rows = await recentRows(page);
  expect({
    point: await pointSnapshot(page),
    trial: await metric(page, 'Trial number telemetry'),
    samples: await metric(page, 'History samples telemetry'),
    row: rows[0],
  }).toEqual({
    point: expectedPoint(100, 100, 20),
    trial: before + 1,
    samples: 1,
    row: expect.objectContaining({
      trial: before + 1,
      ordinal: 1,
      velocity: 100,
      depth: 100,
      temp: 20,
    }),
  });
});

test('[F2P] Number key five applies one complete Shallow Sprint transition from slider focus.', async ({ page }) => {
  const before = await metric(page, 'Trial number telemetry');
  await page.getByRole('slider', { name: 'Depth', exact: true }).focus();
  await page.keyboard.press('5');
  expect({
    point: await pointSnapshot(page),
    trial: await metric(page, 'Trial number telemetry'),
  }).toEqual({ point: expectedPoint(80, 5, 20), trial: before + 1 });
});

test('[F2P] Arrow Up from a non-round point opens exactly one new trial.', async ({ page }) => {
  await setPoint(page, { velocity: 37.5, depth: 61, temp: 33 });
  await stepTimes(page, 2);
  const before = await metric(page, 'Trial number telemetry');
  await page.getByRole('heading', { name: /cavitation lab/i }).click();
  await page.keyboard.press('ArrowUp');
  expect({
    point: await pointSnapshot(page),
    trial: await metric(page, 'Trial number telemetry'),
    samples: await metric(page, 'History samples telemetry'),
  }).toEqual({ point: expectedPoint(39.5, 61, 33), trial: before + 1, samples: 0 });
});

// Canonical no-op boundaries

for (const [start, key] of [[120, 'ArrowUp']]) {
  test(`[F2P] ${key} at ${start} preserves the complete paused trial.`, async ({ page }) => {
    await setSlider(page, 'Velocity', start);
    await stepTimes(page, 2);
    const before = await publicSnapshot(page);
    await page.getByRole('heading', { name: /cavitation lab/i }).click();
    await page.keyboard.press(key);
    expect(await publicSnapshot(page)).toEqual(before);
  });
}

test('[F2P] Re-selecting the active preset preserves its paused history.', async ({ page }) => {
  await selectPreset(page, 'Gentle', 15);
  await stepTimes(page, 2);
  const before = await publicSnapshot(page);
  await selectPreset(page, 'Gentle', 15);
  expect(await publicSnapshot(page)).toEqual(before);
});

test('[F2P] Focused RESET at the default point still creates one fresh persisted trial.', async ({ page }) => {
  await stepTimes(page, 2);
  const before = await metric(page, 'Trial number telemetry');
  await page.getByRole('slider', { name: 'Velocity', exact: true }).focus();
  await page.keyboard.press('r');
  expect({
    trial: await metric(page, 'Trial number telemetry'),
    samples: await metric(page, 'History samples telemetry'),
    elapsed: await metric(page, 'Elapsed time telemetry'),
  }).toEqual({ trial: before + 1, samples: 0, elapsed: 0 });
  await reloadReady(page);
  expect(await metric(page, 'Trial number telemetry')).toBe(before + 1);
});

// Paused checkpoints

test('[F2P] Three STEPs survive reload in ordinal order.', async ({ page }) => {
  await stepTimes(page, 3);
  await reloadReady(page);
  const snapshot = await publicSnapshot(page);
  expect(snapshot.samples).toBe(3);
  expect(snapshot.rows.map(row => row.ordinal)).toEqual([1, 2, 3]);
  expect(snapshot.rows.map(row => row.time)).toEqual([0.017, 0.033, 0.05]);
});

test('[F2P] A non-round stepped trial survives reload as one public snapshot.', async ({ page }) => {
  await setPoint(page, { velocity: 37.5, depth: 61, temp: 33 });
  await stepTimes(page, 3);
  const before = await publicSnapshot(page);
  await reloadReady(page);
  expect(await publicSnapshot(page)).toEqual(before);
});

test('[F2P] PLAY then PAUSE commits the exact frozen snapshot for reload.', async ({ page }) => {
  await playUntil(page, 4);
  await pause(page);
  const before = await publicSnapshot(page);
  await reloadReady(page);
  expect(await publicSnapshot(page)).toEqual(before);
});

test('[F2P] A depth change after restored samples persists as the new empty trial.', async ({ page }) => {
  await stepTimes(page, 2);
  await reloadReady(page);
  const beforeTrial = await metric(page, 'Trial number telemetry');
  await setSlider(page, 'Depth', 119);
  await reloadReady(page);
  const snapshot = await publicSnapshot(page);
  expect(snapshot.point).toEqual(expectedPoint(20, 119, 20));
  expect(snapshot.trial).toBe(beforeTrial + 1);
  expect(snapshot.samples).toBe(0);
  expect(snapshot.rows).toEqual([]);
});

// Volatile playback and durable checkpoints

test('[F2P] Reloading active playback restores the clean pre-play checkpoint.', async ({ page }) => {
  const before = await publicSnapshot(page);
  await playUntil(page, 4);
  await reloadReady(page);
  expect(await publicSnapshot(page)).toEqual(before);
});

test('[F2P] Playback from a one-step checkpoint rolls back exactly to that sample.', async ({ page }) => {
  await stepTimes(page, 1);
  const checkpoint = await publicSnapshot(page);
  await playUntil(page, 5);
  await reloadReady(page);
  expect(await publicSnapshot(page)).toEqual(checkpoint);
});

test('[F2P] A setup change during playback commits its new empty trial before reload.', async ({ page }) => {
  await playUntil(page, 4);
  const beforeTrial = await metric(page, 'Trial number telemetry');
  await setSlider(page, 'Depth', 119);
  await reloadReady(page);
  const snapshot = await publicSnapshot(page);
  expect(snapshot.point).toEqual(expectedPoint(20, 119, 20));
  expect(snapshot.trial).toBe(beforeTrial + 1);
  expect(snapshot.samples).toBe(0);
  expect(snapshot.paused).toBe(true);
});

// Sample integrity

test('[F2P] The first non-round sample row captures its point and visible telemetry.', async ({ page }) => {
  await setPoint(page, { velocity: 37.5, depth: 61, temp: 33 });
  await stepTimes(page, 1);
  const row = (await recentRows(page))[0];
  expect(row).toEqual(expect.objectContaining({
    trial: await metric(page, 'Trial number telemetry'),
    ordinal: 1,
    time: 0.017,
    velocity: 37.5,
    depth: 61,
    temp: 33,
  }));
  expect(relativeError(row.Cd, await metric(page, 'Drag coefficient telemetry'))).toBeLessThan(0.001);
  expect(relativeError(row.drag, await metric(page, 'Drag force telemetry'))).toBeLessThan(0.012);
});

test('[F2P] Three sample rows have consecutive ordinals and exact clock positions.', async ({ page }) => {
  await stepTimes(page, 3);
  const rows = await recentRows(page);
  expect(rows.map(({ ordinal, time }) => ({ ordinal, time }))).toEqual([
    { ordinal: 1, time: 0.017 },
    { ordinal: 2, time: 0.033 },
    { ordinal: 3, time: 0.05 },
  ]);
});

test('[F2P] A capped Arrow Up records 120 rather than stale velocity.', async ({ page }) => {
  await setSlider(page, 'Velocity', 119.5);
  await page.getByRole('heading', { name: /cavitation lab/i }).click();
  await page.keyboard.press('ArrowUp');
  await stepTimes(page, 1);
  const row = (await recentRows(page))[0];
  expect(row).toEqual(expect.objectContaining({ ordinal: 1, velocity: 120 }));
  expect((await pointSnapshot(page)).readouts.velocity).toBe(120);
});

test('[F2P] STEP, PLAY, PAUSE, and STEP append consecutive rows to one trial.', async ({ page }) => {
  await stepTimes(page, 1);
  await playUntil(page, 4);
  await pause(page);
  const before = await publicSnapshot(page);
  await stepTimes(page, 1);
  const after = await publicSnapshot(page);
  expect(after.trial).toBe(before.trial);
  expect(after.samples).toBe(before.samples + 1);
  expect(after.rows.at(-1).ordinal).toBe(before.samples + 1);
  expect(Math.abs(after.elapsed - before.elapsed - 1 / 60)).toBeLessThan(0.002);
});

// Clock and retention boundaries

for (const [count, elapsed] of [[60, 1]]) {
  test(`[F2P] ${count} STEPs produce sample ${count} at ${elapsed.toFixed(3)} seconds.`, async ({ page }) => {
    await stepTimes(page, count);
    expect({
      samples: await metric(page, 'History samples telemetry'),
      retained: await metric(page, 'Retained samples telemetry'),
      elapsed: await metric(page, 'Elapsed time telemetry'),
      latest: (await recentRows(page)).at(-1).ordinal,
    }).toEqual({ samples: count, retained: count, elapsed, latest: count });
  });
}

test('[F2P] Sample 301 advances the clock while retaining only the latest 300 rows.', async ({ page }) => {
  test.setTimeout(90000);
  await stepTimes(page, 301);
  const snapshot = await publicSnapshot(page);
  expect({
    samples: snapshot.samples,
    retained: snapshot.retained,
    elapsed: snapshot.elapsed,
    recentOrdinals: snapshot.rows.map(row => row.ordinal),
  }).toEqual({
    samples: 301,
    retained: 300,
    elapsed: 5.017,
    recentOrdinals: [294, 295, 296, 297, 298, 299, 300, 301],
  });
});

test('[F2P] A capped trial reloads and continues with sample 302.', async ({ page }) => {
  test.setTimeout(90000);
  await stepTimes(page, 301);
  await reloadReady(page);
  await stepTimes(page, 1);
  expect({
    samples: await metric(page, 'History samples telemetry'),
    retained: await metric(page, 'Retained samples telemetry'),
    elapsed: await metric(page, 'Elapsed time telemetry'),
    latest: (await recentRows(page)).at(-1).ordinal,
  }).toEqual({ samples: 302, retained: 300, elapsed: 5.033, latest: 302 });
});

// Keyboard guide barrier

test('[F2P] Every run-changing shortcut is inert over a paused trial while help is open.', async ({ page }) => {
  await stepTimes(page, 3);
  const before = await publicSnapshot(page);
  await page.getByRole('button', { name: /keys/i }).click();
  for (const key of ['Space', 'ArrowUp', 'ArrowRight', '5', 'r']) await page.keyboard.press(key);
  expect(await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).isVisible()).toBe(true);
  expect(await publicSnapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
});

test('[F2P] Opening help during playback pauses once and blocks every run-changing shortcut.', async ({ page }) => {
  await playUntil(page, 4);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  const frozen = await publicSnapshot(page);
  expect(frozen.paused).toBe(true);
  for (const key of ['Space', 'ArrowDown', 'ArrowRight', '4', 'R']) await page.keyboard.press(key);
  await twoFrames(page);
  expect(await publicSnapshot(page)).toEqual(frozen);
});

// Frozen A/B comparison shelf

test('[F2P] Pin controls are available only for a sampled paused trial.', async ({ page }) => {
  const reference = page.getByRole('button', { name: /pin reference/i });
  const candidate = page.getByRole('button', { name: /pin candidate/i });
  await expect(reference).toBeDisabled();
  await expect(candidate).toBeDisabled();
  await stepTimes(page, 1);
  await expect(reference).toBeEnabled();
  await expect(candidate).toBeEnabled();
  await page.getByRole('button', { name: /play/i }).click();
  await expect(reference).toBeDisabled();
  await expect(candidate).toBeDisabled();
});

test('[F2P] Reference pins the latest immutable sample rather than live controls.', async ({ page }) => {
  await setPoint(page, { velocity: 37.5, depth: 61, temp: 33 });
  await stepTimes(page, 3);
  const latest = (await recentRows(page)).at(-1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  expect(await pinSnapshot(page, 'Reference')).toEqual({
    trial: latest.trial,
    ordinal: latest.ordinal,
    velocity: latest.velocity,
    depth: latest.depth,
    temp: latest.temp,
    Cd: latest.Cd,
    drag: latest.drag,
  });
});

test('[F2P] Candidate remains independent and reports Candidate minus Reference.', async ({ page }) => {
  await setPoint(page, { velocity: 37.5, depth: 61, temp: 33 });
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  const reference = await pinSnapshot(page, 'Reference');
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  const comparison = await comparisonSnapshot(page);
  expect(comparison.reference).toEqual(reference);
  expect(comparison.candidate).toEqual(expect.objectContaining({
    velocity: 100,
    depth: 100,
    temp: 20,
    ordinal: 1,
  }));
  expect(Math.abs(comparison.cdDelta - (comparison.candidate.Cd - reference.Cd))).toBeLessThan(0.0002);
  expect(Math.abs(comparison.dragDelta - (comparison.candidate.drag - reference.drag))).toBeLessThan(0.2);
});

test('[F2P] Starting another trial cannot mutate either pinned comparison.', async ({ page }) => {
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  const before = await comparisonSnapshot(page);
  await setPoint(page, { velocity: 43.5, depth: 137, temp: 73 });
  expect(await comparisonSnapshot(page)).toEqual(before);
});

test('[F2P] Re-pinning Candidate overwrites only Candidate.', async ({ page }) => {
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  const reference = await pinSnapshot(page, 'Reference');
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  await selectPreset(page, 'Shallow Sprint', 80);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  expect(await pinSnapshot(page, 'Reference')).toEqual(reference);
  expect(await pinSnapshot(page, 'Candidate')).toEqual(expect.objectContaining({
    velocity: 80,
    depth: 5,
    temp: 20,
    ordinal: 1,
  }));
});

test('[F2P] SWAP exchanges both pins and reverses both delta signs.', async ({ page }) => {
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  const before = await comparisonSnapshot(page);
  expect(before.reference.velocity).toBe(20);
  expect(before.candidate.velocity).toBe(100);
  expect(Math.abs(before.dragDelta)).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'SWAP', exact: true }).click();
  const after = await comparisonSnapshot(page);
  expect(after.reference).toEqual(before.candidate);
  expect(after.candidate).toEqual(before.reference);
  expect(Math.abs(after.cdDelta + before.cdDelta)).toBeLessThan(0.0002);
  expect(Math.abs(after.dragDelta + before.dragDelta)).toBeLessThan(0.2);
});

test('[F2P] Both comparison pins and deltas survive reload.', async ({ page }) => {
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  const before = await comparisonSnapshot(page);
  await reloadReady(page);
  expect(await comparisonSnapshot(page)).toEqual(before);
});

test('[F2P] RESET starts another active trial without clearing comparison pins.', async ({ page }) => {
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  const before = await comparisonSnapshot(page);
  await page.getByRole('button', { name: /reset/i }).click();
  expect(await comparisonSnapshot(page)).toEqual(before);
  await reloadReady(page);
  expect(await comparisonSnapshot(page)).toEqual(before);
});

test('[F2P] CLEAR removes both pins and keeps the shelf empty after reload.', async ({ page }) => {
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  await page.getByRole('button', { name: 'CLEAR', exact: true }).click();
  expect(Number.isFinite((await comparisonSnapshot(page)).reference.trial)).toBe(false);
  expect(Number.isFinite((await comparisonSnapshot(page)).candidate.trial)).toBe(false);
  await expect(page.getByRole('button', { name: 'SWAP', exact: true })).toBeDisabled();
  await reloadReady(page);
  expect(Number.isFinite((await comparisonSnapshot(page)).reference.trial)).toBe(false);
  expect(Number.isFinite((await comparisonSnapshot(page)).candidate.trial)).toBe(false);
});

test('[F2P] Comparison cards and deltas remain separated inside a phone viewport.', async ({ page }) => {
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin reference/i }).click();
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 1);
  await page.getByRole('button', { name: /pin candidate/i }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await twoFrames(page);
  const cards = [
    await page.getByLabel('Reference pin').boundingBox(),
    await page.getByLabel('Candidate pin').boundingBox(),
    await page.getByLabel('Comparison deltas').boundingBox(),
  ];
  for (const box of cards) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  }
  expect(overlaps(cards[0], cards[1])).toBe(false);
  expect(overlaps(cards[1], cards[2])).toBe(false);
});

// Responsive workbench and history

test('[F2P] Populated history remains below a substantial phone flow view.', async ({ page }) => {
  await stepTimes(page, 8);
  await page.setViewportSize({ width: 390, height: 844 });
  await twoFrames(page);
  const flow = await page.getByLabel('Flow visualization').boundingBox();
  const table = await page.getByRole('region', { name: 'Recent samples' }).getByRole('table').boundingBox();
  expect(visibleHeight(flow, 844)).toBeGreaterThanOrEqual(220);
  expect(overlaps(flow, table)).toBe(false);
});

test('[F2P] Large telemetry and recent rows stay inside a 375-pixel viewport.', async ({ page }) => {
  await selectPreset(page, 'Supercav', 100);
  await stepTimes(page, 8);
  await page.setViewportSize({ width: 375, height: 812 });
  await twoFrames(page);
  const candidates = [
    page.getByLabel('Power telemetry'),
    page.getByLabel('Drag force telemetry'),
    page.getByLabel('Kinetic energy telemetry'),
    page.getByRole('region', { name: 'Recent samples' }).getByRole('table'),
  ];
  for (const locator of candidates) {
    const box = await locator.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  }
});

test('[F2P] Simulation buttons and every preset remain inside the phone viewport.', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await twoFrames(page);
  const controls = [
    page.getByRole('button', { name: /play/i }),
    page.getByRole('button', { name: 'STEP', exact: true }),
    page.getByRole('button', { name: /reset/i }),
    ...['Gentle', 'Pre-Cav', 'Cavitating', 'Supercav', 'Shallow Sprint']
      .map(name => page.getByRole('button', { name, exact: true })),
  ];
  for (const locator of controls) {
    const box = await locator.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
});

test('[F2P] Every recent-sample row and cell is separated and unclipped on a phone.', async ({ page }) => {
  await stepTimes(page, 8);
  await page.setViewportSize({ width: 390, height: 844 });
  await twoFrames(page);
  const rows = page.getByRole('region', { name: 'Recent samples' }).getByRole('row');
  let previous = null;
  for (let index = 1; index < await rows.count(); index += 1) {
    const rowBox = await rows.nth(index).boundingBox();
    expect(rowBox.x).toBeGreaterThanOrEqual(0);
    expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(390);
    if (previous) expect(overlaps(previous, rowBox)).toBe(false);
    previous = rowBox;
    for (const cell of await rows.nth(index).getByRole('cell').all()) {
      const fit = await cell.evaluate(element => ({
        horizontal: element.scrollWidth <= element.clientWidth + 1,
        vertical: element.scrollHeight <= element.clientHeight + 1,
      }));
      expect(fit).toEqual({ horizontal: true, vertical: true });
    }
  }
});

test('[F2P] Live resizing preserves trial state and keeps the workbench and help reachable.', async ({ page }) => {
  await stepTimes(page, 8);
  const before = await publicSnapshot(page);
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.setViewportSize({ width: 375, height: 640 });
  await twoFrames(page);
  expect(await publicSnapshot(page)).toEqual(before);
  const flow = await page.getByLabel('Flow visualization').boundingBox();
  expect(visibleHeight(flow, 640)).toBeGreaterThan(100);
  await page.getByRole('button', { name: /keys/i }).click();
  const close = await page.getByRole('button', { name: 'Close keyboard shortcuts' }).boundingBox();
  expect(close.x).toBeGreaterThanOrEqual(0);
  expect(close.x + close.width).toBeLessThanOrEqual(375);
  expect(close.y).toBeGreaterThanOrEqual(0);
  expect(close.y + close.height).toBeLessThanOrEqual(640);
});
