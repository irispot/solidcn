import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import solid from '@solidjs/vite-plugin';
import { chromium } from 'playwright';

// Native browser checks only. Frozen upstream test files are not changed.
const workspace = resolve(import.meta.dirname, '..');
const entry = resolve(import.meta.dirname, 'avatar-virtual-probe.tsx');
const server = await createServer({
  configFile: false,
  root: workspace,
  logLevel: 'error',
  optimizeDeps: { entries: [], include: ['solid-js', '@solidjs/web'] },
  plugins: [
    {
      name: 'native-avatar-probe',
      resolveId(id) {
        if (id === '/avatar-probe.tsx') return entry;
      },
      load(id) {
        if (id === entry)
          return `
    import{createSignal}from'solid-js';import{render}from'@solidjs/web';import{Avatar}from'../base-ui/packages/solid/src/structure';
    window.mountAvatar=(options={})=>{
      window.disposeAvatar?.();window.statuses=[];window.refs=[];
      const[src,setSrc]=createSignal(options.src);const[srcSet,setSrcSet]=createSignal(options.srcSet);const[delay,setDelay]=createSignal(options.delay??0);
      window.setAvatarSource=setSrc;window.setAvatarSrcSet=setSrcSet;window.setAvatarDelay=setDelay;
      window.disposeAvatar=render(()=><Avatar.Root class={state=>'avatar-root-'+state.imageLoadingStatus}>
        <Avatar.Image src={src()} srcSet={srcSet()} keepMounted={options.keepMounted} class="avatar-image" alt="Portrait" ref={node=>window.refs.push(node)} onLoadingStatusChange={status=>window.statuses.push(status)}/>
        <Avatar.Fallback delay={delay()}>Fallback</Avatar.Fallback>
      </Avatar.Root>,document.getElementById('root'));
    };window.avatarReady=true;
  `;
      },
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== '/avatar-probe') return next();
          response.setHeader('content-type', 'text/html');
          response.end(
            '<div id="root"></div><script type="module" src="/avatar-probe.tsx"></script>',
          );
        });
      },
    },
    solid(),
  ],
  server: { host: '127.0.0.1', port: 0, hmr: false, ws: false, fs: { allow: [workspace] } },
});
const image =
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>';
const passed = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const pending = new Map();
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  page.setDefaultTimeout(5000);
  await page.route('**/avatar-*.svg', (route) => {
    const name = new URL(route.request().url()).pathname;
    const list = pending.get(name) ?? [];
    list.push(route);
    pending.set(name, list);
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/avatar-probe`);
  await page.waitForFunction(() => window.avatarReady);
  const mount = (options) => page.evaluate((options) => window.mountAvatar(options), options);
  const finish = async (name, error = false) => {
    for (let tries = 0; tries < 100 && !pending.get(name)?.length; tries++)
      await page.waitForTimeout(10);
    assert.ok(pending.get(name)?.length, `No image request: ${name}`);
    for (const route of pending.get(name))
      await route.fulfill({
        status: error ? 404 : 200,
        contentType: 'image/svg+xml',
        body: error ? 'not found' : image,
      });
    pending.delete(name);
  };
  await mount({ src: '/avatar-default.svg' });
  await page.locator('.avatar-root-loading').waitFor();
  assert.equal(await page.locator('#root img').count(), 0);
  assert.equal(await page.locator('#root').innerText(), 'Fallback');
  assert.equal(await page.evaluate(() => window.refs.length), 0);
  await finish('/avatar-default.svg');
  await page.locator('.avatar-root-loaded img').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-starting-style]'));
  assert.equal(await page.locator('#root').innerText(), '');
  assert.equal(await page.evaluate(() => window.refs.length), 1);
  assert.deepEqual(await page.evaluate(() => window.statuses), ['loading', 'loaded']);
  assert.equal(
    await page.locator('#root [data-image-loading-status],#root [data-imageloadingstatus]').count(),
    0,
  );
  passed.push(
    'Default preload, deferred DOM/ref, callbacks, fallback, and suppressed status attributes',
  );
  await mount({ src: '/avatar-error.svg' });
  await finish('/avatar-error.svg', true);
  await page.locator('.avatar-root-error').waitFor();
  assert.equal(await page.locator('#root img').count(), 0);
  assert.equal(await page.locator('#root').innerText(), 'Fallback');
  passed.push('Default failure stays unmounted and exposes fallback');
  await mount({ src: '/avatar-kept.svg', keepMounted: true });
  await page.locator('.avatar-root-loading img[data-loading]').waitFor({ state: 'attached' });
  assert.equal(await page.locator('#root img').getAttribute('aria-hidden'), 'true');
  assert.notEqual(await page.locator('#root img').evaluate((e) => e.style.display), 'none');
  await page.evaluate(() => (window.keptImage = document.querySelector('#root img')));
  await finish('/avatar-kept.svg');
  await page.locator('.avatar-root-loaded').waitFor();
  assert.equal(
    await page.evaluate(() => window.keptImage === document.querySelector('#root img')),
    true,
  );
  assert.equal(await page.locator('#root img').getAttribute('aria-hidden'), null);
  passed.push('keepMounted retains native img with loading accessibility state');
  await page.evaluate(() => window.setAvatarSource('/avatar-kept-error.svg'));
  await finish('/avatar-kept-error.svg', true);
  await page.locator('.avatar-root-error img[data-error]').waitFor();
  assert.equal(await page.locator('#root img').getAttribute('aria-hidden'), 'true');
  passed.push('keepMounted failure retains image and error hook');
  await mount({ srcSet: '/avatar-responsive.svg 1x' });
  await page.locator('.avatar-root-loading').waitFor();
  await finish('/avatar-responsive.svg');
  await page.locator('.avatar-root-loaded img').waitFor();
  assert.equal(await page.locator('#root img').getAttribute('srcset'), '/avatar-responsive.svg 1x');
  passed.push('srcSet-only preload is supported');
  await mount({ src: '/avatar-stale.svg' });
  await page.locator('.avatar-root-loading').waitFor();
  await page.evaluate(() => window.setAvatarSource('/avatar-current.svg'));
  await finish('/avatar-stale.svg');
  await page.waitForTimeout(25);
  assert.equal(await page.locator('.avatar-root-loaded').count(), 0);
  await finish('/avatar-current.svg');
  await page.locator('.avatar-root-loaded img').waitFor();
  assert.equal(await page.locator('#root img').getAttribute('src'), '/avatar-current.svg');
  passed.push('Source changes ignore stale load callbacks');
  await mount({ src: '/avatar-dispose.svg' });
  await page.locator('.avatar-root-loading').waitFor();
  await page.evaluate(() => window.disposeAvatar());
  await finish('/avatar-dispose.svg');
  await page.waitForTimeout(25);
  assert.equal(await page.locator('#root').innerText(), '');
  passed.push('Disposal cancels pending status callbacks');
  await mount({ delay: 10000 });
  assert.equal(await page.locator('#root').innerText(), '');
  await page.evaluate(() => window.setAvatarDelay(0));
  await page.getByText('Fallback', { exact: true }).waitFor();
  await page.evaluate(() => window.setAvatarDelay(10000));
  assert.equal(await page.locator('#root').innerText(), 'Fallback');
  passed.push('Fallback delay change to zero and visible latch');
  const dataImage = 'data:image/svg+xml,' + encodeURIComponent(image);
  await mount({ src: dataImage });
  await page.locator('.avatar-root-loaded img').waitFor();
  await page.locator('#root img').evaluate((image) => image.decode());
  await mount({ src: dataImage, keepMounted: true });
  await page.locator('.avatar-root-loaded img').waitFor();
  assert.equal(await page.locator('#root img').getAttribute('aria-hidden'), null);
  passed.push('Cached decoded image is detected in keepMounted mode');
  await page.addStyleTag({
    content:
      '@keyframes avatar-hide{from{opacity:1}to{opacity:0}}.avatar-image[data-ending-style]{animation:avatar-hide 150ms both}',
  });
  await mount({ src: dataImage });
  await page.locator('.avatar-root-loaded img').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-starting-style]'));
  await page.evaluate(() => window.setAvatarSource('/avatar-fade-error.svg'));
  await page.locator('img[data-ending-style]').waitFor({ state: 'attached' });
  assert.equal(await page.locator('#root img').count(), 1);
  await finish('/avatar-fade-error.svg', true);
  await page.locator('#root img').waitFor({ state: 'detached' });
  assert.equal(await page.locator('#root').innerText(), 'Fallback');
  passed.push('Default image stays mounted for its declared exit animation');
  await page.evaluate(() => window.disposeAvatar());
  assert.deepEqual(errors, []);
  passed.push('No Solid lifecycle or browser exceptions');
  console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
