// Local stand-in for the container's runner: borrows the system Chrome so the
// suite can be driven against both trees without waiting on a download.
module.exports = {
  testDir: process.env.SPEC_DIR,
  testMatch: '*.spec.js',
  testIgnore: ['**/node_modules/**'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 8000 },
  use: {
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
    actionTimeout: 8000,
    navigationTimeout: 20000
  }
};
