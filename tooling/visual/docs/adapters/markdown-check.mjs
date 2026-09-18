import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Independent checks for the native Markdown helper. No source example or
// upstream test is changed. This page uses the real parser and Shiki plugin.
const entry = resolve(import.meta.dirname, 'markdown-virtual-probe.tsx');
const server = await createServer({
  configFile: resolve(import.meta.dirname, '../../apps/solid/vite.config.ts'),
  logLevel: 'error',
  plugins: [
    {
      name: 'native-markdown-check',
      resolveId(id) {
        if (id === '/markdown-probe.tsx') return entry;
      },
      load(id) {
        if (id === entry)
          return `
      import{createSignal}from'solid-js';import{render}from'@solidjs/web';import{Markdown}from'./markdown';
      const [text,setText]=createSignal('Initial');window.setMarkdown=setText;
      window.disposeMarkdown=render(()=><Markdown>{text()}</Markdown>,document.getElementById('root'));
      window.markdownProbeReady=true;
    `;
      },
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== '/markdown-probe') return next();
          response.setHeader('content-type', 'text/html');
          response.end(
            '<div id="root"></div><script type="module" src="/markdown-probe.tsx"></script>',
          );
        });
      },
    },
  ],
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, ws: false },
});
let browser;
const passed = [];
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const modules = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => modules.push(response.url()));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/markdown-probe`);
  await page.waitForFunction(() => window.markdownProbeReady);
  const update = (text) => page.evaluate((text) => window.setMarkdown(text), text);
  await update(
    '## Heading\n\n**Bold** and *italic* with `code`.\n\n- First\n- Second\n\n| Name | Value |\n| --- | --- |\n| a | b |\n\n> Quote',
  );
  assert.equal(await page.locator('h2').innerText(), 'Heading');
  assert.equal(await page.locator('[data-streamdown=strong]').innerText(), 'Bold');
  assert.equal(await page.locator('em').innerText(), 'italic');
  assert.equal(await page.locator('li').count(), 2);
  assert.equal(await page.locator('th').count(), 2);
  assert.equal(await page.locator('td').count(), 2);
  assert.equal(await page.locator('blockquote').innerText(), 'Quote');
  passed.push('GFM headings, emphasis, code, lists, table, and blockquote');
  await update('Partial **bold');
  assert.equal(await page.locator('[data-streamdown=strong]').innerText(), 'bold');
  await update('Partial **bold complete**.');
  assert.equal(await page.locator('[data-streamdown=strong]').innerText(), 'bold complete');
  passed.push('Incomplete Markdown repair and reactive updates');
  await update(
    '<script>window.markdownInjected=true</script>\n\n<img src="x" onerror="window.markdownInjected=true">\n\n[unsafe](javascript:alert(1))',
  );
  assert.equal(await page.locator('#root script').count(), 0);
  assert.equal(await page.locator('#root [onerror]').count(), 0);
  assert.equal(await page.locator('#root [href^="javascript:"]').count(), 0);
  assert.equal(await page.evaluate(() => window.markdownInjected), undefined);
  passed.push('Raw HTML and unsafe URL sanitization');
  await update('[External](https://example.com)');
  await page.getByRole('button', { name: 'External', exact: true }).click();
  await page.locator('[data-streamdown=link-safety-modal]').waitFor();
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Escape');
  await page.locator('[data-streamdown=link-safety-modal]').waitFor({ state: 'detached' });
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
  passed.push('Safe-link confirmation, Escape close, and scroll-lock cleanup');
  await update('```tsx\nexport const value = 42\n```');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-streamdown=code-block-body] span')].some((element) =>
      element.style.getPropertyValue('--sdm-c').startsWith('#'),
    ),
  );
  assert.equal(await page.locator('[data-streamdown=code-block-header]').innerText(), 'tsx');
  assert.equal(
    await page.locator('[data-streamdown=code-block-body] code').innerText(),
    'export const value = 42',
  );
  assert.equal(await page.locator('[data-streamdown=code-block-actions]').count(), 0);
  passed.push('Actual asynchronous Shiki tokens and original controls=false default');
  await page.evaluate(() => window.disposeMarkdown());
  assert.equal(await page.locator('#root').innerText(), '');
  passed.push('Owner disposal removes renderer');
  assert.deepEqual(errors, []);
  assert.equal(
    modules.some((url) => /\/react(?:-dom)?(?:[/.?]|$)|\/deps\/react(?:_|\.)/.test(url)),
    false,
  );
  passed.push('No React runtime loaded; no browser exceptions');
  console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
