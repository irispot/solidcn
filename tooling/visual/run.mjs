import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { comparePng } from './compare.mjs';
import { cases as fixtureCases } from './fixtures.mjs';
import { getExampleCases, discoverDocumentation } from './example-catalog.mjs';
import { transformExample } from './docs/transform.mjs';
import './check-comparator.mjs';
import { sourceProvenance, fingerprint } from './provenance.mjs';
import { settleCapture } from './settle-capture.mjs';
import { captureViewport, checkPopupBounds } from './popup-bounds.mjs';
import { captureStable } from './capture-stable.mjs';
import { refreshPaint } from './refresh-paint.mjs';
import { prepareImages, staticImageUrls } from './prepare-images.mjs';
import { settleScrollAreas } from './settle-scroll-areas.mjs';

const root = resolve(import.meta.dirname, '../..');
const exampleCases = await getExampleCases();
const documentation = await discoverDocumentation();
const cases = [...fixtureCases, ...exampleCases];
const arguments_ = process.argv.slice(2);
const external = arguments_.includes('--external');
const options = new Map();
for (let index = 0; index < arguments_.length; index++) {
  const option = arguments_[index];
  if (option === '--external') continue;
  if (!['--case', '--component', '--kind', '--offset', '--limit', '--workers', '--failed-from'].includes(option))
    throw new Error(`Unknown option: ${option}`);
  const value = arguments_[++index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
  options.set(option, value);
}
const filter = options.get('--case');
const component = options.get('--component');
const kind = options.get('--kind');
const offset = Number(options.get('--offset') ?? 0);
const limit = Number(options.get('--limit') ?? cases.length);
const workers = Number(options.get('--workers') ?? 1);
const retryReport = options.has('--failed-from')
  ? JSON.parse(await readFile(resolve(root, options.get('--failed-from')), 'utf8'))
  : undefined;
const retryIds = retryReport ? new Set(retryReport.results.filter((result) => !result.passed || result.error).map((result) => result.id)) : undefined;
for (const id of retryIds ?? [])
  if (!cases.some((fixture) => fixture.id === id)) throw new Error(`The failed case is no longer configured: ${id}`);
if (
  !Number.isInteger(offset) ||
  offset < 0 ||
  !Number.isInteger(limit) ||
  limit < 1 ||
  !Number.isInteger(workers) ||
  workers < 1 ||
  workers > 8
)
  throw new Error('Use a nonnegative offset, a positive limit, and 1 to 8 workers.');
const selected = cases
  .filter(
    (fixture) =>
      (!filter || fixture.id === filter) &&
      (!retryIds || retryIds.has(fixture.id)) &&
      (!component || fixture.component === component) &&
      (!kind || (fixture.kind ?? 'fixture') === kind),
  )
  .slice(offset, offset + limit);
if (!selected.length)
  throw new Error(`No visual case matches ${JSON.stringify(Object.fromEntries(options))}.`);
for (const fixture of selected)
  if (!/^[a-z0-9-]+$/.test(fixture.id)) throw new Error(`Invalid case ID: ${fixture.id}`);
const exampleTransforms = {};
const exampleImageUrls = {};
const conversionErrors = {};
for (const fixture of selected) {
  if (
    fixture.kind !== 'example' ||
    exampleTransforms[fixture.sourceExample] ||
    conversionErrors[fixture.sourceExample]
  )
    continue;
  const source = resolve(root, fixture.sourceExample);
  try {
    if (fixture.discoveryError) throw new Error(fixture.discoveryError);
    const sourceText = await readFile(source, 'utf8');
    exampleTransforms[fixture.sourceExample] = transformExample(sourceText, source).metadata;
    exampleImageUrls[fixture.sourceExample] = staticImageUrls(sourceText);
  } catch (error) {
    conversionErrors[fixture.sourceExample] = error.message;
  }
}
const partial = selected.length !== cases.length;
const selectionName = [
  retryIds ? 'retry-failed' : '',
  component,
  kind,
  options.has('--offset') ? `offset-${offset}` : '',
  options.has('--limit') ? `limit-${limit}` : '',
]
  .filter(Boolean)
  .join('-');
if (selectionName && !/^[a-z0-9-]+$/.test(selectionName))
  throw new Error('Invalid selection name.');
const output = filter
  ? resolve(root, 'artifacts/visual/cases', selected[0].id)
  : partial
    ? resolve(root, 'artifacts/visual/batches', selectionName)
    : resolve(root, 'artifacts/visual');
const initialProvenance = await sourceProvenance();
const upstream = JSON.parse(await readFile(resolve(root, 'tooling/parity/upstreams.json'), 'utf8'));
execFileSync(process.execPath, [resolve(root, 'tooling/parity/preserve.mjs'), 'verify'], {
  cwd: root,
  stdio: 'inherit',
});
const originalStatus = JSON.parse(
  execFileSync(process.execPath, [resolve(root, 'tooling/upstream/impact.mjs'), 'status'], {
    cwd: root,
    encoding: 'utf8',
  }),
);
for (const repository of Object.keys(upstream)) {
  const extraSources = execFileSync(
    'git',
    ['-C', resolve(root, repository), 'ls-files', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter((path) => path && !path.startsWith('packages/solid/'));
  if (extraSources.length)
    throw new Error(
      `Untracked upstream files need review before visual comparison: ${repository}: ${extraSources.join(', ')}`,
    );
}
for (const [repository, pin] of Object.entries(upstream)) {
  const actual = execFileSync('git', ['-C', resolve(root, repository), 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  // A new upstream revision needs an explicit visual reference review.
  pin.checkedOutCommit = actual;
  pin.sourceDiff = execFileSync(
    'git',
    ['-C', resolve(root, repository), 'diff', '--name-only', pin.commit, '--'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean);
}
const urls = {
  react: process.env.SOLID_CN_REACT_VISUAL_URL ?? 'http://127.0.0.1:5181',
  solid: process.env.SOLID_CN_SOLID_VISUAL_URL ?? 'http://127.0.0.1:5182',
};
const servers = [];
async function start(framework, directory, port) {
  if (external) return;
  let log = '';
  const child = spawn(
    'npm',
    [
      'run',
      'dev',
      '--prefix',
      resolve(import.meta.dirname, 'apps', directory),
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  child.stdout.on('data', (chunk) => {
    log += chunk;
  });
  child.stderr.on('data', (chunk) => {
    log += chunk;
  });
  servers.push({ child, framework, log: () => log });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${framework} visual server exited.\n${log}`);
    try {
      const response = await fetch(urls[framework]);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${framework} visual server did not start.\n${log}`);
}
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
function htmlReport(report) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>React vs Solid pixel comparison</title><style>
body{font:15px system-ui;margin:32px;background:#f5f5f5;color:#181818}h1{font-size:28px}.summary,article{background:white;border:1px solid #ddd;border-radius:12px;padding:20px;margin:20px 0}article.fail{border-color:#d51845}.images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}figure{margin:0;overflow:auto}img{width:calc(100% * var(--zoom,1));max-width:none;image-rendering:pixelated;border:1px solid #ddd}figcaption{font-weight:600;margin-bottom:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}.pass{color:#076e32}.fail h2{color:#b80d35}details{margin:10px 0}code{font-size:13px}label{display:block;margin:12px 0}a{color:#1656b5}</style></head><body>
<h1>React vs Solid: exact pixel comparison</h1><p>Fresh browser screenshots of the original React source and the native Solid source. Full viewport captures include portals and open popups.</p>
${report.harnessError || !report.complete ? `<div class="summary fail" role="alert"><h2>INVALID OR INCOMPLETE RUN</h2><p>These observations are not a valid parity result.</p><pre>${escape(report.harnessError ?? 'Not all selected cases finished.')}</pre></div>` : `<p>Run complete. Overall check: ${report.passed ? 'passed' : 'failed'}. ${report.fullConfiguredSuite ? 'Full configured suite.' : 'Selected cases only.'}</p>`}
<div class="summary"><strong>${report.passedCases}/${report.results.length} cases match exactly.</strong> ${report.failedCases} fail. No pixel tolerance, masks, or anti-alias exclusions are used.<p>Browser: ${escape(report.environment.browser ?? 'not started')}; viewport 900 × 700; device scale 1; color scheme light; reduced motion.</p><p>This proves only these component states in this environment. It does not prove complete component or behavior parity.</p><label>Image zoom <input type="range" min="1" max="4" step="0.5" value="1" oninput="document.documentElement.style.setProperty('--zoom',this.value)"></label><a href="report.json">Machine-readable report</a></div>
<details><summary>Source revisions and visual coverage</summary><pre>${escape(JSON.stringify({ upstream: report.upstream, coverage: report.coverage }, null, 2))}</pre></details>
${report.results
  .map(
    (result) =>
      `<article class="${result.passed ? 'pass' : 'fail'}"><h2>${escape(result.id)} — ${result.passed ? 'exact match' : result.error ? 'check failed' : `${result.changedPixels} changed pixels`}</h2><p>${escape(result.layer)} / ${escape(result.component)}${result.changedPercent !== undefined ? ` · ${result.changedPercent.toFixed(4)}%` : ''}</p>${result.error ? `<pre>${escape(result.error)}</pre>` : ''}${
        result.images
          ? `<div class="images">${[
              ['reference', 'Original React'],
              ['solid', 'Native Solid'],
              ['difference', 'Changed pixels in red'],
            ]
              .map(
                ([key, title]) =>
                  `<figure><figcaption>${title}</figcaption><a href="${result.images[key]}"><img src="${result.images[key]}" alt="${escape(result.id)} ${title}"></a></figure>`,
              )
              .join('')}</div>`
          : ''
      }<details><summary>Case evidence</summary><pre>${escape(JSON.stringify(result, null, 2))}</pre></details></article>`,
  )
  .join('')}
</body></html>`;
}
async function act(page, action) {
  const locator = page.locator(action.selector);
  if (action.type === 'click') await locator.click();
  else if (action.type === 'open') {
    if ((await locator.getAttribute('aria-expanded')) !== 'true') await locator.click();
  } else if (action.type === 'right-click') await locator.click({ button: 'right' });
  else if (action.type === 'focus') await locator.focus();
  else if (action.type === 'hover') await locator.hover();
  else if (action.type === 'fill') await locator.fill(action.value);
  else if (action.type === 'press') await locator.press(action.value);
  else if (action.type === 'wait')
    await locator.first().waitFor({ state: action.state ?? 'visible' });
  else throw new Error(`Unknown visual action ${action.type}`);
}
let inventory;
try {
  inventory = JSON.parse(await readFile(resolve(root, 'artifacts/export-inventory.json'), 'utf8'));
} catch {}
const coverage = Object.fromEntries(
  ['base', 'shadcn'].map((layer) => {
    const attemptedModules = [
      ...new Set(
        selected
          .filter((item) => item.layer === layer)
          .map(
            (item) =>
              item.module ??
              (layer === 'shadcn' && item.component === 'menu' ? 'dropdown-menu' : item.component),
          ),
      ),
    ];
    return [
      layer,
      {
        attemptedModules,
        modulesWithAtLeastOneExactMatch: [],
        unattemptedModules: (inventory?.[layer] ?? [])
          .map((item) => item.name.replace(/\.tsx?$/, ''))
          .filter((name) => !attemptedModules.includes(name)),
        inventoryAvailable: !!inventory,
        note: 'Module coverage does not cover all its states.',
      },
    ];
  }),
);
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  comparison: 'exact RGBA pixels',
  tolerance: 0,
  upstream,
  originalStatus,
  configuredCaseCount: cases.length,
  selectedCaseCount: selected.length,
  fullConfiguredSuite: !partial,
  selectionFilter: Object.fromEntries(options),
  sourceProvenance: initialProvenance,
  exampleTransforms,
  conversionErrors,
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    browser: null,
    viewport: { width: 900, height: 700 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    staticCapture:
      'Wait for finite animations; pause infinite animations at time zero; capture twice without restarting animations.',
  },
  coverage,
  documentation: {
    availablePages: documentation.length,
    availableExamples: new Set(documentation.flatMap((page) => page.examples)).size,
    configuredExamples: new Set(exampleCases.map((fixture) => fixture.exampleName)).size,
    selectedExamples: [
      ...new Set(
        selected
          .filter((fixture) => fixture.kind === 'example')
          .map((fixture) => fixture.exampleName),
      ),
    ],
    unconfiguredPages: documentation
      .filter((page) => !exampleCases.some((fixture) => fixture.docUrl === page.docUrl))
      .map((page) => page.page),
    note: 'Only the selected examples and declared interaction states are checked. The documentation website shell is not part of the capture.',
  },
  results: [],
  passedCases: 0,
  failedCases: 0,
  fullMigrationParity: false,
  complete: false,
};
let browser;
let progressWrite = Promise.resolve();
try {
  await mkdir(output, { recursive: true });
  await Promise.all([start('react', 'reference', 5181), start('solid', 'solid', 5182)]);
  browser = await chromium.launch({ headless: true });
  report.environment.browser = browser.version();
  async function checkCase(fixture) {
    const viewport = captureViewport(fixture.viewport);
    const result = {
      id: fixture.id,
      layer: fixture.layer,
      component: fixture.component,
      kind: fixture.kind ?? 'fixture',
      sourceExample: fixture.sourceExample,
      docUrl: fixture.docUrl,
      state: fixture.state,
      actions: fixture.actions ?? [],
      viewport,
      recipe: fixture.recipe,
      passed: false,
    };
    const contexts = [];
    try {
      if (conversionErrors[fixture.sourceExample]) {
        result.failureStage = 'conversion';
        throw new Error(conversionErrors[fixture.sourceExample]);
      }
      const captures = {};
      result.evidence = {};
      for (const framework of ['react', 'solid']) {
        const context = await browser.newContext({
          viewport,
          deviceScaleFactor: 1,
          locale: 'en-US',
          timezoneId: 'UTC',
          colorScheme: 'light',
          reducedMotion: 'reduce',
        });
        contexts.push(context);
        const page = await context.newPage();
        page.setDefaultTimeout(8000);
        page.setDefaultNavigationTimeout(30000);
        const errors = [];
        result.evidence[framework] = { browserErrors: errors };
        const modules = new Set();
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('response', (response) => {
          if (/\/(base-ui|shadcn-ui)\//.test(response.url()))
            modules.add(new URL(response.url()).pathname);
        });
        const preloadedImages = await prepareImages(page, exampleImageUrls[fixture.sourceExample] ?? []);
        await page.goto(`${urls[framework]}/?case=${encodeURIComponent(fixture.id)}`, {
          waitUntil: 'networkidle',
        });
        await page.waitForFunction(() => window.__visualReady === true || !!window.__visualError);
        const previewError = await page.evaluate(() => window.__visualError);
        if (previewError) {
          result.failureStage = `${framework}-preview`;
          throw new Error(
            `${framework} preview: ${typeof previewError === 'string' ? previewError : JSON.stringify(previewError)}`,
          );
        }
        const meta = await page.evaluate(() => window.__visualMeta);
        if (meta.framework !== framework || meta.case !== fixture.id)
          throw new Error(`Wrong visual app or case: ${JSON.stringify(meta)}`);
        await page.locator('#visual-case').waitFor();
        for (const action of fixture.actions ?? []) await act(page, action);
        const decodedImages = await prepareImages(page);
        const settledScrollAreas = await settleScrollAreas(page);
        // Read image-dependent scroll sizes before ResizeObserver settles the thumb.
        // This only flushes layout; it does not change the DOM or styles.
        const scrollAreaLayout = await page.evaluate(() =>
          [...document.querySelectorAll('[data-slot="scroll-area-viewport"]')].map(
            (viewport) => ({
              clientWidth: viewport.clientWidth,
              scrollWidth: viewport.scrollWidth,
              clientHeight: viewport.clientHeight,
              scrollHeight: viewport.scrollHeight,
            }),
          ),
        );
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        });
        const animationEvidence = await settleCapture(page);
        const paintEvidence = [];
        for (let refresh = 0; refresh < 2; refresh++) {
          paintEvidence.push(await refreshPaint(page));
          await settleCapture(page);
        }
        if (await page.locator('vite-error-overlay').count())
          throw new Error(`${framework} preview has a Vite error overlay.`);
        const stateAfterActions = await page.evaluate(() => ({
          ready: window.__visualReady,
          error: window.__visualError,
        }));
        if (!stateAfterActions.ready || stateAfterActions.error)
          throw new Error(
            `${framework} preview failed after interaction: ${stateAfterActions.error ?? 'not ready'}`,
          );
        if (errors.length) throw new Error(`${framework} browser errors: ${errors.join('\n')}`);
        const loaded = [...modules].sort();
        const expected =
          framework === 'react' ? '/base-ui/packages/react/src/' : '/base-ui/packages/solid/src/';
        if (!loaded.some((path) => path.includes(expected)))
          throw new Error(`${framework} did not load the expected Base UI source.`);
        if (
          framework === 'react' &&
          fixture.layer === 'shadcn' &&
          !loaded.some((path) => path.includes('/shadcn-ui/apps/v4/registry/bases/base/ui/'))
        )
          throw new Error('The React reference did not load canonical Shadcn source.');
        if (framework === 'react' && loaded.some((path) => path.includes('/packages/solid/')))
          throw new Error('The React reference loaded Solid component source.');
        if (
          framework === 'solid' &&
          loaded.some(
            (path) =>
              path.includes('/base-ui/packages/react/src/') ||
              path.includes('/shadcn-ui/apps/v4/registry/bases/base/ui/'),
          )
        )
          throw new Error('The Solid app loaded original React component source.');
        if (
          framework === 'solid' &&
          fixture.layer === 'shadcn' &&
          !loaded.some((path) => path.includes('/shadcn-ui/packages/solid/src/'))
        )
          throw new Error('The Solid app did not load native Shadcn component source.');
        const popupBounds = [];
        for (const selector of fixture.popups ?? []) {
          const popup = page.locator(selector);
          await popup.waitFor({ state: 'visible' });
          const bounds = await popup.boundingBox();
          popupBounds.push(checkPopupBounds(selector, bounds, viewport, fixture.popupOverflow?.[selector]));
        }
        const stability = await captureStable(page);
        captures[framework] = stability.png;
        const captureError = await page.evaluate(() => window.__visualError);
        if (captureError)
          throw new Error(`${framework} preview failed during capture: ${captureError}`);
        if (errors.length) throw new Error(`${framework} browser errors: ${errors.join('\n')}`);
        result.evidence[framework] = {
          meta,
          loadedModules: loaded,
          browserErrors: errors,
          repeatedCaptureChangedPixels: 0,
          captureWarmupChangedPixels: stability.changes,
          consecutiveIdenticalCaptures: stability.consecutiveIdenticalCaptures,
          popupBounds,
          animationEvidence,
          paintEvidence,
          preloadedImages,
          decodedImages,
          settledScrollAreas,
          scrollAreaLayout,
        };
      }
      const comparison = comparePng(captures.react, captures.solid);
      const { differencePng, ...statistics } = comparison;
      Object.assign(result, statistics);
      result.images = {
        reference: `${fixture.id}.react.png`,
        solid: `${fixture.id}.solid.png`,
        difference: `${fixture.id}.diff.png`,
      };
      await Promise.all([
        writeFile(resolve(output, result.images.reference), captures.react),
        writeFile(resolve(output, result.images.solid), captures.solid),
        writeFile(resolve(output, result.images.difference), differencePng),
      ]);
      console.log(
        `${result.passed ? 'PASS' : 'DIFF'} ${fixture.id}: ${comparison.changedPixels} changed pixels`,
      );
    } catch (error) {
      result.passed = false;
      result.error = error.stack;
      console.error(`FAIL ${fixture.id}: ${error.message}`);
    } finally {
      for (const context of contexts) await context.close();
    }
    report.results.push(result);
    report.passedCases = report.results.filter((entry) => entry.passed).length;
    report.failedCases = report.results.length - report.passedCases;
    const progress =
      JSON.stringify(
        {
          checkedAt: report.checkedAt,
          complete: false,
          selectedCaseCount: selected.length,
          completedCaseCount: report.results.length,
          passedCases: report.passedCases,
          failedCases: report.failedCases,
          results: report.results.map(({ id, passed, changedPixels, failureStage, error }) => ({
            id,
            passed,
            changedPixels,
            failureStage,
            error: error?.split('\n')[0],
          })),
        },
        null,
        2,
      ) + '\n';
    progressWrite = progressWrite.then(async () => {
      await writeFile(resolve(output, 'progress.json.tmp'), progress);
      await rename(resolve(output, 'progress.json.tmp'), resolve(output, 'progress.json'));
    });
    await progressWrite;
  }
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (nextIndex < selected.length) await checkCase(selected[nextIndex++]);
    }),
  );
} catch (error) {
  report.harnessError = error.stack;
  console.error(error.stack);
} finally {
  await browser?.close();
  for (const server of servers) {
    await writeFile(resolve(output, `${server.framework}-server.log`), server.log());
    if (server.child.exitCode === null) {
      try {
        process.kill(-server.child.pid, 'SIGTERM');
      } catch {}
    }
  }
  report.passedCases = report.results.filter((result) => result.passed && !result.error).length;
  report.failedCases = report.results.filter((result) => !result.passed || result.error).length;
  for (const layer of ['base', 'shadcn'])
    report.coverage[layer].modulesWithAtLeastOneExactMatch = [
      ...new Set(
        report.results
          .filter((result) => result.layer === layer && result.passed && !result.error)
          .map((result) =>
            layer === 'shadcn' && result.component === 'menu' ? 'dropdown-menu' : result.component,
          ),
      ),
    ];
  const finalProvenance = await sourceProvenance();
  report.sourcesChangedDuringRun = [
    ...new Set([...Object.keys(initialProvenance), ...Object.keys(finalProvenance)]),
  ].filter((path) => initialProvenance[path] !== finalProvenance[path]);
  if (report.sourcesChangedDuringRun.length)
    report.harnessError =
      'Source files changed during capture. Run again with a stable source tree.';
  try {
    report.finalOriginalStatus = JSON.parse(
      execFileSync(process.execPath, [resolve(root, 'tooling/upstream/impact.mjs'), 'status'], {
        cwd: root,
        encoding: 'utf8',
      }),
    );
    execFileSync(process.execPath, [resolve(root, 'tooling/parity/preserve.mjs'), 'verify'], {
      cwd: root,
      stdio: 'pipe',
    });
  } catch (error) {
    report.harnessError = `Original reference files changed during capture: ${error.message}`;
  }
  report.passed =
    !report.harnessError && report.failedCases === 0 && report.results.length === selected.length;
  report.complete = report.results.length === selected.length;
  const order = new Map(selected.map((fixture, index) => [fixture.id, index]));
  report.results.sort((left, right) => order.get(left.id) - order.get(right.id));
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(resolve(output, 'report.html'), htmlReport(report));
  await writeFile(
    resolve(output, 'status.json'),
    JSON.stringify(
      {
        checkedAt: report.checkedAt,
        sourceFingerprint: fingerprint(initialProvenance),
        valid: report.complete && !report.harnessError,
        harnessError: report.harnessError,
        passedCases: report.passedCases,
        failedCases: report.failedCases,
        totalCases: selected.length,
        results: report.results.map(({ id, passed, changedPixels, error }) => ({
          id,
          passed,
          changedPixels,
          error: error?.split('\n')[0],
        })),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Visual result: ${report.passedCases}/${selected.length} exact matches. Report: ${resolve(output, 'report.html')}`,
  );
  if (!report.passed) process.exitCode = 1;
}
