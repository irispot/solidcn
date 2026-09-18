import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import solid from '@solidjs/vite-plugin';
import { chromium } from 'playwright';
import { transformExample } from './transform.mjs';

// Independent browser checks for the converter. No original test or example
// file is changed. The fixture goes through the real TSX transform and compiler.
export async function checkHookAdapters() {
  const source = `
import * as React from 'react';
function Child({value = 0, ...rest}: {value?: number}) {
  const label = value * 3;
  React.useEffect(() => {window.events.push('child:'+value); return () => window.events.push('child-clean:'+value)}, [value]);
  return <output data-child {...rest}>{label}</output>;
}
function First(){return <span data-dynamic>First</span>}
function Second(){return <span data-dynamic>Second</span>}
function Guard({show}) {if (!show) return <span data-guard>Hidden</span>;return <span data-guard>Shown</span>}
function ObjectProps(props) {React.useEffect(()=>{const listener=()=>window.events.push('props-snapshot:'+props.value);window.addEventListener('props-probe',listener);return()=>window.removeEventListener('props-probe',listener)},[]);return <span/>}
function RenderOwner(props) {return props.render({'data-render':'kept'}, {get value(){return props.value}})}
function DestructuredClass({className,...props}) {return <span data-destructured-class className={className} {...props}/>}
function ObjectClass(props) {return <span data-object-class className={props.className}/>}
function Row({id,label,index}) {React.useEffect(()=>{window.rowMounts.push(id);return()=>window.rowCleanups.push(id)},[]);return <p data-row={id}>{label}:{index}</p>}
function readData() {window.asyncCalls++;return new Promise(resolve=>{window.resolveAsync=resolve})}
async function AsyncData() {const data=await readData();return <output data-async>{data.label}</output>}
function Probe() {
  const [rows,setRows] = React.useState([{id:'a',label:'First'},{id:'b',label:'Second'}]);
  const [count,setCount] = React.useState(0);
  const [other,setOther] = React.useState(0);
  const [initial] = React.useState(count);
  const doubled = count * 2;
  const stateObject = { 'data-derived': doubled };
  const Tag = count % 2 ? Second : First;
  const id = React.useId();
  const secondId = React.useId();
  const ref = React.useRef<HTMLButtonElement|null>(null);
  const memo = React.useMemo(() => {window.memoRuns++; return {parity:count % 2};}, [count % 2]);
  const stable = React.useCallback(() => count, []);
  const current = React.useCallback(() => count, [count]);
  React.useLayoutEffect(() => {window.events.push('layout:'+!!ref.current);return () => window.events.push('layout-clean')}, []);
  React.useEffect(() => {window.events.push('effect:'+count);const listen=()=>window.events.push('listen:'+count);window.addEventListener('probe',listen);return ()=>{window.events.push('cleanup:'+count);window.removeEventListener('probe',listen)}}, [count]);
  React.useEffect(() => {const listen=()=>window.events.push('stable:'+count);window.addEventListener('stable-probe',listen);return ()=>window.removeEventListener('stable-probe',listen)}, []);
  React.useEffect(() => {window.readRef=()=>ref.current;const timer=setTimeout(()=>window.events.push('timer'),10000);return ()=>{clearTimeout(timer);window.events.push('timer-clean')}}, []);
  return <section>
    <button id={id} ref={ref} data-count onClick={()=>setCount(count+1)} {...stateObject}>{count}</button>
    <button id={secondId} data-other onClick={()=>setOther(other+1)}>Other {other}</button>
    <button data-two onClick={()=>setCount(count+2)}>Two</button>
    <button data-callback onClick={()=>window.callbacks.push([stable(),current()])}>Callbacks</button>
    <output data-memo>{memo.parity}</output><output data-initial>{initial}</output>
    <label htmlFor={id}>Count</label><Child value={count} data-live-child />
    <Tag/><Guard show={count > 0}/><ObjectProps value={count}/><RenderOwner value={count} render={(props,state)=><output {...props}>{state.value}</output>}/>
    <DestructuredClass className={'passed-'+count}/><ObjectClass className={'passed-'+count}/>
    <svg data-svg viewBox="0 0 20 20"><g clipPath="url(#probe-clip)" clipRule="evenodd"><path strokeWidth="2" strokeLinecap="round" fillRule="evenodd" d="M0 0h10v10z"/></g></svg>
    <React.Suspense fallback={<span data-async-pending>Loading</span>}><AsyncData/></React.Suspense>
    <button data-rows-update onClick={()=>setRows(rows.slice().reverse().map(row=>({...row,label:row.label+' updated'})))}>Update rows</button>
    <div data-keyed-rows>{rows.map((row,index)=><Row key={row.id} id={row.id} label={row.label} index={index}/>)}</div>
    <div data-index-rows>{rows.map((row,index)=><span key={index}>{row.label}</span>)}</div>
  </section>;
}
`;
  const converted = transformExample(source, 'hooks-browser.tsx');
  const workspace = resolve(import.meta.dirname, '../../..');
  const entry = resolve(import.meta.dirname, 'hooks-virtual-probe.tsx');
  const server = await createServer({
    configFile: false,
    root: workspace,
    logLevel: 'error',
    optimizeDeps: { entries: [], include: ['solid-js', '@solidjs/web'] },
    plugins: [
      {
        name: 'read-only-hooks-probe',
        resolveId(id) {
          if (id === '/hooks-probe.tsx') return entry;
          if (id === 'virtual:solid-doc-runtime') return resolve(import.meta.dirname, 'runtime.ts');
          if (id === 'virtual:solid-doc-adapter/async') return resolve(import.meta.dirname, 'adapters/async.ts');
        },
        load(id) {
          if (id === entry)
            return `${converted.code}\nimport {render,createComponent} from '@solidjs/web';window.disposeProbe=render(()=>createComponent(Probe,{}),document.getElementById('root'));window.probeReady=true;`;
        },
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (request.url !== '/') return next();
            response.setHeader('content-type', 'text/html');
            response.end(
              '<div id="root"></div><script>window.events=[];window.callbacks=[];window.memoRuns=0;window.asyncCalls=0;window.rowMounts=[];window.rowCleanups=[];</script><script type="module" src="/hooks-probe.tsx"></script>',
            );
          });
        },
      },
      solid(),
    ],
    server: { host: '127.0.0.1', port: 0, hmr: false, ws: false, fs: { allow: [workspace] } },
  });
  let browser;
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.probeReady, { timeout: 10000 });
    assert.deepEqual(errors, []);
    await page.waitForFunction(() => window.events.includes('effect:0'));
    assert.ok(
      await page.evaluate(() => window.events.includes('layout:true')),
      'Layout effect must run after the DOM ref is set.',
    );
    assert.equal(await page.locator('[data-child]').textContent(), '0');
    assert.equal(await page.locator('[data-dynamic]').textContent(), 'First');
    assert.equal(await page.locator('[data-guard]').textContent(), 'Hidden');
    assert.equal(await page.locator('[data-async-pending]').textContent(), 'Loading');
    assert.equal(await page.evaluate(() => window.asyncCalls), 1);
    await page.evaluate(() => window.resolveAsync({label: 'Original data'}));
    await page.waitForFunction(() => document.querySelector('[data-async]')?.textContent === 'Original data');
    assert.equal(await page.locator('[data-async-pending]').count(), 0);
    assert.equal(await page.locator('[data-destructured-class]').getAttribute('class'), 'passed-0');
    assert.equal(await page.locator('[data-object-class]').getAttribute('class'), 'passed-0');
    assert.equal(await page.locator('[data-svg]').getAttribute('viewBox'), '0 0 20 20');
    assert.equal(await page.locator('[data-svg] g').getAttribute('clip-path'), 'url(#probe-clip)');
    assert.equal(await page.locator('[data-svg] g').getAttribute('clip-rule'), 'evenodd');
    assert.equal(await page.locator('[data-svg] path').getAttribute('stroke-width'), '2');
    assert.equal(await page.locator('[data-svg] path').getAttribute('stroke-linecap'), 'round');
    assert.equal(await page.locator('[data-svg] path').getAttribute('fill-rule'), 'evenodd');
    await page.evaluate(() => { window.firstKeyedRow = document.querySelector('[data-row=a]');window.firstIndexRow = document.querySelector('[data-index-rows] span'); });
    await page.locator('[data-rows-update]').click();
    assert.deepEqual(await page.locator('[data-keyed-rows] p').allTextContents(), ['Second updated:0','First updated:1']);
    assert.equal(await page.evaluate(() => window.firstKeyedRow === document.querySelector('[data-row=a]')), true);
    assert.equal(await page.evaluate(() => window.firstIndexRow === document.querySelector('[data-index-rows] span')), true);
    assert.deepEqual(await page.evaluate(() => window.rowMounts), ['a','b']);
    assert.deepEqual(await page.evaluate(() => window.rowCleanups), []);
    const ids = await page
      .locator('button[id]')
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(new Set(ids).size, 2);
    assert.equal(await page.locator('label').getAttribute('for'), ids[0]);
    await page.locator('[data-other]').click();
    assert.equal(await page.evaluate(() => window.memoRuns), 1);
    assert.equal(
      await page.evaluate(() => window.events.filter((item) => item.startsWith('effect:')).length),
      1,
    );
    await page.locator('[data-count]').click();
    await page.waitForFunction(() => window.events.includes('effect:1'));
    assert.equal(await page.locator('[data-count]').getAttribute('data-derived'), '2');
    assert.equal(await page.locator('[data-child]').textContent(), '3');
    assert.equal(await page.locator('[data-dynamic]').textContent(), 'Second');
    assert.equal(await page.locator('[data-guard]').textContent(), 'Shown');
    assert.equal(await page.locator('[data-render]').textContent(), '1');
    assert.equal(await page.locator('[data-render]').getAttribute('data-render'), 'kept');
    assert.equal(await page.locator('[data-initial]').textContent(), '0');
    assert.equal(await page.locator('[data-destructured-class]').getAttribute('class'), 'passed-1');
    assert.equal(await page.locator('[data-object-class]').getAttribute('class'), 'passed-1');
    assert.equal(await page.evaluate(() => window.asyncCalls), 1, 'Async data must not restart after an unrelated state update.');
    assert.equal(await page.evaluate(() => window.memoRuns), 2);
    await page.locator('[data-two]').click();
    await page.waitForFunction(() => window.events.includes('effect:3'));
    assert.equal(
      await page.evaluate(() => window.memoRuns),
      2,
      'Equivalent dependency arrays must not recompute memo.',
    );
    await page.locator('[data-callback]').click();
    assert.deepEqual(await page.evaluate(() => window.callbacks), [[0, 3]]);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('probe'));
      window.dispatchEvent(new Event('stable-probe'));
      window.dispatchEvent(new Event('props-probe'));
    });
    const events = await page.evaluate(() => window.events);
    assert.ok(events.includes('listen:3'));
    assert.ok(events.includes('stable:0'), 'An empty dependency effect keeps its initial closure.');
    assert.ok(
      events.includes('props-snapshot:0'),
      'Props fields in a callback keep their captured value.',
    );
    assert.ok(events.indexOf('cleanup:0') < events.indexOf('effect:1'));
    assert.ok(events.includes('child:3') && events.includes('child-clean:1'));
    assert.deepEqual(
      await page.locator('button[id]').evaluateAll((nodes) => nodes.map((node) => node.id)),
      ids,
    );
    await page.evaluate(() => window.disposeProbe());
    assert.equal(await page.evaluate(() => window.readRef()), null);
    assert.ok(
      await page.evaluate(
        () =>
          window.events.includes('cleanup:3') &&
          window.events.includes('layout-clean') &&
          window.events.includes('timer-clean'),
      ),
    );
    const before = await page.evaluate(() => window.events.length);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('probe'));
      window.dispatchEvent(new Event('stable-probe'));
    });
    assert.equal(
      await page.evaluate(() => window.events.length),
      before,
      'Disposed effects must remove event listeners.',
    );
    assert.deepEqual(errors, []);
    return {
      passed: true,
      checks: [
        'effect-dependencies',
        'effect-cleanup',
        'closure-snapshots',
        'layout-after-ref',
        'memo-dependency-equality',
        'stable-and-updated-callbacks',
        'unique-stable-ids',
        'live-props',
        'derived-locals',
        'one-time-state-initializers',
        'unmount-cleanup',
        'ref-disposal',
        'reactive-tail-returns',
        'dynamic-component-tags',
        'live-render-function-props',
        'live-local-component-class-names',
        'async-data-loading-boundary',
        'async-data-single-call',
        'native-svg-attribute-names',
        'keyed-list-node-identity-live-values-and-indices',
      ],
      runtime: 'Solid 2.0.0-rc.8 Chromium',
    };
  } finally {
    await browser?.close();
    await server.close();
  }
}

if (process.argv[1] === import.meta.filename)
  console.log(JSON.stringify(await checkHookAdapters(), null, 2));
