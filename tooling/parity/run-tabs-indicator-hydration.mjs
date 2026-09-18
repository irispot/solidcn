import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTestFile = 'base-ui/packages/react/src/tabs/indicator/TabsIndicator.test.tsx';
const artifact = resolve(root, 'artifacts/unchanged-tabs-indicator-hydration-comparison.json');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-tabs-indicator-hydration-'));
const vitest = resolve(root, 'node_modules/.bin/vitest');
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
  const config = mode === 'react'
    ? 'tooling/parity/reference-tabs-indicator-hydration.config.ts'
    : 'tooling/parity/dual-tabs-indicator-hydration-solid.config.ts';
  const outputFile = resolve(temporary, `${mode}.json`);
  const result = spawnSync(vitest, [
    'run', '--config', config, '--reporter=default', '--reporter=json', `--outputFile=${outputFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, TZ: 'UTC' } });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(outputFile, 'utf8')); }
  catch {
    errors.push(`${mode} produced no JSON report (exit ${result.status}): ${output.slice(-1000)}`);
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0]?.name ?? '') !== originalTestFile)
    errors.push(`${mode} did not report the unchanged Tabs Indicator file.`);
  const assertions = (suites[0]?.assertionResults ?? []).map((item) => ({
    fullName: item.fullName,
    status: item.status,
    error: item.status === 'failed' ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
  }));
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
    counts: { total: report.numTotalTests, passed: report.numPassedTests,
      failed: report.numFailedTests, skipped: report.numPendingTests },
    assertions, sourceModules, nativeExecutions,
    ssrEvidence: [...output.matchAll(/Native Solid Tabs Indicator SSR evidence: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1])),
    hydrationEvidenceCount: output.match(/Native Solid hydration evidence:/g)?.length ?? 0,
    identityEvidence: [...output.matchAll(/Native Solid Tabs Indicator node identity: (\d+)/g)]
      .map((match) => Number(match[1])),
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
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
    errors.push('Source, dependency, or parity runner input changed during the run.');
  for (const [mode, result] of [['react', react], ['solid', solid]]) {
    if (result.counts.total !== 45 || result.assertions.length !== 45)
      errors.push(`${mode} did not load all 45 original assertions.`);
    const selected = result.assertions.filter((item) => item.fullName.includes('pre-hydration rendering'));
    if (selected.length !== 4 || selected.some((item) => item.status !== 'passed'))
      errors.push(`${mode} did not pass all four original SSR/hydration assertions.`);
    if (result.counts.passed !== 4 || result.counts.failed !== 0 || result.counts.skipped !== 41)
      errors.push(`${mode} has unexpected SSR/hydration assertion counts.`);
    if (result.exitCode !== 0 || result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${mode} SSR/hydration runner failed or had an unhandled error.`);
  }
  if (!react.sourceModules.includes('base-ui/packages/react/src/tabs/indicator/TabsIndicator.tsx'))
    errors.push('React did not load the pinned Tabs Indicator implementation.');
  const originalFixtureUtilities = [
    'base-ui/packages/react/src/utils/getCssDimensions.ts',
    'base-ui/packages/react/src/tabs/indicator/prehydrationScript.min.ts',
  ];
  const unexpected = unexpectedOriginalReactModules(solid.sourceModules, originalFixtureUtilities);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sourceModules.includes('base-ui/packages/solid/src/structure.tsx') ||
      !solid.nativeExecutions['base-ui/packages/solid/src/structure.tsx#Tabs.Indicator'])
    errors.push('Solid did not load and execute native Tabs.Indicator.');
  if (solid.ssrEvidence.length !== 4 || solid.ssrEvidence.some((entry) =>
      entry.hydrationKeys < 1 || entry.scripts !== 1))
    errors.push('Native SSR did not emit four keyed trees with one inline script each.');
  if (solid.hydrationEvidenceCount !== 1 || solid.identityEvidence.length !== 1 ||
      solid.identityEvidence[0] < 1)
    errors.push('Native Solid hydration did not retain server nodes in the original hydration case.');
  const reactByName = new Map(react.assertions.map((item) => [item.fullName, item]));
  const mismatches = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(item.fullName);
    return reference?.status === item.status ? [] : [{ fullName: item.fullName,
      react: reference?.status ?? 'missing', solid: item.status, solidError: item.error }];
  });
  if (mismatches.length) errors.push(`${mismatches.length} original assertion statuses differ.`);
  const evidence = { success: errors.length === 0, originalTestFile,
    note: 'This separate route runs all four original Tabs Indicator SSR/hydration cases. Other assertions are filtered, not parity skips.',
    react, solid, mismatches, inputsBefore: before.digest, inputsAfter: after.digest, errors };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    mismatches: mismatches.length, nativeSsr: solid.ssrEvidence.length === 4,
    nativeHydration: solid.hydrationEvidenceCount === 1,
    retainedServerNodes: solid.identityEvidence.length === 1,
    sourceHashStable: before.digest === after.digest, errors,
    artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
