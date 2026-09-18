import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const archives = [];
for (const workspace of ['@solid-cn/base-ui', '@solid-cn/ui']) {
  const output = JSON.parse(
    execFileSync(
      'npm',
      ['pack', `--workspace=${workspace}`, '--pack-destination', artifacts, '--json'],
      { cwd: root, encoding: 'utf8' },
    ),
  );
  archives.push(resolve(artifacts, output[0].filename));
}
const directory = await mkdtemp(resolve(tmpdir(), 'solid-cn-package-check-'));
await writeFile(
  resolve(directory, 'package.json'),
  JSON.stringify(
    {
      name: 'solid-cn-consumer-check',
      private: true,
      type: 'module',
      dependencies: {
        '@solid-cn/base-ui': `file:${archives[0]}`,
        '@solid-cn/ui': `file:${archives[1]}`,
        'solid-js': '2.0.0-rc.8',
        '@solidjs/web': '2.0.0-rc.8',
      },
      devDependencies: {
        vite: '8.3.0',
        '@solidjs/vite-plugin': '3.0.0-next.43',
        '@tailwindcss/vite': '4.3.3',
        tailwindcss: '4.3.3',
        typescript: '5.9.3',
      },
    },
    null,
    2,
  ),
);
await writeFile(
  resolve(directory, 'index.html'),
  '<!doctype html><html class="style-nova"><head><meta charset="utf-8"><title>Packed Solid consumer</title></head><body><div id="app"></div><script type="module" src="/main.tsx"></script></body></html>',
);
await writeFile(
  resolve(directory, 'App.tsx'),
  `import { createSignal } from 'solid-js';
import { Button as BaseButton } from '@solid-cn/base-ui/button';
import { Checkbox } from '@solid-cn/base-ui/checkbox';
import { Button } from '@solid-cn/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@solid-cn/ui/dialog';
export function App() {
  const [count, setCount] = createSignal(0);
  const [checked, setChecked] = createSignal(false);
  return <main>
    <BaseButton data-probe="base" onClick={() => setCount(value => value + 1)}>Base count: {count()}</BaseButton>
    <Button data-probe="styled" onClick={() => setCount(value => value + 1)}>Styled count: {count()}</Button>
    <Checkbox.Root data-probe="checkbox" checked={checked()} onCheckedChange={value => setChecked(value)} aria-label="Accept" style={{display:'inline-block',width:'24px',height:'24px',border:'1px solid black'}}><Checkbox.Indicator>✓</Checkbox.Indicator></Checkbox.Root>
    <output data-probe="value">{checked() ? 'Accepted' : 'Not accepted'}</output>
    <Dialog><DialogTrigger data-probe="trigger">Open</DialogTrigger><DialogContent><DialogTitle>Consumer dialog</DialogTitle></DialogContent></Dialog>
  </main>;
}
`,
);
await writeFile(
  resolve(directory, 'main.tsx'),
  `import { hydrate, render } from '@solidjs/web';
import { App } from './App';
import './style.css';
if (document.documentElement.dataset.mode === 'hydrate') hydrate(() => <App />, document.getElementById('app')!, { renderId: 'consumer' });
else render(() => <App />, document.getElementById('app')!);
document.documentElement.dataset.ready = 'true';
`,
);
await writeFile(
  resolve(directory, 'server.tsx'),
  `import { renderToString, generateHydrationScript } from '@solidjs/web';
import { App } from './App';
console.log(JSON.stringify({ html: renderToString(() => <App />, { renderId: 'consumer' }), hydrationScript: generateHydrationScript() }));
`,
);
// The shipped stylesheet must supply its own source scan, with no extra consumer override.
await writeFile(
  resolve(directory, 'style.css'),
  `@import 'tailwindcss';\n@import '@solid-cn/ui/styles.css';\n`,
);
await writeFile(
  resolve(directory, 'vite.config.ts'),
  `import { defineConfig } from 'vite'; import solid from '@solidjs/vite-plugin'; import tailwind from '@tailwindcss/vite';
const compiled = process.env.SOLID_CN_PACKAGE_ENTRY === 'compiled';
export default defineConfig({plugins:[solid({ssr:true}),tailwind(),{
  name:'package-entry-check', enforce:'post',
  configEnvironment(_name, config) { if (compiled && config.resolve) config.resolve.conditions = config.resolve.conditions?.filter(condition => condition !== 'solid'); },
  generateBundle() { this.emitFile({type:'asset',fileName:'package-modules.json',source:JSON.stringify([...this.getModuleIds()].filter(id=>id.includes('/@solid-cn/')))}); }
}]});\n`,
);
await writeFile(
  resolve(directory, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2023',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'preserve',
        jsxImportSource: '@solidjs/web',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ['*.tsx'],
    },
    null,
    2,
  ),
);
const checks = [];
const diagnostics = [];
const run = (cmd, args, environment = {}) =>
  new Promise((accept, reject) => {
    const child = spawn(cmd, args, {
      cwd: directory,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) accept(stdout);
      else
        reject(
          Object.assign(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`), {
            stdout,
            stderr,
          }),
        );
    });
  });
let server;
let browser;
const report = (passed) =>
  writeFile(
    resolve(artifacts, 'package-check.json'),
    JSON.stringify(
      {
        passed,
        archives,
        directory,
        checks,
        diagnostics,
        originalComponentTests: 'not executed by this check',
      },
      null,
      2,
    ),
  );
try {
  console.log(await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']));
  checks.push('isolated npm install');
  console.log(await run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']));
  checks.push('consumer TypeScript');
  const ssr = await run(process.execPath, [
    '--input-type=module',
    '-e',
    `import {renderToString} from '@solidjs/web'; import {createComponent} from 'solid-js'; import {Button} from '@solid-cn/base-ui/button'; import {Button as Styled} from '@solid-cn/ui/button'; import assert from 'node:assert/strict'; assert.ok((await renderToString(()=>createComponent(Button,{children:'Base'}))).includes('>Base</button>')); assert.match(await renderToString(()=>createComponent(Styled,{children:'Styled'})), /cn-button/); console.log('Packed native and styled SSR passed');`,
  ]);
  console.log(ssr);
  checks.push('native/styled Node SSR');
  browser = await chromium.launch({ headless: true });
  for (const entry of ['source', 'compiled']) {
    const environment = { SOLID_CN_PACKAGE_ENTRY: entry };
    console.log(
      await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], environment),
    );
    checks.push(`${entry}: consumer Vite production build`);
    const modulePaths = JSON.parse(
      await readFile(resolve(directory, 'dist/package-modules.json'), 'utf8'),
    ).filter((path) => /\.(?:[jt]sx?)$/.test(path));
    assert.ok(modulePaths.length > 0, 'The client bundle must include package modules.');
    assert.ok(
      modulePaths.every((path) => path.includes(entry === 'source' ? '/src/' : '/dist/')),
      `The ${entry} run must use only its selected package export.`,
    );
    diagnostics.push({ entry, modulePaths });
    console.log(
      await run(
        process.execPath,
        [
          'node_modules/vite/bin/vite.js',
          'build',
          '--ssr',
          'server.tsx',
          '--outDir',
          'dist-server',
        ],
        environment,
      ),
    );
    checks.push(`${entry}: consumer Vite SSR build`);
    const rendered = JSON.parse(await run(process.execPath, ['dist-server/server.js']));
    assert.match(
      rendered.html,
      /(?:data-hk|_hk)=/,
      'The server must produce hydration identifiers.',
    );
    assert.match(rendered.html, /Base count:/);
    assert.match(rendered.html, /cn-button/);
    checks.push(`${entry}: consumer Node SSR HTML`);
    const document = await readFile(resolve(directory, 'dist/index.html'), 'utf8');
    const hydratedDocument = document
      .replace('<html ', '<html data-mode="hydrate" ')
      .replace('</head>', `${rendered.hydrationScript}</head>`)
      .replace(
        '<div id="app"></div>',
        `<div id="app">${rendered.html}</div><script>window.__ssrNodes=Array.from(document.querySelectorAll('#app [data-probe]'))</script>`,
      );
    await writeFile(resolve(directory, 'dist/hydrate.html'), hydratedDocument);
    server = createServer(async (request, response) => {
      try {
        const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
        const file =
          pathname === '/'
            ? 'index.html'
            : pathname === '/hydrate'
              ? 'hydrate.html'
              : decodeURIComponent(pathname).slice(1);
        const path = resolve(directory, 'dist', file);
        if (!path.startsWith(`${resolve(directory, 'dist')}/`)) throw new Error('Invalid path');
        const body = await readFile(path);
        response.setHeader(
          'content-type',
          {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
          }[extname(path)] ?? 'application/octet-stream',
        );
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end('Not found');
      }
    });
    await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const mode of ['client', 'hydrate']) {
      const page = await browser.newPage();
      page.setDefaultTimeout(8000);
      const errors = [];
      diagnostics.push({ entry, mode, errors });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (
          ['warning', 'error'].includes(message.type()) &&
          /hydrat|mismatch/i.test(message.text())
        )
          errors.push(message.text());
      });
      await page.goto(mode === 'client' ? origin : `${origin}/hydrate`, {
        waitUntil: 'networkidle',
      });
      await page.locator('html[data-ready="true"]').waitFor({ state: 'attached' });
      if (mode === 'hydrate') {
        assert.equal(await page.evaluate(() => window.__ssrNodes.length), 5);
        assert.equal(
          await page.evaluate(() =>
            window.__ssrNodes.every(
              (node) =>
                node.isConnected &&
                node === document.querySelector(`[data-probe="${node.dataset.probe}"]`),
            ),
          ),
          true,
          'Hydration must retain every server-rendered component node.',
        );
      }
      const base = page.locator('[data-probe=base]');
      const styled = page.locator('[data-probe=styled]');
      await base.click();
      await styled.filter({ hasText: 'Styled count: 1' }).waitFor();
      await styled.click();
      await base.filter({ hasText: 'Base count: 2' }).waitFor();
      assert.notEqual(
        await styled.evaluate((node) => getComputedStyle(node).backgroundColor),
        'rgba(0, 0, 0, 0)',
        'The packed stylesheet must style its button.',
      );
      assert.ok((await styled.evaluate((node) => node.getBoundingClientRect().height)) >= 20);
      await page.getByRole('checkbox', { name: 'Accept' }).click();
      await page
        .locator('[data-probe=value]')
        .filter({ hasText: /^Accepted$/ })
        .waitFor();
      assert.equal(
        await page.getByRole('checkbox', { name: 'Accept' }).getAttribute('aria-checked'),
        'true',
      );
      await page.getByRole('button', { name: 'Open', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Consumer dialog' });
      await dialog.waitFor();
      assert.notEqual(
        await dialog.evaluate((node) => getComputedStyle(node).backgroundColor),
        'rgba(0, 0, 0, 0)',
        'The packed stylesheet must also style portal content.',
      );
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal(
        await page
          .locator('[data-probe=trigger]')
          .evaluate((node) => node === document.activeElement),
        true,
      );
      assert.deepEqual(errors, [], `${mode} browser errors or hydration warnings`);
      checks.push(
        `${entry}: ${mode === 'client' ? 'packed production browser events, CSS, checkbox, and dialog' : 'SSR hydration node identity, events, CSS, checkbox, and dialog'}`,
      );
      await page.close();
    }
    await new Promise((accept) => server.close(accept));
    server = undefined;
  }
  await report(true);
  console.log(`Package consumer check passed. Temporary project: ${directory}`);
} catch (error) {
  console.error(error.stdout?.toString() ?? '');
  console.error(error.stderr?.toString() ?? '');
  console.error(error);
  diagnostics.push({ failure: error.message });
  await report(false);
  console.error(`Package consumer check failed. Temporary project: ${directory}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise((accept) => server.close(accept));
}
