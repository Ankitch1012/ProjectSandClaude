module.exports = {
  testDir: __dirname,
  testMatch: '*.spec.js',
  testIgnore: ['**/node_modules/**'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    viewport: { width: 1280, height: 900 },
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    ignoreHTTPSErrors: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure'
  }
};
