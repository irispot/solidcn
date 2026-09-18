import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { transformAsync } from '@babel/core';
import solid from '@solidjs/babel-plugin';
import typescript from '@babel/preset-typescript';
import ts from 'typescript';
import { getExampleCatalog } from '../example-catalog.mjs';
import { transformExample, RHEA_NOVA_IMPORT_ROUTES } from './transform.mjs';
import { readIconDefinitions, generateIconModule } from './icons.mjs';
import { checkHookAdapters } from './hooks-check.mjs';
import { adaptAsyncComponents } from './async-source.mjs';
import { fixExampleInputs, exampleInputFixes } from './example-input-fixes.mjs';

// Compiler diagnostics for the read-only adapter. Original test files are not used.
const entries = await getExampleCatalog({ pages: '*' });
const results = [];
const checks = [];
const unsupported = [];
const workspace = resolve(import.meta.dirname, '../../..');
const hash = (code) => createHash('sha256').update(code).digest('hex');
const runtimeExports = (code, filename) => {
  const source = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const exports = new Set();
  for (const node of source.statements) {
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause) {
      if (ts.isNamedExports(node.exportClause))
        for (const item of node.exportClause.elements)
          if (!item.isTypeOnly) exports.add(item.name.text);
    } else if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node)
      ) {
        if (node.name) exports.add(node.name.text);
      } else if (ts.isVariableStatement(node)) {
        for (const item of node.declarationList.declarations)
          if (ts.isIdentifier(item.name)) exports.add(item.name.text);
      }
    }
  }
  return exports;
};
const presetProofs = [];
for (const [component, names] of Object.entries(RHEA_NOVA_IMPORT_ROUTES)) {
  const originalPath = `shadcn-ui/apps/v4/registry/bases/base/ui/${component}.tsx`;
  const nativePath = `shadcn-ui/packages/solid/src/${component}.tsx`;
  const original = await readFile(resolve(workspace, originalPath), 'utf8');
  const native = await readFile(resolve(workspace, nativePath), 'utf8');
  for (const name of names.split(' ')) {
    assert.ok(
      runtimeExports(original, originalPath).has(name),
      `Missing original export: ${component}.${name}`,
    );
    assert.ok(
      runtimeExports(native, nativePath).has(name),
      `Missing native export: ${component}.${name}`,
    );
  }
  presetProofs.push({
    component,
    exports: names.split(' '),
    original: { source: originalPath, sha256: hash(original) },
    native: { source: nativePath, sha256: hash(native) },
  });
}
const styles = {};
for (const preset of ['nova', 'rhea']) {
  const path = `shadcn-ui/apps/v4/registry/styles/style-${preset}.css`;
  const code = await readFile(resolve(workspace, path), 'utf8');
  styles[preset] = {
    source: path,
    sha256: hash(code),
    buttonRule: code.match(/\.cn-button\s*\{([^}]+)\}/)?.[1].trim(),
  };
  assert.ok(styles[preset].buttonRule);
}
// A shared component source is not evidence that two generated presets match.
assert.notEqual(styles.nova.buttonRule, styles.rhea.buttonRule);
assert.match(styles.nova.buttonRule, /rounded-lg/);
assert.match(styles.rhea.buttonRule, /rounded-2xl/);
const compile = (code, filename) =>
  transformAsync(code, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: [[solid, { generate: 'dom' }]],
    presets: [[typescript, { allExtensions: true, isTSX: true, onlyRemoveTypeImports: true }]],
  });
for (const entry of entries) {
  if (entry.discoveryError) {
    unsupported.push({ name: entry.name, error: entry.discoveryError });
    continue;
  }
  const source = await readFile(entry.source, 'utf8');
  let result;
  try {
    result = transformExample(source, entry.source);
  } catch (error) {
    unsupported.push({ name: entry.name, error: error.message });
    assert.equal(await readFile(entry.source, 'utf8'), source);
    continue;
  }
  assert.ok((await compile(result.code, entry.source)).code);
  assert.equal(await readFile(entry.source, 'utf8'), source);
  results.push(result);
  checks.push({
    name: entry.name,
    sha256: createHash('sha256').update(source).digest('hex'),
    hooks: result.metadata.hooks,
    renderProps: result.metadata.renderProps,
    translationAdapter: result.metadata.translationAdapter,
    presetRoutes: result.metadata.presetRoutes,
  });
}
const required = [
  'button-group-demo',
  'button-group-dropdown',
  'button-group-input',
  'button-group-input-group',
  'button-group-nested',
  'button-group-orientation',
  'button-group-popover',
  'button-group-rtl',
  'button-group-select',
  'button-group-size',
  'button-group-split',
  'button-group-separator',
].map((name) => `docs/${name}`);
required.push('local/pasted-button-group');
required.push(
  ...[
    'carousel-api',
    'command-dialog',
    'progress-demo',
    'questionnaire-card',
    'questionnaire-conditional',
    'checkbox-table',
    'date-picker-input',
    'questionnaire-progress',
    'questionnaire-navigation-state',
  ].map((name) => `docs/${name}`),
);
required.push(
  ...['attachment-demo', 'bubble-demo', 'marker-demo', 'message-demo'].map(
    (name) => `docs/${name}`,
  ),
);
for (const name of required)
  assert.ok(
    checks.some((entry) => entry.name === name),
    `Required conversion regressed: ${name}`,
  );
const dependencies = resolve(import.meta.dirname, '../apps/reference/node_modules');
const icons = [];
for (const kind of ['lucide', 'tabler']) {
  const definitions = await readIconDefinitions(
    kind,
    results.flatMap((result) => result.metadata.icons[kind]),
    dependencies,
  );
  assert.ok(
    (await compile(generateIconModule(kind, definitions), `${kind}-native-icons.tsx`)).code,
  );
  icons.push({
    kind,
    count: definitions.length,
    package: definitions[0]?.package,
    version: definitions[0]?.version,
  });
}
const named = transformExample(
  'import React,{useState as state} from "react";export default function App(){const [value,setValue]=state(1);return <button onClick={()=>setValue(value+1)}>{[1].map(value=><span>{value}</span>)}{value}</button>}',
  'binding-scope.tsx',
).code;
assert.match(named, /setValue\(value\(\) \+ 1\)/);
assert.match(named, /map\(value => <span>\{value\}<\/span>\)/);
const nested = transformExample(
  'import {useState} from "react";export default function App(){const [count,setCount]=useState(1);const read=()=>count*2;function increment(){setCount(count+1)}return <button onClick={increment}>{count*2}{read()}</button>}',
  'reactive-reads.tsx',
).code;
assert.match(nested, /read = \(\) => count\(\) \* 2/);
assert.match(nested, /setCount\(count\(\) \+ 1\)/);
assert.match(nested, /\{count\(\) \* 2\}/);
for (const code of [
  'import React from "react";export default function X(){return <React.Fragment key="x"><span>Text</span></React.Fragment>}',
  'import {Fragment as Group} from "react";export default function X(){return <Group><span>Text</span></Group>}',
  'import {Fragment} from "react";export default function X(){return <Fragment/>}',
]) {
  const result = transformExample(code, 'fragments.tsx');
  assert.equal(result.metadata.fragments, 1);
  assert.doesNotMatch(result.code, /React\.Fragment|<Group|<Fragment/);
  assert.ok((await compile(result.code, 'fragments.tsx')).code);
}
const typeOnly = transformExample(
  'import type {ImpossibleType} from "uninstalled-type-only-module";import React,{type ReactNode,useState} from "react";import {type DateRange} from "react-day-picker";export default function X(props:React.ComponentProps<"button">){const [value,setValue]=useState<DateRange>();return <button {...props}>{value ? "Yes" : "No"}</button>}',
  'type-imports.tsx',
);
const erased = (await compile(typeOnly.code, 'type-imports.tsx')).code;
assert.doesNotMatch(
  erased,
  /uninstalled-type-only-module|react-day-picker|React\.ComponentProps|ReactNode/,
);
assert.doesNotMatch(erased, /from\s+["']react["']/);
assert.equal(typeOnly.metadata.erasedTypeImports.length, 3);
const pureDates = transformExample(
  'import {format} from "date-fns";import {arSA} from "react-day-picker/locale";export default function X(){return <p>{format(new Date(2026,0,1),"PPP",{locale:arSA})}</p>}',
  'date-imports.tsx',
);
assert.match(pureDates.code, /from "date-fns\/locale"/);
assert.ok((await compile(pureDates.code, 'date-imports.tsx')).code);
const nativeToast = transformExample(
  'import {toast as notify} from "sonner";export default function X(){return <button onClick={()=>notify.success("Done",{description:"Saved"})}>Save</button>}',
  'native-toast.tsx',
);
assert.match(nativeToast.code, /from "@solid-cn\/ui\/sonner"/);
assert.ok((await compile(nativeToast.code, 'native-toast.tsx')).code);
const rhea = transformExample(
  'import {Button as Action} from "@/styles/base-rhea/ui/button";export default function X(){return <Action className="rounded-none px-7">Keep example styles</Action>}',
  'rhea-nova-route.tsx',
);
assert.match(rhea.code, /Button as Action/);
assert.match(rhea.code, /from "@solid-cn\/ui\/button"/);
assert.match(rhea.code, /class="rounded-none px-7"/);
assert.deepEqual(rhea.metadata.presetRoutes, [
  {
    source: '@/styles/base-rhea/ui/button',
    target: '@solid-cn/ui/button',
    sourcePreset: 'base-rhea',
    targetPreset: 'base-nova',
    presetEquivalent: false,
    comparison: 'canonical-base-components-with-nova-styles',
  },
]);
assert.ok((await compile(rhea.code, 'rhea-nova-route.tsx')).code);
for (const code of [
  'import {Missing} from "@/styles/base-rhea/ui/button";export default function X(){return <Missing/>}',
  'import Button from "@/styles/base-rhea/ui/button";export default function X(){return <Button/>}',
  'import * as Buttons from "@/styles/base-rhea/ui/button";export default function X(){return <Buttons.Button/>}',
  'import {Button} from "@/styles/base-rhea/ui/missing-component";export default function X(){return <Button/>}',
  'import {Button} from "@/styles/base-rhea/ui-rtl/button";export default function X(){return <Button/>}',
  'import {Button} from "@/styles/base-sera/ui/button";export default function X(){return <Button/>}',
])
  assert.throws(() => transformExample(code, 'unchecked-preset-route.tsx'));
for (const [name, body] of Object.entries({
  derivedLocal: 'const doubled=count*2;return <button>{doubled}</button>',
  stateObject: 'const buttonProps={disabled:count>0};return <button {...buttonProps}/>',
  shorthandObject: 'const buttonProps={count};return <button {...buttonProps}/>',
})) {
  const result = transformExample(
    `import {useState} from "react";export default function App(){const [count,setCount]=useState(0);${body}}`,
    `${name}.tsx`,
  );
  assert.equal(result.metadata.derivedBindings.length, 1);
  assert.ok((await compile(result.code, `${name}.tsx`)).code);
}
for (const [name, body] of Object.entries({
  conditionalReturn:
    'if(count) return <p>Open</p>;return <button onClick={()=>setCount(1)}>Open</button>',
  returnExpression: 'return count ? <p>Open</p> : <button onClick={()=>setCount(1)}>Open</button>',
  conditionalDerivedReturn: 'if(!count)return null;const doubled=count*2;return <p>{doubled}</p>',
})) {
  const result = transformExample(
    `import {useState} from "react";export default function App(){const [count,setCount]=useState(0);${body}}`,
    `${name}.tsx`,
  );
  assert.ok((await compile(result.code, `${name}.tsx`)).code);
}
for (const code of [
  'import {useEffect} from "react"; export default function X(){useEffect(()=>{});return <div/>}',
  'import React from "react";export default function X(){React.useMemo(()=>1,[]);return <div/>}',
  'import {Button} from "some-unmapped-package";export default function X(){return <Button/>}',
  'import React from "react";const copy={...React};export default function X(){return <div/>}',
  'import {useState} from "react";const copy=useState;export default function X(){return <div/>}',
  'import type {Component} from "react";export default function X(){return <Component/>}',
  'import React from "react";export default function X(){return <React.Fragment ref={()=>{}}/>}',
  'import {Fragment} from "react";const copy=Fragment;export default function X(){return <div/>}',
  'import {toast} from "sonner";export default function X(){return <button onClick={()=>toast.promise(Promise.resolve())}/>}',
  'import {toast} from "sonner";export default function X(){return <button onClick={()=>toast("Done",{position:"top-left"})}/>}',
  'import {useMemo} from "react";export default function X(){const memo=useMemo(async()=>1,[]);return <div>{memo}</div>}',
  'import {useEffect} from "react";export default function X(){useEffect(()=>{},externalDependencies);return <div/>}',
  'import {useEffect} from "react";export default function X(){if(true){useEffect(()=>{},[])}return <div/>}',
  'import {useEffect} from "react";export default function X(){if(true)useEffect(()=>{},[]);return <div/>}',
  'import {useMemo,useState} from "react";export default function X(){const memo=useMemo(()=>{const [value]=useState(0);return value},[]);return <div>{memo}</div>}',
  'import {useState} from "react";export default function X(){const [value,setValue]=useState(0);if(value)return null;performSideEffect();return <div/>}',
  'import {LineChart} from "recharts";export default function X(){return <LineChart/>}',
])
  assert.throws(() => transformExample(code, 'unsupported.tsx'));
const stableTable = transformExample('import{useState}from"react";import{useTable}from"@tanstack/react-table";import{Input}from"@/styles/base-nova/ui/input";export default function App(){const[sorting,setSorting]=useState([]);const table=useTable({state:{sorting},onSortingChange:setSorting});return <Input onChange={()=>{}} value={table.state.sorting.length}/>}', 'stable-table.tsx').code;
assert.match(stableTable, /const table = useTable/);
assert.match(stableTable, /get sorting\(\)/);
assert.match(stableTable, /onInput=/);
assert.doesNotMatch(stableTable, /createDocDerived\(\(\) => useTable/);
const otpChange = transformExample('import{InputOTP}from"@/styles/base-nova/ui/input-otp";export default function App(){return <InputOTP onChange={()=>{}}/>}', 'otp-event.tsx').code;
assert.match(otpChange, /onChange=/);
const customSvgProps = transformExample('function Custom(props){return <svg><g clipPath={props.clipPath}/></svg>} export default function App(){return <Custom clipPath="url(#custom)"/>}', 'custom-svg-props.tsx').code;
assert.match(customSvgProps, /<Custom clipPath=/);
assert.match(customSvgProps, /<g clip-path=/);
const asyncSource = 'async function Data(){const data=await read();return <p>{data.label}</p>}';
for (const framework of ['react', 'solid']) {
  const result = adaptAsyncComponents(asyncSource, 'async-data.tsx', framework);
  assert.deepEqual(result.components, ['Data']);
  assert.match(result.code, /read\(\)/);
  assert.match(result.code, framework === 'react' ? /\?\?= read\(\)/ : /\(\) => read\(\)/);
  for (const unsupported of [
    'async function Data(props){const data=await read(props);return <p/>}',
    'async function Data(){const data=await read();sideEffect();return <p/>}',
    'async function Data(){const data=await value;return <p/>}',
  ]) assert.throws(() => adaptAsyncComponents(unsupported, 'unsupported-async.tsx', framework));
}
const hookAdapters = await checkHookAdapters();
for (const name of Object.keys(exampleInputFixes)) {
  const filename = resolve(workspace, 'shadcn-ui/apps/v4/examples/base', name);
  const original = await readFile(filename, 'utf8');
  const corrected = fixExampleInputs(original, filename);
  assert.equal(corrected.fixes.length, 1);
  assert.equal(transformExample(original, filename).metadata.inputFixes[0].correctedSha256, corrected.fixes[0].correctedSha256);
  assert.throws(() => fixExampleInputs(corrected.code, filename), /needs review/);
  assert.equal(await readFile(filename, 'utf8'), original);
}
console.log(
  JSON.stringify(
    {
      passed: true,
      examples: checks,
      total: entries.length,
      compiled: checks.length,
      unsupported,
      icons,
      bindingScope: 'passed',
      liveDerivedConstBindings: 'passed',
      unsupportedImperativeSetupReads: 'rejected',
      hookAdapters,
      jsxAndNestedFunctionStateReads: 'passed',
      fragmentsAndErasedTypes: 'passed',
      pureDateHelpersAndNativeToast: 'passed',
      rheaImportRoutes: {
        sourcePreset: 'base-rhea',
        targetPreset: 'base-nova',
        presetEquivalent: false,
        comparison: 'canonical-base-components-with-nova-styles',
        routedExamples: checks.filter((entry) => entry.presetRoutes.length).length,
        unsupportedExports: 'rejected',
        styles,
        modules: presetProofs,
      },
      unsupportedHooksImportsAndReactValues: 'rejected',
      originalFiles: 'read only',
      runtimeReactInNativeExamples: false,
    },
    null,
    2,
  ),
);
