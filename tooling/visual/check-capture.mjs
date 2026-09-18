import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { settleCapture } from './settle-capture.mjs';
import { comparePng } from './compare.mjs';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 300, height: 200 } });
  await page.setContent('<div id="box" style="width:40px;height:20px;background:black"></div>');
  await page.evaluate(() => {
    const box = document.querySelector('#box');
    const first = box.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 80,
      delay: 30,
    });
    first.onfinish = () => {
      box.animate([{ transform: 'translateX(20px)' }, { transform: 'none' }], {
        duration: 80,
      });
    };
  });
  const finite = await settleCapture(page);
  assert.equal(finite.animations.length, 2, 'Chained finite animations must finish');
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);

  await page.evaluate(() => {
    const box = document.querySelector('#box');
    window.spin = box.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
      duration: 1000,
      iterations: Infinity,
    });
  });
  const infinite = await settleCapture(page);
  assert.equal(infinite.animations[0].policy, 'pause-at-time-zero');
  assert.equal(await page.evaluate(() => window.spin.currentTime), 0);
  const before = await page.screenshot({ animations: 'allow' });
  await page.waitForTimeout(120);
  assert.equal(comparePng(before, await page.screenshot({ animations: 'allow' })).changedPixels, 0);
  await page.evaluate(() => {
    window.spin.currentTime = 350;
  });
  const paused = await settleCapture(page);
  assert.equal(paused.animations[0].policy, 'preserve-source-pose');
  assert.equal(await page.evaluate(() => window.spin.currentTime), 350);
  await page.evaluate(() => {
    window.spin.cancel();
  });

  await page.evaluate(() => {
    const box = document.querySelector('#box');
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 50 }).onfinish = () => box.remove();
  });
  await settleCapture(page);
  assert.equal(
    await page.locator('#box').count(),
    0,
    'Completion handlers must run before bounds checks',
  );

  await page.setContent('<div id="box" style="width:40px;height:20px;background:black"></div>');
  await page.evaluate(() => {
    window.long = document.querySelector('#box').animate([{ opacity: 0 }, { opacity: 1 }], 10000);
  });
  await assert.rejects(settleCapture(page, 150), /Finite animations did not finish/);
  await page.evaluate(() => {
    window.long.cancel();
  });
  const black = await page.screenshot();
  await page.locator('#box').evaluate((box) => {
    box.style.background = 'rgb(1,0,0)';
  });
  assert.ok(
    comparePng(black, await page.screenshot()).changedPixels > 0,
    'Real pixel changes must still fail',
  );
  await page.setContent(
    '<div id="scroll" style="height:100px;overflow:auto"><div style="height:300px"><div id="target" style="height:80px;background:black"></div></div></div>',
  );
  await page.evaluate(() => {
    const source = document.querySelector('#scroll');
    document.querySelector('#target').animate([{ opacity: 0 }, { opacity: 1 }], {
      timeline: new ScrollTimeline({ source, axis: 'block' }),
      fill: 'both',
    });
    source.scrollTop = 25;
  });
  const scrolling = await settleCapture(page);
  assert.equal(scrolling.animations[0].policy, 'preserve-progress-timeline');
  const opacity = await page
    .locator('#target')
    .evaluate((node) => Number(getComputedStyle(node).opacity));
  assert.ok(opacity > 0 && opacity < 1, 'Capture retains the actual scroll pose');
  await page.locator('#scroll').evaluate((node) => {
    node.scrollTop = 75;
  });
  await settleCapture(page);
  assert.ok(
    (await page.locator('#target').evaluate((node) => Number(getComputedStyle(node).opacity))) >
      opacity,
    'Scroll animations remain connected to actual scroll input',
  );
  console.log(
    'Static capture checks passed: chained motion, delay, infinite pose, source-paused pose, unmount, timeout, exact differences.',
  );
} finally {
  await browser.close();
}
