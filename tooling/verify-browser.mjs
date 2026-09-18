import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const completed = [];
async function check(name, fn) {
  await fn();
  completed.push(name);
  console.log(`PASS ${name}`);
}
try {
  await page.goto(process.env.SOLID_CN_PREVIEW_URL ?? 'http://127.0.0.1:5173');
  await page.getByRole('heading', { name: 'Base UI + Shadcn' }).waitFor();
  await check('native signal updates', async () => {
    await page.getByTestId('counter').click();
    assert.equal(await page.getByTestId('counter').innerText(), 'Count: 1');
  });
  await check('controlled checkbox and native input', async () => {
    await page.locator('.check').click();
    await page
      .getByTestId('check-value')
      .filter({ hasText: /^Checked$/ })
      .waitFor();
    assert.equal(await page.locator('input[name="agreed"]').isChecked(), true);
  });
  await check('number input increments', async () => {
    await page.getByRole('button', { name: 'Increase', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Quantity' }).inputValue(), '3');
  });
  await check('checked switch thumb remains visible', async () => {
    await page.locator('.switch').click();
    const appearance = await page.locator('.switch').evaluate(node => {
      const thumb = node.querySelector('span');
      const bounds = thumb.getBoundingClientRect();
      return {track:getComputedStyle(node).backgroundColor,thumb:getComputedStyle(thumb).backgroundColor,width:bounds.width,height:bounds.height};
    });
    assert.notEqual(appearance.track,appearance.thumb);
    assert.ok(appearance.width>0 && appearance.height>0);
  });
  await check('accordion disclosure', async () => {
    await page.getByRole('button', { name: 'Second section' }).click();
    await page.getByText('Second panel content', { exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Second section' }).getAttribute('aria-expanded'),
      'true',
    );
  });
  await check('tabs keyboard navigation', async () => {
    await page.getByRole('tab', { name: 'Overview', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('tabpanel').filter({ hasText: 'Details panel' }).waitFor();
    assert.equal(
      await page.getByRole('tab', { name: 'Details', exact: true }).getAttribute('aria-selected'),
      'true',
    );
  });
  await check('modal dialog focus and escape', async () => {
    await page.getByRole('button', { name: 'Open dialog', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Solid dialog' });
    await dialog.waitFor();
    await page.getByRole('button', { name: 'Close dialog' }).focus();
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('textbox', { name: 'Dialog input' })
        .evaluate((node) => node === node.ownerDocument.activeElement),
      true,
    );
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(
      await page
        .getByRole('button', { name: 'Open dialog', exact: true })
        .evaluate((node) => node === node.ownerDocument.activeElement),
      true,
    );
  });
  await check('menu keyboard and selection', async () => {
    await page.getByRole('button', { name: 'Open menu' }).click();
    const item = page.getByRole('menuitem', { name: 'Create item' });
    await item.waitFor();
    await item.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menu').waitFor({ state: 'detached' });
    await page.getByText('Item selected', { exact: true }).waitFor();
  });
  await check('select value and controlled callback', async () => {
    await page.getByRole('combobox', { name: 'Fruit', exact: true }).click();
    await page.getByRole('option', { name: 'Pear', exact: true }).click();
    await page
      .getByTestId('select-value')
      .filter({ hasText: /^pear$/ })
      .waitFor();
  });
  await check('combobox filtering and keyboard selection', async () => {
    const input = page.getByRole('combobox', { name: 'Search fruit', exact: true });
    await input.fill('Ban');
    await page.getByRole('option', { name: 'Banana', exact: true }).waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await input.inputValue(), 'Banana');
  });
  await check('Shadcn styling and notification', async () => {
    const button = page.getByRole('button', { name: 'Show notification' });
    assert.notEqual(
      await button.evaluate((node) => getComputedStyle(node).backgroundColor),
      'rgba(0, 0, 0, 0)',
    );
    await button.click();
    await page.getByText('The Solid event handler ran.', { exact: true }).waitFor();
  });
  assert.deepEqual(errors, [], 'browser runtime errors');
  await mkdir(resolve('artifacts'), { recursive: true });
  await page.screenshot({ path: resolve('artifacts/components.png'), fullPage: true });
  await writeFile(
    resolve('artifacts/browser-checks.json'),
    JSON.stringify(
      {
        completed,
        errors,
        source: 'Native Solid integration checks; not upstream React component tests.',
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
