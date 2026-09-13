'use strict';

// Photograph the desk in both states, on the same crib at the same width.

const { chromium } = require('./pw/node_modules/@playwright/test');

const URL = process.env.SHOT_URL || 'http://127.0.0.1:3091';
const OUT = process.env.SHOT_OUT || '/tmp/shot.png';
const VIEWPORT = { width: 1280, height: 900 };

const CRIB = [
  '*3s+4s on opposite sides*',
  '1-2 : 3s+4s cross RH',
  '3-8 : 1s+2s circle 4H round, 1s+2s set',
  '9-12 : 1s+2s dance RH across',
  '13-16 : 1s+2s dance LH across',
  '17-20 : 1s+2s 1/2 poussette',
  '21-24 : 1s+2s 1/2 poussette',
  '25-28 : 1s+2s 1/2 poussette',
  '29-32 : 1s+2s dance RH across'
].join('\n');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: VIEWPORT });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-ready="yes"]');
  await page.fill('[data-testid="bars"]', '32');
  await page.fill('[data-testid="crib-text"]', CRIB);
  await page.click('[data-testid="check"]');
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="source-line"]').length === n,
    CRIB.split('\n').length
  );
  await page.evaluate(() => {
    document.getElementById('crib-text').scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(250);

  const measured = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const middleY = (el) => {
      const b = el.getBoundingClientRect();
      return b.top + b.height / 2;
    };
    const middleX = (el) => {
      const b = el.getBoundingClientRect();
      return b.left + b.width / 2;
    };
    const gutter = Array.from(document.querySelectorAll('[data-testid="gutter-line"]'));
    const source = Array.from(document.querySelectorAll('[data-testid="source-line"]'));
    const headings = Array.from(document.querySelectorAll('[data-testid="place-header"]'));
    const tokens = Array.from(
      document.querySelectorAll('[data-testid="set-row"]')[0].querySelectorAll('[data-testid="place-token"]')
    );
    return {
      faultsListed: document.querySelectorAll('[data-testid="fault"]').length,
      announced: document.getElementById('verdict').getAttribute('data-fault-count'),
      verdict: document.getElementById('verdict').textContent,
      worstMarginDrift: Math.max(
        ...gutter.map((g, i) => Math.abs(middleY(g) - middleY(source[i])))
      ).toFixed(1),
      lastMarginDrift: Math.abs(middleY(gutter[gutter.length - 1]) - middleY(source[source.length - 1])).toFixed(1),
      worstHeadingOffset: Math.max(...headings.map((h, i) => Math.abs(middleX(h) - middleX(tokens[i])))).toFixed(1)
    };
  });

  await page.screenshot({ path: OUT, fullPage: true });
  console.log(`${OUT}  ${JSON.stringify(measured)}`);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
