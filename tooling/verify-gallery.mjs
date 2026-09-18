import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getExampleCatalog } from './visual/example-catalog.mjs';

const output = resolve(import.meta.dirname, '../artifacts');
const browser = await chromium.launch();
const checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const transportErrors = [];
  const sockets = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('websocket', (socket) => {
    if (/:(5181|5182)\//.test(socket.url())) sockets.push(socket.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && /WebSocket|\[vite\]/.test(message.text()))
      transportErrors.push(message.text());
  });
  await page.goto('http://127.0.0.1:5173/tooling/visual/gallery.html', {
    waitUntil: 'networkidle',
  });
  await page
    .locator('#solid-frame')
    .contentFrame()
    .getByRole('button', { name: 'More Options' })
    .waitFor();
  assert.equal(await page.locator('#example-title').innerText(), 'button-group-demo');
  checks.push('Default original Button Group example loads in Solid');
  const catalog = await getExampleCatalog({ pages: '*' });
  const visibleIDs = await page
    .locator('[data-entry]')
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.entry));
  for (const entry of catalog)
    assert.ok(visibleIDs.includes(entry.name), `Gallery omitted ${entry.name}`);
  checks.push(
    `All ${catalog.length} source entries appear, including files not linked in documentation`,
  );
  await page.getByRole('tab', { name: 'Side by side' }).click();
  for (const id of ['solid-frame', 'react-frame']) {
    const frame = page.locator(`#${id}`).contentFrame();
    await frame.getByRole('button', { name: 'More Options' }).click();
    await frame.getByRole('menu').waitFor();
  }
  checks.push('Both live framework views open their own dropdown');
  const separate = await browser.newPage();
  await separate.goto('http://127.0.0.1:5181/?case=docs-ai-sdk-helper-demo-default');
  await separate.locator('#visual-case').waitFor();
  assert.equal(await separate.locator('[data-visual-error]').count(), 0);
  assert.equal(
    await page.locator('#react-frame').contentFrame().locator('vite-error-overlay').count(),
    0,
  );
  await page.locator('#react-frame').contentFrame().getByRole('menu').waitFor();
  await separate.close();
  checks.push('An independent reference example loads without covering the working preview');
  await page.getByRole('searchbox').fill('pasted-button-group');
  await page.locator('[data-entry="local/pasted-button-group"]').click();
  for (const id of ['solid-frame', 'react-frame']) {
    const frame = page.locator(`#${id}`).contentFrame();
    await frame.getByRole('button', { name: 'Archive', exact: true }).click();
    await frame.getByRole('button', { name: 'Archived', exact: true }).waitFor();
  }
  checks.push('Search and pasted-file state updates work in both views');
  await page.locator('#case-select').selectOption('local-pasted-button-group-clicked');
  await page.locator('#case-details summary').click();
  assert.match(await page.locator('#case-information').innerText(), /Archived/);
  checks.push('Configured state has visible manual action steps');
  await page.getByRole('searchbox').fill('');
  await page.locator('#status-filter').selectOption('runnable');
  await page.locator('[data-entry="docs/data-table-demo"]').click();
  assert.equal(await page.locator('#connected-view').isVisible(), true);
  assert.match(await page.locator('#solid-frame').getAttribute('src'), /docs-data-table-demo/);
  assert.equal(await page.locator('#conversion-error').isVisible(), false);
  await page.locator('#solid-frame').contentFrame().locator('#visual-case').waitFor();
  await page.locator('#react-frame').contentFrame().locator('#visual-case').waitFor();
  checks.push('Converted documentation entries load both previews without conversion errors');
  await page.goto(
    'http://127.0.0.1:5173/tooling/visual/gallery.html?case=docs-button-group-demo-default&view=both',
    { waitUntil: 'networkidle' },
  );
  await page
    .locator('#react-frame')
    .contentFrame()
    .getByRole('button', { name: 'More Options' })
    .waitFor();
  assert.equal(
    await page.getByRole('tab', { name: 'Side by side' }).getAttribute('aria-selected'),
    'true',
  );
  checks.push('Shareable URL restores example and view');
  assert.deepEqual(errors, []);
  assert.deepEqual(transportErrors, []);
  assert.deepEqual(sockets, []);
  checks.push('Comparison frames start no development WebSocket and report no transport error');
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: resolve(output, 'gallery.png') });
  await writeFile(
    resolve(output, 'gallery-checks.json'),
    JSON.stringify({ passed: true, checks, errors }, null, 2) + '\n',
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} finally {
  await browser.close();
}
