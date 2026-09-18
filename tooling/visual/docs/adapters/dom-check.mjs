import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { transformExample } from '../transform.mjs';

// Independent behavioral checks. No original tests or examples are changed.
const entry = resolve(import.meta.dirname, 'dom-virtual-probe.tsx');
const source = `
import * as React from 'react';
import {useTable,tableFeatures,createColumnHelper,columnFilteringFeature,columnVisibilityFeature,rowSortingFeature,rowSelectionFeature,createFilteredRowModel,createSortedRowModel,filterFn_includesString,sortFn_text} from '@tanstack/react-table';
import TextareaAutosize from 'react-textarea-autosize';
import {useIsMobile} from '@/hooks/use-mobile';
import {useCopyToClipboard} from '@/hooks/use-copy-to-clipboard';
const features=tableFeatures({columnFilteringFeature,columnVisibilityFeature,rowSortingFeature,rowSelectionFeature,filteredRowModel:createFilteredRowModel(),sortedRowModel:createSortedRowModel(),filterFns:{includesString:filterFn_includesString},sortFns:{text:sortFn_text}});
const helper=createColumnHelper();
const columns=helper.columns([helper.accessor('name',{header:'Name',filterFn:'includesString',sortingFn:'text',cell:({row})=><span>{row.getValue('name')}</span>})]);
const data=[{id:'c',name:'Carol'},{id:'a',name:'Alice'},{id:'b',name:'Bob'}];
function Probe(){
 const [sorting,setSorting]=React.useState([]);
 const [columnFilters,setColumnFilters]=React.useState([]);
 const [rowSelection,setRowSelection]=React.useState({});
 const [text,setText]=React.useState('');
 const mobile=useIsMobile();
 const copied=useCopyToClipboard({timeout:25,onCopy:()=>window.copies++});
 const table=useTable({features,data,columns,getRowId:row=>row.id,state:{sorting,columnFilters,rowSelection},onSortingChange:setSorting,onColumnFiltersChange:setColumnFilters,onRowSelectionChange:setRowSelection});
 React.useEffect(()=>{window.initialTable=table;window.probeReady=true;return()=>window.probeDisposed=true},[]);
 return <section>
  <input data-filter value={table.getColumn('name').getFilterValue()??''} onChange={event=>table.getColumn('name').setFilterValue(event.target.value)}/>
  <button data-sort onClick={()=>table.getColumn('name').toggleSorting(false)}>Sort</button>
  <button data-select onClick={()=>table.getRow('a').toggleSelected()}>Select</button>
  <button data-identity onClick={()=>window.sameTable=table===window.initialTable}>Identity</button>
  <output data-selected>{Object.keys(table.state.rowSelection).join(',')}</output>
  <output data-mobile>{String(mobile)}</output>
  <div data-rows>{table.getRowModel().rows.map(row=><p data-row={row.id}><table.FlexRender cell={row.getVisibleCells()[0]}/></p>)}</div>
  <form data-form><TextareaAutosize data-uncontrolled minRows={2} maxRows={4} defaultValue="initial" onHeightChange={(height,meta)=>window.heights.push([height,meta.rowHeight])}/><button type="reset">Reset</button></form>
  <TextareaAutosize data-controlled value={text} onChange={event=>setText(event.target.value)}/>
  <button data-clear onClick={()=>setText('')}>Clear</button>
  <button data-copy onClick={()=>copied.copyToClipboard('copied text')}>Copy</button>
  <output data-copied>{String(copied.isCopied)}</output>
 </section>
}
`;
const converted = transformExample(source, 'dom-probe.tsx').code;
const server = await createServer({
  configFile: resolve(import.meta.dirname, '../../apps/solid/vite.config.ts'),
  logLevel: 'error',
  plugins: [{
    name: 'native-dom-adapter-check',
    resolveId(id) { if (id === '/dom-probe.tsx') return entry; },
    load(id) {
      if (id === entry) return `${converted}\nimport {render,createComponent} from '@solidjs/web';window.disposeProbe=render(()=>createComponent(Probe,{}),document.getElementById('root'));`;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== '/dom-probe') return next();
        response.setHeader('content-type', 'text/html');
        response.end('<style>textarea{box-sizing:border-box;width:220px;font:16px/20px monospace;padding:4px;border:1px solid}</style><div id="root"></div><script>window.heights=[];window.copies=0;</script><script type="module" src="/dom-probe.tsx"></script>');
      });
    },
  }],
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, ws: false },
});
const passed = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [], modules = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => modules.push(response.url()));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/dom-probe`);
  await page.waitForFunction(() => window.probeReady, null, { timeout: 10000 }).catch(error => {
    throw new Error(`DOM adapter probe did not mount: ${errors.join('\n')}`, { cause: error });
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.locator('[data-row]').allTextContents(), ['Carol', 'Alice', 'Bob']);
  await page.locator('[data-filter]').fill('al');
  await page.waitForFunction(() => document.querySelectorAll('[data-row]').length === 1);
  assert.deepEqual(await page.locator('[data-row]').allTextContents(), ['Alice']);
  await page.locator('[data-filter]').fill('');
  await page.locator('[data-sort]').click();
  assert.deepEqual(await page.locator('[data-row]').allTextContents(), ['Alice', 'Bob', 'Carol']);
  await page.locator('[data-select]').click();
  assert.equal(await page.locator('[data-selected]').textContent(), 'a');
  await page.locator('[data-identity]').click();
  assert.equal(await page.evaluate(() => window.sameTable), true);
  passed.push('Original row models: filtering, sorting, controlled selection, stable table identity, native cell rendering');
  assert.equal(await page.locator('[data-mobile]').textContent(), 'false');
  await page.setViewportSize({ width: 500, height: 700 });
  await page.waitForFunction(() => document.querySelector('[data-mobile]').textContent === 'true');
  passed.push('Live media-query changes');
  const uncontrolled = page.locator('[data-uncontrolled]');
  const height = target => target.evaluate(node => node.getBoundingClientRect().height);
  assert.equal(await height(uncontrolled), 50);
  await uncontrolled.fill('one\ntwo\nthree\nfour\nfive\nsix');
  assert.equal(await height(uncontrolled), 90);
  await page.locator('[type=reset]').click();
  await page.waitForFunction(() => document.querySelector('[data-uncontrolled]').getBoundingClientRect().height === 50);
  assert.equal(await uncontrolled.inputValue(), 'initial');
  const controlled = page.locator('[data-controlled]');
  await controlled.fill('one\ntwo\nthree');
  await page.waitForFunction(() => document.querySelector('[data-controlled]').getBoundingClientRect().height === 70);
  await page.locator('[data-clear]').click();
  await page.waitForFunction(() => document.querySelector('[data-controlled]').getBoundingClientRect().height === 30);
  assert.ok((await page.evaluate(() => window.heights)).every(([, rowHeight]) => rowHeight === 20));
  passed.push('Textarea controlled and uncontrolled growth, min/max rows, form reset, row-height callback');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.clipboardText = value; } } }); });
  await page.locator('[data-copy]').click();
  assert.equal(await page.evaluate(() => window.clipboardText), 'copied text');
  assert.equal(await page.evaluate(() => window.copies), 1);
  await page.waitForFunction(() => document.querySelector('[data-copied]').textContent === 'false');
  passed.push('Clipboard command, callback and reset');
  await page.evaluate(() => window.disposeProbe());
  assert.equal(await page.locator('textarea').count(), 0, 'Unmount must remove measurement textareas.');
  assert.equal(await page.evaluate(() => window.probeDisposed), true);
  assert.deepEqual(errors, []);
  assert.equal(modules.some(url => /\/react(?:-dom)?(?:[/.?]|$)|\/deps\/react(?:_|\.)/.test(url)), false);
  passed.push('Cleanup, no browser errors, no React runtime');
  console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
