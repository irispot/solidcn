import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const testFile = 'base-ui/packages/react/src/radio-group/RadioGroup.test.tsx';
const artifact = resolve(root, 'artifacts/unchanged-radio-group-comparison.json');
const routes = {
  reactClient: 'reference-radio-group-client.config.ts',
  solidClient: 'dual-radio-group-client-solid.config.ts',
  reactBrowser: 'reference-radio-group-browser.config.ts',
  solidBrowser: 'dual-radio-group-browser-solid.config.ts',
};
const temp = mkdtempSync(resolve(tmpdir(), 'solid-cn-radio-group-'));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function preserve(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(name, config) {
  const browser = name.endsWith('Browser');
  const vitest = browser
    ? resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules/vitest/vitest.mjs')
    : resolve(root, 'node_modules/.bin/vitest');
  const outputFile = resolve(temp, `${name}.json`);
  const args = ['run', '--config', `tooling/parity/${config}`,
    '--reporter=default', '--reporter=json', `--outputFile=${outputFile}`];
  const result = spawnSync(browser ? process.execPath : vitest,
    browser ? [vitest, ...args] : args,
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, TZ: 'UTC' } });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(outputFile, 'utf8')); }
  catch {
    errors.push(`${name} produced no report (exit ${result.status}): ${output.slice(-800)}`);
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0,
      numFailedTests: 0, numPendingTests: 0 };
  }
  return {
    exitCode: result.status,
    counts: { total: report.numTotalTests, passed: report.numPassedTests,
      failed: report.numFailedTests, skipped: report.numPendingTests },
    assertions: (report.testResults ?? []).flatMap((suite) =>
      (suite.assertionResults ?? []).map((item) => ({
        file: relative(root, suite.name), fullName: item.fullName, status: item.status,
        error: item.status === 'failed' ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
      }))),
    sourceModules: [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1]).file),
    nativeExecutions: Object.fromEntries(
      [...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
        .flatMap((match) => Object.entries(JSON.parse(match[1])))),
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
  };
}

function byName(route) {
  return new Map(route.assertions.map((item) => [item.fullName, item]));
}

try {
  const before = parityInputHashes();
  preserve('Before');
  const results = Object.fromEntries(Object.entries(routes).map(([name, config]) =>
    [name, run(name, config)]));
  const after = parityInputHashes();
  preserve('After');
  const changedFiles = [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])]
    .filter((path) => before.files[path] !== after.files[path]);
  const routeInputs = new Set([
    'package.json', 'package-lock.json',
    'base-ui/packages/react/package.json', 'base-ui/packages/solid/package.json',
    testFile, 'tooling/parity/run-radio-group.mjs', 'tooling/parity/input-hashes.mjs',
    ...Object.values(routes).map((name) => `tooling/parity/${name}`),
    ...Object.values(results).flatMap((result) => result.sourceModules),
  ]);
  const changedRouteInputs = changedFiles.filter((path) => routeInputs.has(path));
  if (changedRouteInputs.length)
    errors.push(`RadioGroup route input changed: ${changedRouteInputs.join(', ')}`);
  const expectedCounts = {
    reactClient: [80, 13], solidClient: [80, 13],
    reactBrowser: [93, 0], solidBrowser: [93, 0],
  };
  for (const [name, result] of Object.entries(results)) {
    const [passed, skipped] = expectedCounts[name];
    if (result.assertions.length !== 93 ||
        result.assertions.some((item) => item.file !== testFile))
      errors.push(`${name} did not load all 93 unchanged RadioGroup assertions.`);
    if (result.exitCode !== 0 || result.counts.passed !== passed ||
        result.counts.skipped !== skipped || result.counts.failed ||
        result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${name} failed or has an unexpected count or unhandled error.`);
  }
  const mismatches = [];
  for (const [referenceName, nativeName] of [
    ['reactClient', 'solidClient'], ['reactBrowser', 'solidBrowser'],
  ]) {
    const native = byName(results[nativeName]);
    for (const [key, reference] of byName(results[referenceName])) {
      const actual = native.get(key);
      if (actual?.status !== reference.status)
        mismatches.push({ environment: referenceName, key,
          react: reference.status, solid: actual?.status ?? 'missing', error: actual?.error });
    }
  }
  if (mismatches.length) errors.push(`${mismatches.length} assertion statuses differ.`);
  if (!results.reactClient.sourceModules.includes('base-ui/packages/react/src/radio-group/RadioGroup.tsx'))
    errors.push('React did not load the pinned RadioGroup implementation.');
  for (const name of ['solidClient', 'solidBrowser']) {
    const result = results[name];
    const unexpected = unexpectedOriginalReactModules(result.sourceModules);
    if (unexpected.length)
      errors.push(`${name} loaded original React implementation: ${unexpected.join(', ')}`);
    if (!result.sourceModules.includes('base-ui/packages/solid/src/controls.tsx') ||
        !result.nativeExecutions['base-ui/packages/solid/src/controls.tsx#RadioGroup'] ||
        !result.nativeExecutions['base-ui/packages/solid/src/controls.tsx#Radio.Root'])
      errors.push(`${name} lacks native Solid RadioGroup and Radio.Root execution.`);
  }
  const evidence = { success: errors.length === 0, originalTestFile: testFile,
    results, mismatches, inputsBefore: before.digest, inputsAfter: after.digest,
    changedFiles, changedRouteInputs, errors };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success,
    counts: Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.counts])),
    mismatches: mismatches.length, routeHashStable: !changedRouteInputs.length,
    workspaceHashStable: before.digest === after.digest, errors,
    artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
