module.exports = {
  testDir: __dirname,
  testMatch: '*.spec.js',
  testIgnore: ['**/node_modules/**'],
  outputDir: process.env.ARTIFACTS_DIR || '/logs/artifacts/playwright',
  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    channel: process.env.PW_CHANNEL || undefined,
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: 'on',
    trace: 'off'
  }
};
