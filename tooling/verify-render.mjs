import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { transformAsync } from '@babel/core';
import solid from '@solidjs/babel-plugin';

const origin = process.env.SOLID_CN_URL ?? 'http://127.0.0.1:5173';
const raw = await (await fetch(`${origin}/base-ui/packages/solid/src/core.tsx`)).text();
const imports = {
  'solid-js': origin + raw.match(/from "([^"]*\/deps\/solid-js[^"]+)"/)[1],
  '@solidjs/web': origin + raw.match(/from "([^"]*\/deps\/@solidjs_web[^"]+)"/)[1],
};
const fixture = `import {createSignal} from 'solid-js';
import {render} from '@solidjs/web';
import {useRender, renderElement} from '${origin}/base-ui/packages/solid/src/core.tsx';
export function mount() {
  const host = document.createElement('section'); document.body.appendChild(host);
  return render(() => {
    const [active, setActive] = createSignal(false);
    const [count, setCount] = createSignal(0);
    const [enabled, setEnabled] = createSignal(true);
    const one = {current: null}; const two = {current: null};
    globalThis.renderProbe = {one, two};
    const mapped = useRender({ defaultTagName: 'button', ref: [one, two],
      state: {get isActive() {return active()}, get itemCount() {return count()}, zero: 0, no: false},
      stateAttributesMapping: {isActive: value => value ? {'data-is-active':'yes'} : null, itemCount: value => ({'data-item-count': String(value)})},
      props: {id:'mapped', children:'Map state', onClick: () => {setActive(!active()); setCount(count()+1)}, 'data-item-count':'override', className: state => state.isActive ? 'active' : 'idle'}
    });
    const custom = useRender({state:{get active(){return active()}}, props:{children:'Custom', className:'base'}, render: props => <span id="custom-render" {...props} class={props.className+' extra'}/>});
    const conditional = useRender({get enabled(){return enabled()}, props:{id:'conditional', children:'Enabled'}});
    const privateState = renderElement('button', {id:'private-state', disabled:true}, {disabled:true, describedby:'must-not-leak'}, {'aria-disabled':undefined, 'aria-describedby':undefined});
    return <>{mapped}{custom}{conditional}{privateState}<button id="toggle-render" onClick={()=>setEnabled(!enabled())}>Toggle</button></>;
  }, host);
}`;
let compiled = (
  await transformAsync(fixture, {
    filename: 'render-probe.jsx',
    configFile: false,
    babelrc: false,
    plugins: [[solid, { generate: 'dom' }]],
  })
).code;
for (const [name, url] of Object.entries(imports))
  compiled = compiled
    .replaceAll(JSON.stringify(name), JSON.stringify(url))
    .replaceAll(`'${name}'`, JSON.stringify(url));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('**/@vite/client', (route) =>
  route.fulfill({
    contentType: 'application/javascript',
    body: `
export function updateStyle(id, text) {let node=document.getElementById(id);if(!node){node=document.createElement('style');node.id=id;document.head.appendChild(node)}node.textContent=text}
export function removeStyle(id) {document.getElementById(id)?.remove()}
export function createHotContext() {return {data:{},accept(){},acceptExports(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){}}}
export function injectQuery(url){return url}
`,
  }),
);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const checks = [];
try {
  await page.goto(origin);
  await page.evaluate(async (code) => {
    const fixture = await import(
      'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(code)))
    );
    fixture.mount();
  }, compiled);
  const mapped = page.locator('#mapped');
  assert.equal(await mapped.getAttribute('data-is-active'), null);
  assert.equal(await mapped.getAttribute('data-zero'), null);
  assert.equal(await mapped.getAttribute('data-no'), null);
  assert.equal(await mapped.getAttribute('data-isactive'), null);
  assert.equal(await mapped.getAttribute('data-item-count'), 'override');
  assert.equal(await mapped.getAttribute('class'), 'idle');
  checks.push('exact default state rules and custom mapping suppression');
  assert.equal(await page.locator('#private-state').getAttribute('data-disabled'), '');
  assert.equal(await page.locator('#private-state').getAttribute('aria-disabled'), null);
  assert.equal(await page.locator('#private-state').getAttribute('aria-describedby'), null);
  checks.push('private state mapping does not supply absent ARIA attributes');
  assert.equal(
    await page.evaluate(
      () =>
        globalThis.renderProbe.one.current === document.getElementById('mapped') &&
        globalThis.renderProbe.two.current === document.getElementById('mapped'),
    ),
    true,
  );
  checks.push('merged object refs');
  await mapped.click();
  assert.equal(await mapped.getAttribute('data-is-active'), 'yes');
  assert.equal(await mapped.getAttribute('class'), 'active');
  assert.equal(
    await page.evaluate(() => globalThis.renderProbe.one.current === document.activeElement),
    true,
  );
  assert.equal(await page.locator('#custom-render').getAttribute('class'), 'base extra');
  assert.equal(await page.locator('#custom-render').getAttribute('data-active'), '');
  checks.push('reactive mappings keep the DOM node and focus');
  await mapped.click();
  assert.equal(await mapped.getAttribute('data-is-active'), null);
  assert.equal(await page.locator('#custom-render').getAttribute('data-active'), null);
  checks.push('removed mapping keys remove attributes');
  await page.locator('#toggle-render').click();
  assert.equal(await page.locator('#conditional').count(), 0);
  await page.locator('#toggle-render').click();
  assert.equal(await page.locator('#conditional').count(), 1);
  checks.push('enabled state removes and restores output');
  assert.deepEqual(errors, []);
  await mkdir(resolve('artifacts'), { recursive: true });
  await writeFile(
    resolve('artifacts/render-checks.json'),
    JSON.stringify({ passed: true, checks, errors, originalComponentTests: false }, null, 2),
  );
  console.log(`useRender browser checks passed: ${checks.length}`);
} finally {
  await browser.close();
}
