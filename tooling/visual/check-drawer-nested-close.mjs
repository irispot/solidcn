import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fingerprint, sourceProvenance } from './provenance.mjs';

const root = resolve(import.meta.dirname, '../..');
const artifact = resolve(root, 'artifacts/visual/drawer-nested-close.json');
const caseId = 'docs-drawer-nested-default';
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
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`${urls[framework]}/?case=${caseId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__visualReady === true || !!window.__visualError);
    const previewError = await page.evaluate(() => window.__visualError);
    if (previewError) throw new Error(`Preview error: ${JSON.stringify(previewError)}`);

    await page.getByRole('button', { name: 'Open Drawer', exact: true }).click();
    await page.getByRole('button', { name: 'Open Nested Drawer', exact: true }).click();
    await page.waitForTimeout(550);
    const before = await page.evaluate(() => {
      const parent = document.querySelector('[data-slot="drawer-popup"]');
      const content = parent?.querySelector('[data-slot="drawer-content"]');
      return {
        popupCount: document.querySelectorAll('[data-slot="drawer-popup"]').length,
        nested: parent?.hasAttribute('data-nested-drawer-open'),
        opacity: content ? Number(getComputedStyle(content).opacity) : null,
      };
    });
    if (before.popupCount !== 2 || !before.nested || before.opacity > 0.05)
      throw new Error(`Initial nested state is not dimmed: ${JSON.stringify(before)}`);

    await page.evaluate(() => {
      window.__nestedCloseSamples = [];
      document.addEventListener('click', (event) => {
        if (!event.target.closest('[data-slot="drawer-close"]')) return;
        const start = performance.now();
        function sample() {
          const popups = document.querySelectorAll('[data-slot="drawer-popup"]');
          const parent = popups[0];
          const child = popups[1];
          const content = parent?.querySelector('[data-slot="drawer-content"]');
          const parentStyle = parent ? getComputedStyle(parent) : null;
          window.__nestedCloseSamples.push({
            ms: Math.round(performance.now() - start),
            popupCount: popups.length,
            nested: parent?.hasAttribute('data-nested-drawer-open') ?? null,
            contentOpacity: content ? Number(getComputedStyle(content).opacity) : null,
            parentFilter: parentStyle?.filter ?? null,
            parentTransform: parentStyle?.transform ?? null,
            childEnding: child?.hasAttribute('data-ending-style') ?? null,
          });
          if (performance.now() - start < 850) requestAnimationFrame(sample);
        }
        sample();
      }, { capture: true, once: true });
    });
    await page.locator('[data-slot="drawer-close"]').last().click();
    await page.waitForTimeout(950);
    const samples = await page.evaluate(() => window.__nestedCloseSamples);
    if (!samples?.length) throw new Error('No close frames were recorded.');
    const nestedCleared = samples.find((sample) => sample.nested === false)?.ms ?? null;
    const opacityHalf = samples.find((sample) => sample.contentOpacity >= 0.5)?.ms ?? null;
    const childUnmounted = samples.find((sample) => sample.popupCount === 1)?.ms ?? null;
    if (errors.length) throw new Error(errors.join('\n'));
    if (nestedCleared === null || opacityHalf === null || childUnmounted === null)
      throw new Error(`Close did not settle: ${JSON.stringify({ nestedCleared, opacityHalf, childUnmounted })}`);
    return {
      framework,
      viewport: viewport.name,
      before,
      nestedClearedMs: nestedCleared,
      opacityHalfMs: opacityHalf,
      childUnmountedMs: childUnmounted,
      samples,
    };
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
        console.log(`${framework} ${viewport.name}: parent clears nested state at ${result.nestedClearedMs} ms, reaches half opacity at ${result.opacityHalfMs} ms; child leaves at ${result.childUnmountedMs} ms`);
      } catch (error) {
        results.push({ framework, viewport: viewport.name, error: error.message });
        console.error(`FAIL ${framework} ${viewport.name}: ${error.message}`);
      }
    }
  }
} finally {
  await browser.close();
}

const comparisons = viewports.map(({ name }) => {
  const react = results.find((result) => result.framework === 'react' && result.viewport === name);
  const solid = results.find((result) => result.framework === 'solid' && result.viewport === name);
  const passed = !react?.error && !solid?.error &&
    solid.nestedClearedMs <= react.nestedClearedMs + 80 &&
    solid.opacityHalfMs <= react.opacityHalfMs + 80;
  return {
    viewport: name,
    passed,
    nestedDelayMs: react?.nestedClearedMs == null || solid?.nestedClearedMs == null
      ? null : solid.nestedClearedMs - react.nestedClearedMs,
    opacityHalfDelayMs: react?.opacityHalfMs == null || solid?.opacityHalfMs == null
      ? null : solid.opacityHalfMs - react.opacityHalfMs,
  };
});
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
  passed: comparisons.every((comparison) => comparison.passed) && sourcesChangedDuringRun.length === 0,
  comparisons,
  results,
};
await mkdir(resolve(root, 'artifacts/visual'), { recursive: true });
await writeFile(artifact, JSON.stringify(report, null, 2) + '\n');
console.log(`Nested Drawer close report: ${artifact}`);
if (!report.passed) process.exitCode = 1;
