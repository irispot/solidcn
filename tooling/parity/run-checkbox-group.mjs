import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(resolve(tmpdir(), 'solid-cn-checkbox-group-'));
const artifact = resolve(root, 'artifacts/unchanged-checkbox-group-comparison.json');
const testFiles = [
  'base-ui/packages/react/src/checkbox-group/CheckboxGroup.test.tsx',
  'base-ui/packages/react/src/checkbox-group/useCheckboxGroupParent.test.tsx',
];
const routes = {
  reactClient: 'reference-checkbox-group-client.config.ts',
  solidClient: 'dual-checkbox-group-client-solid.config.ts',
  solidSsr: 'dual-checkbox-group-hydration-solid.config.ts',
  reactBrowser: 'reference-checkbox-group-browser.config.ts',
  solidBrowser: 'dual-checkbox-group-browser-solid.config.ts',
};
const errors = [];
const before = parityInputHashes();
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
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
    errors.push(`${name} produced no JSON report (exit ${result.status}): ${output.slice(-800)}`);
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0,
      numFailedTests: 0, numPendingTests: 0 };
  }
  const assertions = (report.testResults ?? []).flatMap((suite) =>
    (suite.assertionResults ?? []).map((item) => ({
      file: relative(root, suite.name),
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
    })));
  const sourceModules = [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]).file);
  const nativeExecutions = Object.fromEntries(
    [...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
      .flatMap((match) => Object.entries(JSON.parse(match[1]))),
  );
  return {
    exitCode: result.status,
    counts: { total: report.numTotalTests, passed: report.numPassedTests,
      failed: report.numFailedTests, skipped: report.numPendingTests },
    assertions, sourceModules, nativeExecutions,
    ssrEvidence: [...output.matchAll(/Native Solid CheckboxGroup SSR evidence: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1])),
    hydrationEvidenceCount: output.match(/Native Solid hydration evidence:/g)?.length ?? 0,
    identityEvidence: [...output.matchAll(/Native Solid Checkbox node identity: (\d+)/g)]
      .map((match) => Number(match[1])),
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
  };
}

function byName(route) {
  return new Map(route.assertions.map((item) => [`${item.file}:${item.fullName}`, item]));
}

try {
  guard('Before');
  const results = Object.fromEntries(Object.entries(routes).map(([name, config]) =>
    [name, run(name, config)]));
  const after = parityInputHashes();
  guard('After');
  const changedFiles = [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])]
    .filter((path) => before.files[path] !== after.files[path]);
  const routeInputs = new Set([
    'package.json', 'package-lock.json',
    'base-ui/packages/react/package.json', 'base-ui/packages/solid/package.json',
    'tooling/parity/run-checkbox-group.mjs',
    'tooling/parity/input-hashes.mjs',
    'tooling/parity/source-audit.ts',
    'tooling/parity/checkbox-group-hydration-ssr-service.ts',
    'tooling/parity/checkbox-group-hydration-setup.ts',
    ...Object.values(routes).map((name) => `tooling/parity/${name}`),
    ...Object.values(results).flatMap((route) => route.sourceModules),
  ]);
  const changedRouteInputs = changedFiles.filter((path) => routeInputs.has(path));
  if (changedRouteInputs.length)
    errors.push(`CheckboxGroup route input changed during the run: ${changedRouteInputs.join(', ')}`);
  for (const [name, route] of Object.entries(results)) {
    const expectedFiles = name === 'solidSsr' ? testFiles.slice(0, 1) : testFiles;
    const actualFiles = [...new Set(route.assertions.map((item) => item.file))].sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles.slice().sort()))
      errors.push(`${name} did not report the expected unchanged test files.`);
    if (route.assertions.length !== (name === 'solidSsr' ? 93 : 114))
      errors.push(`${name} did not load the complete original assertion inventory.`);
    if (route.exitCode !== 0 || route.counts.failed || route.unhandledErrors.length || route.outputHasUnhandledErrors)
      errors.push(`${name} failed or had an unhandled error.`);
  }
  const counts = {
    reactClient: [89, 25], solidClient: [80, 34], solidSsr: [9, 84],
    reactBrowser: [114, 0], solidBrowser: [105, 9],
  };
  for (const [name, [passed, skipped]] of Object.entries(counts))
    if (results[name].counts.passed !== passed || results[name].counts.skipped !== skipped)
      errors.push(`${name} has an unexpected pass or skip count.`);
  const ssrNames = new Set(results.solidSsr.assertions
    .filter((item) => item.status === 'passed')
    .map((item) => `${item.file}:${item.fullName}`));
  if (ssrNames.size !== 9) errors.push('The Solid server route did not select exactly nine cases.');
  for (const name of ['solidClient', 'solidBrowser']) {
    const route = byName(results[name]);
    for (const key of ssrNames)
      if (route.get(key)?.status !== 'skipped')
        errors.push(`${name} did not route the server case: ${key}`);
  }
  const mismatches = [];
  for (const [referenceName, clientName] of [
    ['reactClient', 'solidClient'], ['reactBrowser', 'solidBrowser'],
  ]) {
    const reference = byName(results[referenceName]);
    const client = byName(results[clientName]);
    const server = byName(results.solidSsr);
    for (const [key, item] of reference) {
      const native = ssrNames.has(key) ? server.get(key) : client.get(key);
      if (native?.status !== item.status)
        mismatches.push({ environment: referenceName, key,
          react: item.status, solid: native?.status ?? 'missing', error: native?.error });
    }
  }
  if (mismatches.length) errors.push(`${mismatches.length} assertion statuses differ.`);
  if (!results.reactClient.sourceModules.includes('base-ui/packages/react/src/checkbox-group/CheckboxGroup.tsx'))
    errors.push('React did not load the pinned CheckboxGroup implementation.');
  for (const name of ['solidClient', 'solidSsr', 'solidBrowser']) {
    const unexpected = unexpectedOriginalReactModules(results[name].sourceModules);
    if (unexpected.length)
      errors.push(`${name} loaded original React implementation modules: ${unexpected.join(', ')}`);
    if (!results[name].sourceModules.includes('base-ui/packages/solid/src/controls.tsx'))
      errors.push(`${name} did not load native Solid controls.`);
  }
  for (const name of ['solidClient', 'solidBrowser'])
    if (!results[name].nativeExecutions['base-ui/packages/solid/src/controls.tsx#CheckboxGroup'])
      errors.push(`${name} did not execute native CheckboxGroup.`);
  if (results.solidSsr.ssrEvidence.length !== 9 ||
      results.solidSsr.ssrEvidence.some((item) => item.hydrationKeys < 1) ||
      results.solidSsr.hydrationEvidenceCount !== 3 ||
      results.solidSsr.identityEvidence.length !== 3 ||
      results.solidSsr.identityEvidence.some((count) => count < 1))
    errors.push('Solid server route lacks native SSR, hydration, or node-retention evidence.');
  const evidence = {
    success: errors.length === 0,
    originalTestFiles: testFiles,
    note: 'Nine SSR cases run in the separate native Solid server and hydration route.',
    results, mismatches, inputsBefore: before.digest, inputsAfter: after.digest,
    changedFiles, changedRouteInputs, errors,
  };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success,
    counts: Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.counts])),
    mismatches: mismatches.length, routeHashStable: changedRouteInputs.length === 0,
    workspaceHashStable: before.digest === after.digest,
    errors, artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
