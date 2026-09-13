const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

const FIXTURE_PATH = '/logs/verifier/fixture.json';

const ARTIFACTS = process.env.ARTIFACTS_DIR || '/logs/artifacts';
try {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
} catch (e) {
  void e;
}

async function snap(page, name) {
  try {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(ARTIFACTS, name), fullPage: true });
    }
  } catch (e) {
    void e;
  }
}

function writeJson(name, data) {
  try {
    fs.writeFileSync(path.join(ARTIFACTS, name), JSON.stringify(data, null, 2));
  } catch (e) {
    void e;
  }
}

function readFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function uniqueId(tag) {
  return `qa.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
}

function recordNetwork(page) {
  const events = [];
  page.on('response', (resp) => {
    events.push({
      method: resp.request().method(),
      url: resp.url(),
      status: resp.status()
    });
  });
  return events;
}

test('[F2P][D1] <observable symptom the broken app gets wrong>', async ({ page }) => {
  const network = recordNetwork(page);
  try {
    await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading').first(),
      'state here what MUST be true once the defect is fixed'
    ).toBeVisible();
  } finally {
    await snap(page, 'd1_final_page.png');
    writeJson('d1_network.json', network);
  }
});

test('[P2P] <behavior that already works and must keep working>', async ({ request }) => {
  const resp = await request.get(`${BACKEND}/`, { failOnStatusCode: false });
  expect(
    resp.status(),
    'the backend must still respond after the fix'
  ).toBeLessThan(500);
});
