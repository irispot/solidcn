import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';
import { selectPartTests } from './select-parts-selected.mjs';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(resolve(tmpdir(), 'solid-cn-select-parts-'));
const artifact = resolve(root, 'artifacts/unchanged-select-parts-comparison.json');
const expectedAssertions = 231;
const expectedPassed = 220;
const expectedSkipped = 11;
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
const before = parityInputHashes();

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8',
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const outputPath = resolve(temp, `${mode}.json`);
  const result = spawnSync(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--maxWorkers=2', '--testTimeout=10000',
    '--reporter=default', '--reporter=json', `--outputFile=${outputPath}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try {
    report = JSON.parse(readFileSync(outputPath, 'utf8'));
  } catch {
    errors.push(`${mode} produced no JSON report (exit ${result.status}).`);
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
  }
  const suites = report.testResults ?? [];
  const paths = suites.map((suite) => relative(root, suite.name)).sort();
  if (JSON.stringify(paths) !== JSON.stringify([...selectPartTests].sort()))
    errors.push(`${mode} did not report every exact unchanged Select part file.`);
  const assertions = suites.flatMap((suite) =>
    (suite.assertionResults ?? []).map((item) => ({
      file: relative(root, suite.name),
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
    })),
  );
  const sources = [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]))
    .filter((item) => item.mode === mode)
    .map((item) => item.file);
  const cases = [...output.matchAll(/Native Solid case evidence: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]));
  return {
    exitCode: result.status,
    counts: {
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      skipped: report.numPendingTests,
    },
    assertions,
    sources,
    cases,
  };
}

const identity = (item) => `${item.file}\u0000${item.fullName}\u0000${item.status}`;
const tally = (items) => {
  const counts = new Map();
  for (const item of items) counts.set(identity(item), (counts.get(identity(item)) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
};

try {
  guard('Before');
  const react = run('react', 'tooling/parity/reference-select-parts.config.ts');
  const solid = run('solid', 'tooling/parity/dual-select-parts-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  for (const [mode, result] of [['React', react], ['Solid', solid]]) {
    if (result.exitCode !== 0 || result.counts.failed !== 0)
      errors.push(`${mode} has failing assertions or did not complete.`);
    if (result.assertions.length !== expectedAssertions || result.counts.total !== expectedAssertions)
      errors.push(`${mode} did not run the pinned ${expectedAssertions}-assertion inventory.`);
    if (result.counts.skipped !== expectedSkipped || result.counts.passed !== expectedPassed)
      errors.push(`${mode} has missing or filtered assertions, or its pass/skip count changed.`);
  }
  if (JSON.stringify(tally(react.assertions)) !== JSON.stringify(tally(solid.assertions)))
    errors.push('React and native Solid assertion identities or statuses differ.');
  if (!react.sources.includes('base-ui/packages/react/src/select/index.ts'))
    errors.push('React did not load the pinned original Select implementation.');
  const unexpected = unexpectedOriginalReactModules(solid.sources);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sources.includes('base-ui/packages/solid/src/selection.tsx'))
    errors.push('Solid did not load the native Selection implementation.');
  const caseNames = tally(solid.cases.map((item) => ({
    file: relative(root, item.testPath),
    fullName: item.fullName.replaceAll(' > ', ' '),
    status: 'passed',
  })));
  if (JSON.stringify(caseNames) !== JSON.stringify(tally(solid.assertions.filter((item) => item.status === 'passed'))))
    errors.push('Native execution evidence does not match every original assertion.');
  for (const item of solid.cases) {
    const part = item.testPath.match(/\/select\/([^/]+)\/Select[^/]+\.test\.tsx$/)?.[1];
    const target = part?.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join('');
    const native = item.nativeExecutions ?? {};
    if (!item.renders || !native['base-ui/packages/solid/src/selection.tsx#Select.Root'])
      errors.push(`${item.fullName}: native Select.Root did not execute.`);
    if (target && target !== 'ScrollArrow' && !native[`base-ui/packages/solid/src/selection.tsx#Select.${target}`])
      errors.push(`${item.fullName}: native Select.${target} did not execute.`);
    if (target === 'ScrollArrow' &&
        !native['base-ui/packages/solid/src/selection.tsx#Select.ScrollDownArrow'])
      errors.push(`${item.fullName}: native Select scroll arrows did not execute.`);
  }
  const evidence = {
    success: errors.length === 0,
    originalTestFiles: selectPartTests,
    expectedAssertions,
    react: { counts: react.counts, sourceRoute: 'pinned React Select' },
    solid: { counts: solid.counts, sourceRoute: 'native Solid selection.tsx', cases: solid.cases.length },
    inputHashBefore: before.digest,
    inputHashAfter: after.digest,
    errors,
  };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    files: selectPartTests.length,
    react: react.counts,
    solid: solid.counts,
    sourceHashStable: before.digest === after.digest,
    errors: errors.slice(0, 20),
    artifact: relative(root, artifact),
  }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
