import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fingerprint, sourceProvenance } from './provenance.mjs';

const root = resolve(import.meta.dirname, '../..');
const artifact = resolve(root, 'artifacts/visual/drawer-touch.json');
const urls = {
  react: process.env.SOLID_CN_REACT_VISUAL_URL ?? 'http://127.0.0.1:5181',
  solid: process.env.SOLID_CN_SOLID_VISUAL_URL ?? 'http://127.0.0.1:5182',
};
const cases = ['docs-drawer-dialog-default', 'docs-drawer-demo-default'];
const widths = [390, 544];
const sourceBefore = await sourceProvenance();
const browser = await chromium.launch({ headless: true });
const results = [];

async function openDrawer(page, framework, caseId) {
  await page.goto(`${urls[framework]}/?case=${caseId}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__visualReady === true || !!window.__visualError);
  const previewError = await page.evaluate(() => window.__visualError);
  if (previewError) throw new Error(`Preview error: ${JSON.stringify(previewError)}`);
  await page.locator('[data-slot="drawer-trigger"]').click();
  await page.locator('[data-slot="drawer-popup"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

async function touchDrag(page, points, onMove) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ x: points[0].x, y: points[0].y, id: 1 }],
    });
    for (const point of points.slice(1)) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: point.x, y: point.y, id: 1 }],
      });
      await page.waitForTimeout(28);
      await onMove?.();
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

async function checkCrossAxis(framework) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1,
    locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light',
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await openDrawer(page, framework, 'docs-drawer-dialog-default');
    const header = await page.locator('[data-slot="drawer-header"]').boundingBox();
    const popup = page.locator('[data-slot="drawer-popup"]');
    const initialTop = (await popup.boundingBox()).y;
    const x = Math.round(header.x + header.width / 2);
    const y = Math.round(header.y + Math.min(20, header.height / 2));
    const dragPx = [];
    await touchDrag(page, [0, 20, 60, 100, 130].map((distance) => ({ x: x + distance, y })),
      async () => dragPx.push(await popup.evaluate(
        (element, top) => Math.round(element.getBoundingClientRect().top - top), initialTop,
      )));
    await page.waitForTimeout(100);
    const expanded = await page.locator('[data-slot="drawer-trigger"]').getAttribute('aria-expanded');
    const peakDragPx = Math.max(...dragPx.map(Math.abs));
    const errors = [];
    if (peakDragPx > 4) errors.push(`Cross-axis touch moved the Drawer ${peakDragPx}px.`);
    if (expanded !== 'true' || await popup.count() !== 1)
      errors.push('Cross-axis touch closed the Drawer.');
    return { kind: 'cross-axis', framework, caseId: 'docs-drawer-dialog-default', width: 390,
      passed: errors.length === 0, dragPx, peakDragPx, expanded, errors };
  } finally {
    await context.close();
  }
}

async function checkSwipe(framework, caseId, width) {
  const context = await browser.newContext({
    viewport: { width, height: 844 }, hasTouch: true, deviceScaleFactor: 1,
    locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light',
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    await openDrawer(page, framework, caseId);
    const header = await page.locator('[data-slot="drawer-header"]').boundingBox();
    const popup = await page.locator('[data-slot="drawer-popup"]').boundingBox();
    const x = Math.round(header.x + header.width / 2);
    const y = Math.round(header.y + Math.min(20, header.height / 2));
    if (y + 250 >= 844) throw new Error('The swipe path is outside the viewport.');
    await page.evaluate(() => {
      window.__drawerTouchEvents = [];
      document.addEventListener('pointercancel', () =>
        window.__drawerTouchEvents.push({ type: 'pointercancel' }), true);
      document.addEventListener('pointerup', () =>
        window.__drawerTouchEvents.push({ type: 'pointerup' }), true);
      document.addEventListener('touchmove', (event) =>
        window.__drawerTouchEvents.push({ type: 'touchmove', prevented: event.defaultPrevented }), true);
    });
    const session = await context.newCDPSession(page);
    const dragPx = [];
    try {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x, y, id: 1 }],
      });
      for (const distance of [20, 70, 130, 190, 250]) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x, y: y + distance, id: 1 }],
        });
        await page.waitForTimeout(28);
        dragPx.push(await page.locator('[data-slot="drawer-popup"]').evaluate(
          (element, top) => Math.round(element.getBoundingClientRect().top - top), popup.y,
        ));
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
      await session.detach();
    }
    await page.waitForTimeout(550);
    const state = await page.evaluate(() => ({
      expanded: document.querySelector('[data-slot="drawer-trigger"]')?.getAttribute('aria-expanded'),
      popupPresent: !!document.querySelector('[data-slot="drawer-popup"]'),
      portalPresent: !!document.querySelector('[data-base-ui-portal]'),
      bodyOverflow: getComputedStyle(document.body).overflow,
      hostInert: document.querySelector('#visual-case').inert,
      events: window.__drawerTouchEvents,
    }));
    const peakDragPx = Math.max(...dragPx);
    const errors = [];
    if (peakDragPx < 80) errors.push(`Drawer moved only ${peakDragPx}px during the touch drag.`);
    if (state.expanded !== 'false') errors.push('Drawer did not close on touch release.');
    if (state.popupPresent || state.portalPresent) errors.push('Drawer layer remained after exit.');
    if (state.bodyOverflow === 'hidden' || state.hostInert) errors.push('Modal state remained after close.');
    if (state.events.some((event) => event.type === 'pointercancel'))
      errors.push('Browser canceled the touch pointer.');
    if (!state.events.some((event) => event.type === 'touchmove' && event.prevented))
      errors.push('Drawer did not claim any touchmove event.');
    if (browserErrors.length) errors.push(...browserErrors);
    return { kind: 'swipe', framework, caseId, width, passed: errors.length === 0,
      dragPx, peakDragPx, state, errors };
  } finally {
    await context.close();
  }
}

async function checkScrollableContent(framework) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 600 }, hasTouch: true, deviceScaleFactor: 1,
    locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light',
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await openDrawer(page, framework, 'docs-drawer-demo-default');
    const scroller = page.locator('.scroll-fade');
    const box = await scroller.boundingBox();
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height * 0.7);
    await touchDrag(page, [0, 20, 60, 100, 130].map((distance) => ({ x, y: y - distance })));
    await page.waitForTimeout(100);
    const state = await scroller.evaluate((element) => ({
      scrollTop: element.scrollTop,
      maxScroll: element.scrollHeight - element.clientHeight,
      expanded: document.querySelector('[data-slot="drawer-trigger"]')?.getAttribute('aria-expanded'),
    }));
    const errors = [];
    if (state.maxScroll < 20) errors.push('The content was not scrollable.');
    if (state.scrollTop < 10) errors.push('Touch drag did not scroll the content.');
    if (state.expanded !== 'true') errors.push('Scrolling closed the Drawer.');
    return { kind: 'scroll', framework, caseId: 'docs-drawer-demo-default', width: 390,
      passed: errors.length === 0, state, errors };
  } finally {
    await context.close();
  }
}

try {
  for (const caseId of cases) {
    for (const width of widths) {
      for (const framework of ['react', 'solid']) {
        try {
          const result = await checkSwipe(framework, caseId, width);
          results.push(result);
          console.log(`${result.passed ? 'PASS' : 'FAIL'} ${framework} ${caseId} ${width}: ${result.errors.join(' ') || `${result.peakDragPx}px drag, closed`}`);
        } catch (error) {
          results.push({ kind: 'swipe', framework, caseId, width, passed: false, errors: [error.message] });
          console.error(`FAIL ${framework} ${caseId} ${width}: ${error.message}`);
        }
      }
    }
  }
  for (const framework of ['react', 'solid']) {
    try {
      const result = await checkScrollableContent(framework);
      results.push(result);
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${framework} scroll guard: ${result.errors.join(' ') || `${result.state.scrollTop}px scroll`}`);
    } catch (error) {
      results.push({ kind: 'scroll', framework, passed: false, errors: [error.message] });
      console.error(`FAIL ${framework} scroll guard: ${error.message}`);
    }
  }
  for (const framework of ['react', 'solid']) {
    try {
      const result = await checkCrossAxis(framework);
      results.push(result);
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${framework} cross-axis guard: ${result.errors.join(' ') || 'Drawer stayed open and still'}`);
    } catch (error) {
      results.push({ kind: 'cross-axis', framework, passed: false, errors: [error.message] });
      console.error(`FAIL ${framework} cross-axis guard: ${error.message}`);
    }
  }
} finally {
  await browser.close();
}

const sourceAfter = await sourceProvenance();
const sourcesChangedDuringRun = [...new Set([...Object.keys(sourceBefore), ...Object.keys(sourceAfter)])]
  .filter((path) => sourceBefore[path] !== sourceAfter[path]);
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  urls, cases, widths,
  sourceFingerprintBefore: fingerprint(sourceBefore),
  sourceFingerprintAfter: fingerprint(sourceAfter),
  sourcesChangedDuringRun,
  passed: results.every((result) => result.passed) && sourcesChangedDuringRun.length === 0,
  results,
};
await mkdir(resolve(root, 'artifacts/visual'), { recursive: true });
await writeFile(artifact, JSON.stringify(report, null, 2) + '\n');
console.log(`Drawer touch report: ${artifact}`);
if (!report.passed) process.exitCode = 1;
