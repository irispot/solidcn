import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const browser = process.argv.includes('--browser');
const file = 'base-ui/packages/react/src/toolbar/root/ToolbarRoot.test.tsx';
const artifact = resolve(root, `artifacts/unchanged-toolbar-${browser ? 'browser' : 'client'}-diagnostic.json`);
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-toolbar-client-'));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode) {
  const outputFile = resolve(temporary, `${mode}.json`);
  const config = `tooling/parity/${mode === 'react' ? 'reference-toolbar' : 'dual-toolbar'}-${browser ? 'browser' : 'client'}${mode === 'solid' ? '-solid' : ''}.config.ts`;
  const executable = browser ? process.execPath : resolve(root, 'node_modules/.bin/vitest');
  const result = spawnSync(executable, [
    ...(browser ? [resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules/vitest/vitest.mjs')] : []),
    'run', '--config', config, '--maxWorkers=2', '--testTimeout=10000',
    '--reporter=default', '--reporter=json', `--outputFile=${outputFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try {
    report = JSON.parse(readFileSync(outputFile, 'utf8'));
  } catch {
    errors.push(`${mode} produced no JSON report (exit ${result.status}).`);
    report = { testResults: [] };
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0].name) !== file)
    errors.push(`${mode} did not report the exact unchanged ToolbarRoot test file.`);
  return {
    exitCode: result.status,
    counts: {
      total: report.numTotalTests ?? 0,
      passed: report.numPassedTests ?? 0,
      failed: report.numFailedTests ?? 0,
      skipped: report.numPendingTests ?? 0,
    },
    assertions: suites.flatMap((suite) => suite.assertionResults ?? []).map((item) => ({
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
    })),
    sources: [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1]))
      .filter((item) => item.mode === mode)
      .map((item) => item.file),
    nativeExecutions: Object.fromEntries(
      [...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
        .flatMap((match) => Object.entries(JSON.parse(match[1]))),
    ),
  };
}

try {
  const before = parityInputHashes();
  guard('Before');
  const react = run('react');
  const solid = run('solid');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('A source, dependency, or parity runner input changed during the run.');
  for (const [mode, result] of [['React', react], ['Solid', solid]]) {
    if (result.counts.total !== 28 || result.assertions.length !== 28)
      errors.push(`${mode} did not run the unchanged 28-assertion inventory.`);
    if (result.counts.skipped !== (browser ? 0 : 10))
      errors.push(`${mode} did not retain the expected ${browser ? 'zero Chromium' : 'ten JSDOM'} skips.`);
  }
  if (react.exitCode !== 0 || react.counts.failed !== 0)
    errors.push('The pinned React reference did not pass.');
  if (!react.sources.includes('base-ui/packages/react/src/toolbar/root/ToolbarRoot.tsx'))
    errors.push('React did not load the pinned ToolbarRoot implementation.');
  const unexpected = unexpectedOriginalReactModules(solid.sources);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sources.includes('base-ui/packages/solid/src/structure.tsx') ||
      !solid.nativeExecutions['base-ui/packages/solid/src/structure.tsx#Toolbar.Root'])
    errors.push('Solid did not load and execute native Toolbar.Root.');
  const reactByName = new Map(react.assertions.map((item) => [item.fullName, item]));
  const differences = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(item.fullName);
    return reference?.status === item.status ? [] : [{ ...item, reactStatus: reference?.status }];
  });
  const evidence = {
    routeValid: errors.length === 0,
    parity: errors.length === 0 && differences.length === 0 && solid.exitCode === 0,
    environment: browser ? 'chromium' : 'jsdom',
    originalTestFile: file,
    react: { counts: react.counts, sourceRoute: 'pinned React Toolbar' },
    solid: { counts: solid.counts, sourceRoute: 'native Solid structure.tsx' },
    differences,
    inputHashBefore: before.digest,
    inputHashAfter: after.digest,
    errors,
  };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    routeValid: evidence.routeValid,
    parity: evidence.parity,
    react: react.counts,
    solid: solid.counts,
    differences,
    errors,
    artifact: relative(root, artifact),
  }, null, 2));
  if (!evidence.parity) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
