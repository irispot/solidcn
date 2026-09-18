import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getExampleCases } from './example-catalog.mjs';
import { fingerprint, sourceProvenance } from './provenance.mjs';

const root = resolve(import.meta.dirname, '../..');
const artifact = resolve(root, 'artifacts/visual/first-popup-width.json');
const urls = {
  react: process.env.SOLID_CN_REACT_VISUAL_URL ?? 'http://127.0.0.1:5181',
  solid: process.env.SOLID_CN_SOLID_VISUAL_URL ?? 'http://127.0.0.1:5182',
};
const requested = process.argv.slice(2);
if (requested.length && (requested.length !== 2 || requested[0] !== '--case'))
  throw new Error('Use no argument for all popup cases, or --case <case-id>.');
const all = (await getExampleCases({ pages: ['combobox', 'dropdown-menu', 'select'], includeLocal: false }))
  .filter((item) => item.actions.some((action) => action.type === 'open') && item.popups.length);
const cases = requested.length ? all.filter((item) => item.id === requested[1]) : all;
if (!cases.length) throw new Error(`No configured popup case matches ${requested[1] ?? 'the three component pages'}.`);
const sourceBefore = await sourceProvenance();
const tolerance = (width) => Math.max(4, width * 0.01);
const browser = await chromium.launch({ headless: true });
const results = [];

async function capture(fixture, framework) {
  const context = await browser.newContext({
    viewport: { width: 900, height: 700 }, deviceScaleFactor: 1,
    locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light', reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    await page.goto(`${urls[framework]}/?case=${encodeURIComponent(fixture.id)}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__visualReady === true || !!window.__visualError);
    const previewError = await page.evaluate(() => window.__visualError);
    if (previewError) throw new Error(`Preview error: ${JSON.stringify(previewError)}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const action = fixture.actions.find((item) => item.type === 'open');
    const trigger = page.locator(action.selector);
    await trigger.waitFor({ state: 'visible' });
    if (await trigger.getAttribute('aria-expanded') === 'true')
      throw new Error('The popup is already open before the trigger action.');
    const triggerCss = action.selector.replace(/:visible\s*>>\s*nth=\d+$/, '');
    const popupCss = fixture.popups[0];
    async function traceOpen() {
      await page.evaluate(({ triggerCss, popupCss }) => {
      const frames = [];
      let active = true;
      let visibleCount = 0;
      const start = performance.now();
      const box = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      const opacity = (element) => {
        if (!element) return 0;
        let value = 1;
        for (let node = element; node instanceof Element; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return 0;
          value *= Number(style.opacity);
        }
        return value;
      };
      const sample = (time) => {
        if (!active) return;
        const anchor = document.querySelector(triggerCss);
        const popup = document.querySelector(popupCss);
        const popupBox = box(popup);
        const effectiveOpacity = opacity(popup);
        const positioner = popup?.parentElement;
        const styleDetails = (element) => {
          if (!element) return null;
          const style = getComputedStyle(element);
          return {
            element: element.tagName.toLowerCase(),
            slot: element.getAttribute('data-slot'),
            className: element.getAttribute('class'),
            startingStyle: element.getAttribute('data-starting-style'),
            inlineStyle: element.getAttribute('style'),
            anchorWidth: style.getPropertyValue('--anchor-width').trim(),
            width: style.width,
            opacity: style.opacity,
            transitionProperty: style.transitionProperty,
            transitionDuration: style.transitionDuration,
          };
        };
        const input = document.querySelector('[data-slot="combobox-input"]');
        const visible = Boolean(popupBox && popupBox.width > 0 && popupBox.height > 0 &&
          effectiveOpacity > 0.01);
        if (visible) visibleCount++;
        frames.push({ frame: frames.length, ms: Math.round((time - start) * 100) / 100,
          anchor: box(anchor), input: box(input), popup: popupBox, opacity: effectiveOpacity,
          popupStyle: styleDetails(popup), positionerStyle: styleDetails(positioner), visible });
        if (frames.length < 120) requestAnimationFrame(sample);
      };
      window.__firstPopupWidth = {
        frames,
        get visibleCount() { return visibleCount; },
        stop() { active = false; return { frames, visibleCount }; },
      };
        requestAnimationFrame(sample);
      }, { triggerCss, popupCss });
      await trigger.click();
      await page.waitForFunction(() => window.__firstPopupWidth.visibleCount >= 8, null, { timeout: 4000 });
      const trace = await page.evaluate(() => window.__firstPopupWidth.stop());
      const firstVisible = trace.frames.find((frame) => frame.visible);
      if (!firstVisible) throw new Error('The popup had no visible animation frame.');
      return { firstVisible, frames: trace.frames };
    }
    const firstOpen = await traceOpen();
    await page.keyboard.press('Escape');
    await page.waitForFunction((selector) =>
      document.querySelector(selector)?.getAttribute('aria-expanded') !== 'true',
    triggerCss, { timeout: 4000 });
    await page.evaluate(() => new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done))));
    const reopen = await traceOpen();
    if (browserErrors.length) throw new Error(browserErrors.join('\n'));
    return { phases: { firstOpen, reopen }, browserErrors,
      triggerSelector: action.selector, popupSelector: popupCss };
  } finally {
    await context.close();
  }
}

try {
  for (const fixture of cases) {
    const result = { id: fixture.id, component: fixture.component, passed: false,
      react: null, solid: null, errors: [] };
    for (const framework of ['react', 'solid']) {
      try { result[framework] = await capture(fixture, framework); }
      catch (error) { result.errors.push(`${framework}: ${error.message}`); }
    }
    if (result.react && result.solid) {
      result.comparison = {};
      for (const phase of ['firstOpen', 'reopen']) {
        const reference = result.react.phases[phase].firstVisible;
        const native = result.solid.phases[phase].firstVisible;
        const widthDelta = Math.abs(native.popup.width - reference.popup.width);
        const widthTolerance = tolerance(reference.popup.width);
        result.comparison[phase] = { widthDelta, widthTolerance,
          reactAnchorWidth: reference.anchor?.width,
          solidAnchorWidth: native.anchor?.width,
          reactPopupWidth: reference.popup.width,
          solidPopupWidth: native.popup.width };
        if (widthDelta > widthTolerance)
          result.errors.push(`${phase}: first visible popup widths differ by ${widthDelta.toFixed(2)}px (limit ${widthTolerance.toFixed(2)}px).`);
        if (reference.anchor && native.anchor &&
            Math.abs(reference.popup.width - reference.anchor.width) <= tolerance(reference.anchor.width)) {
          const anchorDelta = Math.abs(native.popup.width - native.anchor.width);
          result.comparison[phase].solidAnchorDelta = anchorDelta;
          if (anchorDelta > tolerance(native.anchor.width))
            result.errors.push(`${phase}: Solid first visible popup differs from its anchor by ${anchorDelta.toFixed(2)}px.`);
        }
      }
    }
    result.passed = result.errors.length === 0;
    results.push(result);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.id}: ${JSON.stringify(result.comparison ?? result.errors)}`);
  }
} finally {
  await browser.close();
}

const report = { schemaVersion: 1, checkedAt: new Date().toISOString(),
  description: 'First visible requestAnimationFrame popup width on first open and reopen, before static visual settling. Effective opacity includes ancestors.',
  opacityThreshold: 0.01, widthTolerance: 'max(4px, 1% of React popup width)',
  urls, configuredCaseIds: all.map((item) => item.id), selectedCaseIds: cases.map((item) => item.id),
  sourceFingerprintBefore: fingerprint(sourceBefore),
  passed: results.every((item) => item.passed), passedCases: results.filter((item) => item.passed).length,
  failedCases: results.filter((item) => !item.passed).length, results };
const sourceAfter = await sourceProvenance();
report.sourceFingerprintAfter = fingerprint(sourceAfter);
report.sourcesChangedDuringRun = [...new Set([...Object.keys(sourceBefore), ...Object.keys(sourceAfter)])]
  .filter((path) => sourceBefore[path] !== sourceAfter[path]);
if (report.sourcesChangedDuringRun.length) report.passed = false;
await mkdir(resolve(root, 'artifacts/visual'), { recursive: true });
await writeFile(artifact, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ passed: report.passed, passedCases: report.passedCases,
  failedCases: report.failedCases, sourcesChangedDuringRun: report.sourcesChangedDuringRun,
  artifact }, null, 2));
if (!report.passed) process.exitCode = 1;
