import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Native navigation diagnostics, not upstream component tests. Start the workspace
// Vite server first. No original source or test file is changed by this script.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.SOLID_CN_PREVIEW_URL ?? 'http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const source = await (await fetch('/examples/main.tsx')).text();
    const webPath = source.match(/from "([^\"]*\/@solidjs_web\.js[^\"]*)"/)[1];
    const { render, createComponent: c } = await import(webPath);
    const n = await import('/shadcn-ui/packages/solid/src/navigation-menu.tsx');
    const section = document.createElement('section');
    section.id = 'navigation-probe';
    section.style.cssText = 'position:fixed;left:80px;top:80px;z-index:10;background:white;padding:20px';
    const before = document.createElement('button'); before.textContent = 'Before navigation';
    const after = document.createElement('button'); after.textContent = 'After navigation';
    const mount = document.createElement('div');
    section.append(before, mount, after); document.body.append(section);
    window.navigationChanges = [];
    render(() => c(n.NavigationMenu, { delay: 20, closeDelay: 120, onValueChange: (value, details) => window.navigationChanges.push({ value, reason: details.reason }), get children() { return c(n.NavigationMenuList, { get children() { return [
      ...['Products', 'Company'].map((name, index) => c(n.NavigationMenuItem, { value: name, get children() { return [
        c(n.NavigationMenuTrigger, { children: name }),
        c(n.NavigationMenuContent, { style: { width: `${index ? 420 : 300}px`, padding: '16px' }, get children() { return [
          c(n.NavigationMenuLink, { href: '#navigation-first', children: `${name} first`, active: index === 0 }),
          c(n.NavigationMenuLink, { href: '#navigation-second', children: `${name} second`, closeOnClick: true }),
        ]; } }),
      ]; } })),
      c(n.NavigationMenuItem, { value: 'Disabled', get children() { return c(n.NavigationMenuTrigger, { disabled: true, children: 'Disabled navigation' }); } }),
    ]; } }); } }), mount);
  });
  const root = page.locator('#navigation-probe');
  const product = root.getByRole('button', { name: 'Products', exact: true });
  const company = root.getByRole('button', { name: 'Company', exact: true });
  const popup = page.locator('.cn-navigation-menu-popup');
  const content = page.locator('[data-slot=navigation-menu-content]');
  assert.equal(await content.count(), 0);
  await product.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await company.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('End');
  assert.equal(await company.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Home');
  assert.equal(await product.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('ArrowDown');
  await page.getByRole('link', { name: 'Products first' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent === 'Products first');
  assert.equal(await content.evaluate(node => !node.closest('[data-slot=navigation-menu]') && !!node.closest('.cn-navigation-menu-popup')), true);
  assert.equal(await content.getAttribute('id'), await product.getAttribute('aria-controls'));
  assert.equal(await content.getAttribute('aria-labelledby'), await product.getAttribute('id'));
  assert.equal(await page.getByRole('link', { name: 'Products first' }).getAttribute('aria-current'), 'page');
  await page.waitForFunction(() => Number.parseFloat(document.querySelector('.cn-navigation-menu-positioner').style.getPropertyValue('--popup-width')) >= 300);
  assert.notEqual(await popup.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
  const dimensions = await page.locator('.cn-navigation-menu-positioner').evaluate(node => ({ width: node.offsetWidth, height: node.offsetHeight, available: getComputedStyle(node).getPropertyValue('--available-width'), top: Number.parseFloat(node.style.top) }));
  assert.equal(dimensions.width, 300);
  assert.ok(dimensions.height >= 70);
  assert.ok(Number.parseFloat(dimensions.available) > 0);
  assert.ok(dimensions.top >= (await product.boundingBox()).y + (await product.boundingBox()).height);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('link', { name: 'Products second' }).evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Escape');
  await popup.waitFor({ state: 'detached' });
  assert.equal(await product.evaluate(node => node === document.activeElement), true);
  console.log('PASS content portal, Floating UI size/position, ARIA, arrow keys, Escape, and focus return');

  await product.click();
  await popup.waitFor();
  await company.click();
  await page.getByRole('link', { name: 'Company first' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Products first' }).count(), 0);
  await page.waitForFunction(() => Number.parseFloat(document.querySelector('.cn-navigation-menu-positioner').style.getPropertyValue('--popup-width')) === 420);
  assert.equal(await company.getAttribute('aria-expanded'), 'true');
  assert.equal(await product.getAttribute('aria-expanded'), 'false');
  await company.focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.activeElement?.textContent === 'Company first');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await popup.waitFor({ state: 'detached' }).catch(async error => { console.error(await page.evaluate(() => window.navigationChanges)); throw error; });
  assert.equal(await root.getByRole('button', { name: 'After navigation' }).evaluate(node => node === document.activeElement), true);
  console.log('PASS active content switch, width update, and portaled Tab sequence');

  await product.hover();
  await page.getByRole('link', { name: 'Products first' }).waitFor();
  await page.getByRole('link', { name: 'Products first' }).hover();
  await page.waitForTimeout(180);
  assert.equal(await product.getAttribute('aria-expanded'), 'true');
  await root.getByRole('button', { name: 'Before navigation' }).click();
  await popup.waitFor({ state: 'detached' });
  assert.equal(await root.getByRole('button', { name: 'Before navigation' }).evaluate(node => node === document.activeElement), true);
  await product.focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('link', { name: 'Products second' }).click().catch(async error => { console.error(await page.evaluate(() => ({changes:window.navigationChanges,active:document.activeElement?.outerHTML}))); throw error; });
  await popup.waitFor({ state: 'detached' });
  assert.ok(await page.evaluate(() => window.navigationChanges.some(change => change.reason === 'link-press' && change.value === null)));
  assert.deepEqual(errors, [], 'No navigation runtime errors');
  console.log('PASS hover bridge, outside close, closeOnClick, and disabled trigger exclusion');
  console.log('Navigation checks passed. Advanced nested navigation and cross-content transition parity remain unverified.');
} finally { await browser.close(); }
