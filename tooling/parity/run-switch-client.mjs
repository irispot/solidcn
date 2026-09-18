import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const originalTestFiles = [
  'base-ui/packages/react/src/switch/root/SwitchRoot.test.tsx',
  'base-ui/packages/react/src/switch/thumb/SwitchThumb.test.tsx',
];
const root = resolve(import.meta.dirname, '../..');
const artifact = resolve(root, 'artifacts/unchanged-switch-client-comparison.json');
const temp = mkdtempSync(resolve(tmpdir(), 'solid-cn-switch-client-'));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
const before = parityInputHashes();

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const outputFile = resolve(temp, `${mode}.json`);
  const result = spawnSync(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--reporter=default', '--reporter=json',
    `--outputFile=${outputFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try {
    report = JSON.parse(readFileSync(outputFile, 'utf8'));
  } catch {
    errors.push(`${mode} produced no JSON report (exit ${result.status}).`);
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
  }
  const suites = report.testResults ?? [];
  if (JSON.stringify(suites.map((suite) => relative(root, suite.name)).sort()) !==
      JSON.stringify([...originalTestFiles].sort()))
    errors.push(`${mode} did not report both unchanged Switch part test files.`);
  const assertions = suites.flatMap((suite) =>
    (suite.assertionResults ?? []).map((item) => ({
      file: relative(root, suite.name),
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed'
        ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
    })));
  const sourceModules = [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]))
    .filter((item) => item.mode === mode)
    .map((item) => item.file);
  const nativeExecutions = Object.fromEntries(
    [...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
      .flatMap((match) => Object.entries(JSON.parse(match[1]))),
  );
  return {
    exitCode: result.status,
    counts: {
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      skipped: report.numPendingTests,
    },
    assertions,
    sourceModules,
    nativeExecutions,
  };
}

try {
  guard('Before');
  const react = run('react', 'tooling/parity/reference-switch-client.config.ts');
  const solid = run('solid', 'tooling/parity/dual-switch-client-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  if (react.counts.total !== 98 || solid.counts.total !== 98 ||
      react.assertions.length !== 98 || solid.assertions.length !== 98)
    errors.push('The original 98-assertion Switch inventory was not loaded in both modes.');
  for (const source of [
    'base-ui/packages/react/src/switch/root/SwitchRoot.tsx',
    'base-ui/packages/react/src/switch/thumb/SwitchThumb.tsx',
  ]) if (!react.sourceModules.includes(source))
    errors.push(`React did not load the pinned original implementation: ${source}`);
  const unexpected = unexpectedOriginalReactModules(solid.sourceModules);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sourceModules.includes('base-ui/packages/solid/src/controls.tsx') ||
      !solid.nativeExecutions['base-ui/packages/solid/src/controls.tsx#Switch.Root'] ||
      !solid.nativeExecutions['base-ui/packages/solid/src/controls.tsx#Switch.Thumb'])
    errors.push('Solid did not load and execute both native Switch parts.');
  const key = (item) => `${item.file}\0${item.fullName}`;
  const reactByName = new Map(react.assertions.map((item) => [key(item), item]));
  const mismatches = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(key(item));
    return reference?.status === item.status ? [] : [{
      file: item.file,
      fullName: item.fullName,
      react: reference?.status ?? 'missing',
      solid: item.status,
      solidError: item.error,
    }];
  });
  if (react.assertions.length !== solid.assertions.length)
    errors.push('React and Solid assertion inventory lengths differ.');
  if (react.counts.failed) errors.push('The original React reference has failing assertions.');
  if (solid.counts.failed) errors.push(`${solid.counts.failed} native Solid assertions fail.`);
  if (mismatches.length) errors.push(`${mismatches.length} assertion statuses differ.`);
  const evidence = {
    success: errors.length === 0,
    originalTestFiles,
    note: 'Nine unchanged Root Form assertions are skipped by the original JSDOM suite; the browser route runs them.',
    react: { counts: react.counts, sourceRoute: 'pinned React SwitchRoot.tsx and SwitchThumb.tsx' },
    solid: {
      counts: solid.counts,
      sourceRoute: 'native Solid controls.tsx',
      nativeExecutions: solid.nativeExecutions,
      executionCheck: 'The Solid fixture afterEach asserts a native component call for every rendered original case.',
    },
    mismatches,
    inputsBefore: before.digest,
    inputsAfter: after.digest,
    errors,
  };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    react: evidence.react.counts,
    solid: evidence.solid.counts,
    mismatches: mismatches.length,
    sourceHashStable: before.digest === after.digest,
    errors,
    artifact: relative(root, artifact),
  }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
