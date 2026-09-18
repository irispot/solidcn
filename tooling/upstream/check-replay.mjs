import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generate as wrapper } from './generators/simple-wrapper.mjs';
import { generate as style } from './generators/style.mjs';
import {
  directory,
  workspace,
  applyExactOverride,
  pins,
  regenerate,
  safeInside,
} from './replay-lib.mjs';
import { checkRecords } from './replay.mjs';
import { checkGenerators } from './check-generators.mjs';

// Read-only tool checks. No original test files are loaded or changed.
const records = await checkRecords();
assert.equal(records.passed, true, JSON.stringify(records.results.filter((item) => !item.passed)));
const skeleton = await regenerate(
  'shadcn-ui/packages/solid/src/skeleton.tsx',
  pins()['shadcn-ui'].commit,
);
assert.equal(
  skeleton.code,
  readFileSync(resolve(workspace, 'shadcn-ui/packages/solid/src/skeleton.tsx'), 'utf8'),
);
const wrapperNames = ['separator', 'label', 'textarea', 'kbd', 'table', 'card'];
for (const name of wrapperNames) {
  const module = `shadcn-ui/packages/solid/src/${name}.tsx`;
  const replay = await regenerate(module, pins()['shadcn-ui'].commit);
  assert.equal(replay.code, readFileSync(resolve(workspace, module), 'utf8'), name);
}
const changedInputs = skeleton.inputs.map((input) => ({
  ...input,
  code: input.code.replace('cn-skeleton animate-pulse', 'cn-skeleton animate-pulse opacity-50'),
}));
const changed = await wrapper({ inputs: changedInputs });
assert.notEqual(changed, skeleton.code);
assert.match(changed, /animate-pulse opacity-50/);
await assert.rejects(
  () =>
    wrapper({
      inputs: [
        {
          path: 'conditional.tsx',
          code: 'import {cn} from "cn";function Wrapper({className,...props}:React.ComponentProps<"div">){return className ? <div/> : <span/>}export {Wrapper}',
        },
      ],
    }),
  /does not support ReturnStatement/,
);
await assert.rejects(
  () =>
    wrapper({
      inputs: skeleton.inputs.map((input) => ({
        ...input,
        code: input.code.replace('  return (', '  const cached = className;\n  return ('),
      })),
    }),
  /does not support FunctionDeclaration/,
);
const typedWrapper =
  'import * as React from "react"; import {cn} from "cn"; function First({className,...props}:React.ComponentProps<"div">){return <div className={cn(className)} {...props}/>} function Second({className,...props}:React.ComponentProps<"span">){return <span className={cn(className)} {...props}/>} export {First,Second}';
const scoped = await wrapper({ inputs: [{ path: 'scoped.tsx', code: typedWrapper }] });
assert.match(scoped, /function First\(__props0:/);
assert.match(scoped, /function Second\(__props1:/);
assert.match(scoped, /cn\(__props0\.className \?\? __props0\.class\)/);
assert.match(scoped, /cn\(__props1\.className \?\? __props1\.class\)/);
assert.doesNotMatch(scoped, /from ['"]react['"]/);
for (const code of [
  typedWrapper.replace('cn(className)', 'cn(React.version, className)'),
  typedWrapper.replace('cn(className)', 'cn(React["version"], className)'),
  typedWrapper.replace('cn(className)', 'cn(React, className)'),
  typedWrapper.replace('React.ComponentProps<"div">', 'React.HTMLAttributes<HTMLDivElement>'),
  typedWrapper.replace(
    'import * as React from "react"',
    'import { useState as state } from "react"',
  ),
  typedWrapper.replace('cn(className)', 'cn((() => className)())'),
]) {
  await assert.rejects(
    () => wrapper({ inputs: [{ path: 'unsupported.tsx', code }] }),
    /does not support/,
  );
}
const table = await regenerate(
  'shadcn-ui/packages/solid/src/table.tsx',
  pins()['shadcn-ui'].commit,
);
const changedTable = await wrapper({
  inputs: table.inputs.map((input) => ({
    ...input,
    code: input.code.replace('cn-table-container', 'cn-table-container isolate'),
  })),
});
assert.notEqual(changedTable, table.code);
assert.match(changedTable, /cn-table-container isolate/);
const css = '.example { color: red; }';
assert.notEqual(
  await style({ inputs: [{ path: 'style.css', code: css }] }),
  await style({ inputs: [{ path: 'style.css', code: css.replace('red', 'blue') }] }),
);
const override = JSON.parse(
  readFileSync(resolve(directory, 'overrides/separator-props.json'), 'utf8'),
);
const needle = override.replacements[0].find;
assert.equal(applyExactOverride(needle, override), override.replacements[0].replace);
assert.throws(() => applyExactOverride('missing context', override), /found 0/);
assert.throws(() => applyExactOverride(`${needle} ${needle}`, override), /found 2/);
assert.throws(() => safeInside('/tmp/solid-cn-upstream-example', '../live.tsx'), /outside/);
assert.throws(() => safeInside('/tmp/solid-cn-upstream-example', '/tmp/live.tsx'), /outside/);
const candidateChecks = await checkGenerators();
console.log(
  JSON.stringify(
    {
      passed: true,
      nativeRecords: records.nativeModules,
      exactReplays: records.exactReplays,
      pendingModules: records.pendingModules,
      acceptedBehaviorModules: records.acceptedBehaviorModules,
      changedSourceChangesOutput: true,
      unsupportedWrapperRejected: true,
      checkedStatelessWrappers: ['skeleton', ...wrapperNames],
      multipleFunctionPropScopesVerified: true,
      reactRuntimeAndUnsupportedTypesRejected: true,
      overrideContextMismatchRejected: true,
      scratchPathEscapeRejected: true,
      candidateChecks,
      originalTestsReadOrChanged: false,
    },
    null,
    2,
  ),
);
