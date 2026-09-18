import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { transformAsync } from '@babel/core';
import solid from '@solidjs/babel-plugin';
const origin = process.env.SOLID_CN_URL ?? 'http://127.0.0.1:5173';
const raw = await (await fetch(origin + '/base-ui/packages/solid/src/selection.tsx')).text();
const web = origin + raw.match(/from "([^"]*\/deps\/@solidjs_web[^"]+)"/)[1];
const runtime = origin + raw.match(/from "([^"]*\/deps\/solid-js[^"]+)"/)[1];
let code = `import {For,createSignal} from 'solid-js'; import {render} from '@solidjs/web'; import {Combobox,Autocomplete,Select} from 'http://127.0.0.1:5173/base-ui/packages/solid/src/selection.tsx'; import {Field} from 'http://127.0.0.1:5173/base-ui/packages/solid/src/controls.tsx';
const objects=[{id:1,label:'Café'},{id:2,label:'Tea'},{id:3,label:'Water'}];
const actions={current:null};globalThis.selectionActions=actions;
function Fixture(){const [externalValue,setExternalValue]=createSignal('');return <section id="manual-selection">
<form id="multi-form"><Combobox.Root multiple items={['Apple','Banana','Cherry']} defaultValue={['Apple']} name="fruit"><Combobox.Chips><Combobox.Value>{values=><For each={values}>{item=><Combobox.Chip value={item}><span>{item}</span><Combobox.ChipRemove>×</Combobox.ChipRemove></Combobox.Chip>}</For>}</Combobox.Value><Combobox.Input aria-label="Multi fruit" /></Combobox.Chips><Combobox.Portal><Combobox.Positioner sideOffset={5}><Combobox.Popup class="menu"><Combobox.List>{item=><Combobox.Item value={item}>{item}<Combobox.ItemIndicator>Selected</Combobox.ItemIndicator></Combobox.Item>}</Combobox.List></Combobox.Popup></Combobox.Positioner></Combobox.Portal></Combobox.Root></form>
<Combobox.Root items={objects} defaultValue={objects[1]} isItemEqualToValue={(a,b)=>a?.id===b?.id}><Combobox.Input aria-label="Object drink"/><Combobox.Portal><Combobox.Positioner><Combobox.Popup class="menu"><Combobox.List>{item=><Combobox.Item value={item}>{item.label}</Combobox.Item>}</Combobox.List><Combobox.Empty>No drink</Combobox.Empty></Combobox.Popup></Combobox.Positioner></Combobox.Portal></Combobox.Root>
<Autocomplete.Root items={objects} itemToStringValue={item=>item.label} autoHighlight><Autocomplete.Input aria-label="Complete drink"/><Autocomplete.Value>{value=><output id="complete-value">{value}</output>}</Autocomplete.Value><Autocomplete.Portal><Autocomplete.Positioner><Autocomplete.Popup class="menu"><Autocomplete.List>{item=><Autocomplete.Item value={item}>{item.label}</Autocomplete.Item>}</Autocomplete.List></Autocomplete.Popup></Autocomplete.Positioner></Autocomplete.Portal></Autocomplete.Root>
<Autocomplete.Root mode="both" value={externalValue()} onValueChange={setExternalValue} items={['alpha','alpine','beta']}><Autocomplete.Input aria-label="Both modes"/><Autocomplete.Portal><Autocomplete.Positioner><Autocomplete.Popup class="menu"><Autocomplete.List>{item=><Autocomplete.Item value={item}>{item}</Autocomplete.Item>}</Autocomplete.List></Autocomplete.Popup></Autocomplete.Positioner></Autocomplete.Portal></Autocomplete.Root><button type="button" onClick={()=>setExternalValue('be')}>External inline value</button>
<Autocomplete.Root mode="inline" items={['alpha','beta','gamma']}><Autocomplete.Input aria-label="Inline only"/><Autocomplete.Portal><Autocomplete.Positioner><Autocomplete.Popup class="menu"><Autocomplete.List>{item=><Autocomplete.Item value={item}>{item}</Autocomplete.Item>}</Autocomplete.List></Autocomplete.Popup></Autocomplete.Positioner></Autocomplete.Portal></Autocomplete.Root>
<Select.Root items={[{value:'a',label:'First'},{value:'b',label:'Second'}]} defaultValue="b"><Select.Trigger aria-label="Aligned"><Select.Value/></Select.Trigger><Select.Portal><Select.Positioner><Select.Popup class="menu" id="aligned-popup"><Select.Item value="a"><Select.ItemText>First</Select.ItemText></Select.Item><Select.Item value="b"><Select.ItemText>Second</Select.ItemText></Select.Item></Select.Popup></Select.Positioner></Select.Portal></Select.Root>
<Select.Root defaultValue="a" actionsRef={actions}><Select.Trigger aria-label="Manual exit">Manual</Select.Trigger><Select.Portal><Select.Positioner><Select.Popup class="menu" id="manual-popup"><Select.Item value="a">First</Select.Item></Select.Popup></Select.Positioner></Select.Portal></Select.Root>
<Select.Root><Select.Trigger aria-label="Animated exit">Animated</Select.Trigger><Select.Portal><Select.Positioner><Select.Popup class="menu" id="exit-popup"><Select.Item value="a">First</Select.Item></Select.Popup></Select.Positioner></Select.Portal></Select.Root>
<form id="field-form"><Field.Root name="drink" validationMode="onBlur"><Field.Label>Required drink</Field.Label><Field.Description>Choose a drink</Field.Description><Select.Root required items={[{value:'tea',label:'Tea'}]}><Select.Trigger><Select.Value placeholder="Choose"/></Select.Trigger><Select.Portal><Select.Positioner><Select.Popup class="menu"><Select.Item value="tea">Tea</Select.Item></Select.Popup></Select.Positioner></Select.Portal></Select.Root><Field.Error/></Field.Root><button>Submit field</button></form>
</section>}; export function mount(){document.getElementById('app').style.display='none';const node=document.createElement('div');document.body.appendChild(node);return render(Fixture,node)}`;
code = code.replaceAll('http://127.0.0.1:5173', origin);
code = code.replace(
  origin + '/base-ui/packages/solid/src/controls.tsx',
  origin + raw.match(/from "([^"]*\/controls\.tsx[^"]*)"/)[1],
);
const compiled = (
  await transformAsync(code, {
    filename: 'manual.jsx',
    configFile: false,
    babelrc: false,
    plugins: [[solid, { generate: 'dom' }]],
  })
).code
  .replaceAll('"solid-js"', JSON.stringify(runtime))
  .replaceAll("'solid-js'", JSON.stringify(runtime))
  .replaceAll('"@solidjs/web"', JSON.stringify(web))
  .replaceAll("'@solidjs/web'", JSON.stringify(web));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
page.setDefaultTimeout(3000);
// The preview can be edited while this probe runs. Keep its module graph fixed
// for the duration of the checks; hot reload is not a component behavior check.
await page.route('**/@vite/client', (route) =>
  route.fulfill({
    contentType: 'application/javascript',
    body: `
const styles = new Map();
export function updateStyle(id, text) { let style = styles.get(id); if (!style) { style = document.createElement('style'); document.head.appendChild(style); styles.set(id, style); } style.textContent = text; }
export function removeStyle(id) { styles.get(id)?.remove(); styles.delete(id); }
export function createHotContext() { return { data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; }
export function injectQuery(url) { return url; }
`,
  }),
);
const report = {
  version: '2.0.0-rc.8',
  source: 'native Solid browser modules; original tests unchanged',
  checkedAt: new Date().toISOString(),
  passed: false,
  checks: [],
  failure: null,
};
let failure;
function record(result) {
  assert.deepEqual(result.errors, [], 'The browser must not report errors.');
  const expected = {
    multiple: {
      form: [
        ['fruit', 'Apple'],
        ['fruit', 'Banana'],
      ],
    },
    remove: { form: [['fruit', 'Banana']] },
    'object-filter': { options: ['Café'] },
    'object-select': { value: 'Café' },
    autocomplete: { value: 'Water', output: 'Water' },
    'inline-both-filter': { value: 'alpha', options: ['alpha', 'alpine'] },
    'inline-hover': { value: 'alpha' },
    'inline-external': { value: 'be' },
    'inline-static': { value: 'alphab', options: ['alpha', 'beta', 'gamma'] },
    'manual-retained': { count: 1 },
    'manual-unmounted': { count: 0, overflow: '' },
    'animation-retained': { count: 1 },
    'animation-complete': { count: 0 },
    'field-valid': { invalid: null, form: [['drink', 'tea']] },
  }[result.stage];
  if (expected)
    for (const [key, value] of Object.entries(expected))
      assert.deepEqual(result[key], value, result.stage + ': ' + key);
  else if (result.stage === 'alignment-lock') {
    assert.ok(
      result.metrics.centerDifference <= 1,
      'The selected item and trigger centers must align.',
    );
    assert.equal(result.metrics.overflow, 'hidden');
  } else if (result.stage === 'field-invalid') {
    assert.equal(result.invalid, 'true');
    assert.equal(
      result.describedby.split(' ').length,
      2,
      'Description and error must both be connected.',
    );
  } else throw new Error('Unexpected probe stage: ' + result.stage);
  report.checks.push({ ...result, passed: true });
  console.log(result.stage + ': passed');
}
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto(origin);
  await page.evaluate(async (code) => {
    const module = await import(
      'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(code)))
    );
    module.mount();
  }, compiled);
  await page.addStyleTag({
    content:
      '#exit-popup[data-ending-style] {animation: probe-exit 180ms linear} @keyframes probe-exit {from {opacity:1} to{opacity:0}}',
  });
  await page.getByRole('combobox', { name: 'Multi fruit' }).fill('ban');
  await page.getByRole('option', { name: 'Banana', exact: true }).click();
  record({
    stage: 'multiple',
    form: await page.evaluate(() =>
      Array.from(new FormData(document.getElementById('multi-form')).entries()),
    ),
    errors,
  });
  await page.getByRole('combobox', { name: 'Multi fruit' }).press('Escape');
  await page.getByRole('button', { name: 'Remove Apple', exact: true }).click();
  record({
    stage: 'remove',
    form: await page.evaluate(() =>
      Array.from(new FormData(document.getElementById('multi-form')).entries()),
    ),
    errors,
  });
  await page.getByRole('combobox', { name: 'Object drink' }).fill('caf');
  record({
    stage: 'object-filter',
    options: await page.getByRole('option').allTextContents(),
    errors,
  });
  await page.getByRole('combobox', { name: 'Object drink' }).press('ArrowDown');
  await page.getByRole('combobox', { name: 'Object drink' }).press('Enter');
  record({
    stage: 'object-select',
    value: await page.getByRole('combobox', { name: 'Object drink' }).inputValue(),
    errors,
  });
  await page.getByRole('combobox', { name: 'Complete drink' }).fill('wa');
  await page.getByRole('combobox', { name: 'Complete drink' }).press('Enter');
  record({
    stage: 'autocomplete',
    value: await page.getByRole('combobox', { name: 'Complete drink' }).inputValue(),
    output: await page.locator('#complete-value').textContent(),
    errors,
  });
  await page.getByRole('combobox', { name: 'Both modes' }).fill('al');
  await page.getByRole('combobox', { name: 'Both modes' }).press('ArrowDown');
  record({
    stage: 'inline-both-filter',
    value: await page.getByRole('combobox', { name: 'Both modes' }).inputValue(),
    options: await page.getByRole('option').allTextContents(),
    errors,
  });
  await page.getByRole('option', { name: 'alpine', exact: true }).hover();
  record({
    stage: 'inline-hover',
    value: await page.getByRole('combobox', { name: 'Both modes' }).inputValue(),
    errors,
  });
  await page.getByRole('button', { name: 'External inline value', exact: true }).click();
  record({
    stage: 'inline-external',
    value: await page.getByRole('combobox', { name: 'Both modes' }).inputValue(),
    errors,
  });
  await page.getByRole('combobox', { name: 'Inline only' }).fill('z');
  await page.getByRole('combobox', { name: 'Inline only' }).press('ArrowDown');
  await page.getByRole('combobox', { name: 'Inline only' }).press('End');
  await page.getByRole('combobox', { name: 'Inline only' }).pressSequentially('b');
  record({
    stage: 'inline-static',
    value: await page.getByRole('combobox', { name: 'Inline only' }).inputValue(),
    options: await page.getByRole('option').allTextContents(),
    errors,
  });
  await page.getByRole('combobox', { name: 'Inline only' }).press('Escape');
  await page.getByRole('combobox', { name: 'Aligned' }).click();
  await page.waitForTimeout(100);
  record({
    stage: 'alignment-lock',
    metrics: await page.evaluate(() => {
      const a = document.querySelector('[aria-label="Aligned"]').getBoundingClientRect();
      const b = document
        .querySelector('#aligned-popup [aria-selected="true"]')
        .getBoundingClientRect();
      return {
        centerDifference: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
        overflow: document.body.style.overflow,
      };
    }),
    errors,
  });
  await page.getByRole('combobox', { name: 'Aligned' }).press('Escape');
  await page.waitForTimeout(80);
  await page.getByRole('combobox', { name: 'Manual exit' }).click();
  await page.getByRole('combobox', { name: 'Manual exit' }).press('Escape');
  await page.waitForTimeout(80);
  record({ stage: 'manual-retained', count: await page.locator('#manual-popup').count(), errors });
  await page.evaluate(() => globalThis.selectionActions.current.unmount());
  await page.waitForTimeout(20);
  record({
    stage: 'manual-unmounted',
    count: await page.locator('#manual-popup').count(),
    overflow: await page.evaluate(() => document.body.style.overflow),
    errors,
  });
  await page.getByRole('combobox', { name: 'Animated exit' }).click();
  await page.waitForTimeout(80);
  await page.getByRole('combobox', { name: 'Animated exit' }).press('Escape');
  await page.waitForTimeout(40);
  record({ stage: 'animation-retained', count: await page.locator('#exit-popup').count(), errors });
  await page.waitForTimeout(220);
  record({ stage: 'animation-complete', count: await page.locator('#exit-popup').count(), errors });
  await page.getByRole('combobox', { name: 'Required drink' }).focus();
  await page.getByRole('button', { name: 'Submit field' }).focus();
  await page.waitForTimeout(20);
  record({
    stage: 'field-invalid',
    invalid: await page
      .getByRole('combobox', { name: 'Required drink' })
      .getAttribute('aria-invalid'),
    describedby: await page
      .getByRole('combobox', { name: 'Required drink' })
      .getAttribute('aria-describedby'),
    errors,
  });
  await page.getByRole('combobox', { name: 'Required drink' }).click();
  await page.getByRole('option', { name: 'Tea', exact: true }).click();
  await page.waitForTimeout(40);
  record({
    stage: 'field-valid',
    invalid: await page
      .getByRole('combobox', { name: 'Required drink' })
      .getAttribute('aria-invalid'),
    form: await page.evaluate(() =>
      Array.from(new FormData(document.getElementById('field-form')).entries()),
    ),
    errors,
  });
} catch (error) {
  failure = error;
} finally {
  await browser.close();
  report.passed = !failure && report.checks.length === 16;
  report.failure = failure ? { message: failure.stack, browserErrors: errors } : null;
  const output = resolve(import.meta.dirname, '../artifacts/selection-verification.json');
  await mkdir(resolve(import.meta.dirname, '../artifacts'), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) {
    console.error(report.failure ?? 'Not all stages ran.');
    process.exitCode = 1;
  }
  console.log('Saved ' + output);
}
