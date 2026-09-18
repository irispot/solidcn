import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { comparePng } from './visual/compare.mjs';
import { settleCapture } from './visual/settle-capture.mjs';

// This is an external browser check. It does not import or change upstream tests.
const urls = {
  react: process.env.SOLID_CN_REACT_VISUAL_URL ?? 'http://127.0.0.1:5181',
  solid: process.env.SOLID_CN_SOLID_VISUAL_URL ?? 'http://127.0.0.1:5182',
};
const output = new URL('../artifacts/drawer-browser/', import.meta.url);
const source = new URL('../base-ui/packages/solid/src/overlays.tsx', import.meta.url);
const hash = async () =>
  createHash('sha256')
    .update(await readFile(source))
    .digest('hex');
const report = {
  checkedAt: new Date().toISOString(),
  passed: false,
  sourceSha256: await hash(),
  environment: { viewport: { width: 900, height: 700 }, reducedMotion: 'reduce' },
  observations: {},
  comparisons: [],
  error: null,
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const captures = {};
async function pageFor(framework, example) {
  const page = await browser.newPage(report.environment);
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${urls[framework]}/?case=${example}`);
  await page.waitForFunction(() => window.__visualReady || window.__visualError);
  assert.equal(await page.evaluate(() => window.__visualError ?? null), null);
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}
async function capture(page, framework, stage) {
  await settleCapture(page);
  const image = await page.screenshot({
    path: new URL(`${framework}-${stage}.png`, output).pathname,
  });
  captures[framework][stage] = image;
  return page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role=dialog]').length,
    backdrops: document.querySelectorAll('[data-slot=drawer-overlay]').length,
    focus: document.activeElement?.getAttribute('data-slot'),
    popups: [...document.querySelectorAll('[data-slot=drawer-popup]')].map((element) => ({
      bounds: element.getBoundingClientRect().toJSON(),
      expanded: element.hasAttribute('data-expanded'),
      nested: element.hasAttribute('data-nested-drawer-open'),
      count: getComputedStyle(element).getPropertyValue('--nested-drawers'),
      offset: getComputedStyle(element).getPropertyValue('--drawer-snap-point-offset'),
    })),
  }));
}
try {
  for (const framework of Object.keys(urls)) {
    captures[framework] = {};
    const observations = (report.observations[framework] = {});
    const nested = await pageFor(framework, 'docs-drawer-nested-open-drawer');
    for (const [index, label] of [
      'Open Drawer',
      'Open Nested Drawer',
      'Open Third Drawer',
      'Open Fourth Drawer',
    ].entries()) {
      await nested.page.getByRole('button', { name: label, exact: true }).click();
      const state = await capture(nested.page, framework, `nested-${index + 1}`);
      assert.equal(state.dialogs, index + 1);
      assert.equal(state.backdrops, 1);
      assert.equal(state.focus, 'drawer-popup');
      assert.deepEqual(
        state.popups.map((popup) => Number(popup.count)),
        Array.from({ length: index + 1 }, (_, level) => index - level),
      );
      observations[`nested-${index + 1}`] = state;
    }
    for (let count = 3; count >= 0; count--) {
      await nested.page.getByRole('button', { name: 'Close', exact: true }).last().click();
      const state = await capture(nested.page, framework, `close-${count}`);
      assert.equal(state.dialogs, count);
      assert.equal(state.focus, 'drawer-trigger');
      observations[`close-${count}`] = state;
    }
    assert.deepEqual(nested.errors, []);
    await nested.page.close();

    const snap = await pageFor(framework, 'docs-drawer-snap-points-open-drawer');
    await snap.page.getByRole('button', { name: 'Open Snap Drawer' }).click();
    observations.compact = await capture(snap.page, framework, 'compact');
    assert.equal(observations.compact.popups[0].offset, '108px');
    const grip = await snap.page.locator('[data-slot=drawer-swipe-handle]').boundingBox();
    await snap.page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await snap.page.mouse.down();
    await snap.page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - 180, {
      steps: 12,
    });
    await snap.page.mouse.up();
    observations.expanded = await capture(snap.page, framework, 'expanded');
    assert.equal(observations.expanded.popups[0].expanded, true);
    assert.equal(observations.expanded.popups[0].offset, '0px');
    await snap.page.getByRole('button', { name: 'Close', exact: true }).click();
    await settleCapture(snap.page);
    assert.equal(await snap.page.locator('[role=dialog]').count(), 0);
    assert.deepEqual(snap.errors, []);
    await snap.page.close();

    const swipe = await pageFor(framework, 'docs-drawer-swipe-handle-open-drawer');
    await swipe.page.locator('[data-slot=drawer-trigger]').click();
    await settleCapture(swipe.page);
    const header = await swipe.page.locator('[data-slot=drawer-swipe-handle]').boundingBox();
    const direction = await swipe.page
      .locator('[data-slot=drawer-popup]')
      .getAttribute('data-swipe-direction');
    const vertical = direction === 'down' || direction === 'up';
    const startX = header.x + header.width / 2;
    const startY = header.y + header.height / 2;
    const distance = direction === 'up' || direction === 'left' ? -260 : 260;
    await swipe.page.mouse.move(startX, startY);
    await swipe.page.mouse.down();
    await swipe.page.mouse.move(
      startX + (vertical ? 0 : distance),
      startY + (vertical ? distance : 0),
      { steps: 12 },
    );
    await swipe.page.mouse.up();
    observations.dismissed = await capture(swipe.page, framework, 'dismissed');
    assert.equal(observations.dismissed.dialogs, 0);
    assert.equal(observations.dismissed.focus, 'drawer-trigger');
    assert.deepEqual(swipe.errors, []);
    await swipe.page.close();
  }
  for (const stage of Object.keys(captures.react)) {
    const { differencePng, ...result } = comparePng(captures.react[stage], captures.solid[stage]);
    report.comparisons.push({ stage, ...result });
    if (!result.passed) await writeFile(new URL(`difference-${stage}.png`, output), differencePng);
  }
  assert.equal(await hash(), report.sourceSha256, 'Native source changed during the check.');
  assert.ok(
    report.comparisons.every((result) => result.passed),
    'At least one full-viewport image differs.',
  );
  report.passed = true;
} catch (error) {
  report.error = error.stack ?? error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        comparisons: report.comparisons.map(({ stage, changedPixels }) => ({
          stage,
          changedPixels,
        })),
        error: report.error,
        report: new URL('report.json', output).pathname,
      },
      null,
      2,
    ),
  );
}
