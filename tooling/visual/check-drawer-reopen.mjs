import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fingerprint, sourceProvenance } from './provenance.mjs';

const root = resolve(import.meta.dirname, '../..');
const artifact = resolve(root, 'artifacts/visual/drawer-reopen.json');
const caseId = 'docs-drawer-demo-default';
const urls = {
  react: process.env.SOLID_CN_REACT_VISUAL_URL ?? 'http://127.0.0.1:5181',
  solid: process.env.SOLID_CN_SOLID_VISUAL_URL ?? 'http://127.0.0.1:5182',
};
const viewports = [
  { name: 'desktop', width: 1000, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];
const sourceBefore = await sourceProvenance();
const browser = await chromium.launch({ headless: true });
const results = [];

async function check(framework, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    await page.goto(`${urls[framework]}/?case=${caseId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__visualReady === true || !!window.__visualError);
    const previewError = await page.evaluate(() => window.__visualError);
    if (previewError) throw new Error(`Preview error: ${JSON.stringify(previewError)}`);

    const trigger = page.locator('[data-slot="drawer-trigger"]');
    const content = page.locator('[data-slot="drawer-content"]');
    const close = page.locator('[data-slot="drawer-close"]').last();
    const viewportNode = page.locator('[data-slot="drawer-viewport"]');
    const cycles = [];
    for (let cycle = 1; cycle <= 3; cycle++) {
      if (await trigger.getAttribute('aria-expanded') !== 'false')
        throw new Error(`Cycle ${cycle}: trigger was not closed before click.`);
      await trigger.click();
      await content.waitFor({ state: 'visible' });
      if (await trigger.getAttribute('aria-expanded') !== 'true')
        throw new Error(`Cycle ${cycle}: trigger did not open the Drawer.`);

      await close.click();
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
      const exit = await page.evaluate(() => {
        const triggerNode = document.querySelector('[data-slot="drawer-trigger"]');
        const rectangle = triggerNode.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rectangle.x + rectangle.width / 2,
          rectangle.y + rectangle.height / 2,
        );
        return {
          expanded: triggerNode.getAttribute('aria-expanded'),
          viewportPresent: !!document.querySelector('[data-slot="drawer-viewport"]'),
          bodyOverflow: getComputedStyle(document.body).overflow,
          hostInert: document.querySelector('#visual-case').inert,
          triggerHit: hit === triggerNode || triggerNode.contains(hit),
          hitSlot: hit?.getAttribute('data-slot') ?? null,
        };
      });
      if (exit.expanded !== 'false')
        throw new Error(`Cycle ${cycle}: trigger remained expanded after Cancel.`);
      if (exit.bodyOverflow === 'hidden' || exit.hostInert || !exit.triggerHit)
        throw new Error(`Cycle ${cycle}: closed Drawer blocked the trigger: ${JSON.stringify(exit)}`);

      await viewportNode.waitFor({ state: 'detached', timeout: 2000 });
      const settled = await page.evaluate(() => ({
        portals: document.querySelectorAll('[data-base-ui-portal]').length,
        backdrops: document.querySelectorAll('[data-slot="drawer-overlay"]').length,
        bodyOverflow: getComputedStyle(document.body).overflow,
        hostInert: document.querySelector('#visual-case').inert,
      }));
      if (settled.portals || settled.backdrops || settled.bodyOverflow === 'hidden' || settled.hostInert)
        throw new Error(`Cycle ${cycle}: close cleanup did not finish: ${JSON.stringify(settled)}`);
      cycles.push({ cycle, exit, settled });
    }
    if (browserErrors.length) throw new Error(browserErrors.join('\n'));
    return { framework, viewport: viewport.name, passed: true, cycles };
  } finally {
    await context.close();
  }
}

try {
  for (const viewport of viewports) {
    for (const framework of ['react', 'solid']) {
      try {
        const result = await check(framework, viewport);
        results.push(result);
        console.log(`PASS ${framework} ${viewport.name}: 3 open/cancel cycles`);
      } catch (error) {
        results.push({ framework, viewport: viewport.name, passed: false, error: error.message });
        console.error(`FAIL ${framework} ${viewport.name}: ${error.message}`);
      }
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
  caseId,
  urls,
  sourceFingerprintBefore: fingerprint(sourceBefore),
  sourceFingerprintAfter: fingerprint(sourceAfter),
  sourcesChangedDuringRun,
  passed: results.every((result) => result.passed) && sourcesChangedDuringRun.length === 0,
  results,
};
await mkdir(resolve(root, 'artifacts/visual'), { recursive: true });
await writeFile(artifact, JSON.stringify(report, null, 2) + '\n');
console.log(`Drawer reopen report: ${artifact}`);
if (!report.passed) process.exitCode = 1;
