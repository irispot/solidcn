import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTestFile = 'base-ui/packages/react/src/checkbox/root/CheckboxRoot.test.tsx';
const selectedCase = 'defers an explicit id until hydration';
const artifact = resolve(root, 'artifacts/unchanged-checkbox-hydration-comparison.json');
const temp = mkdtempSync(resolve(tmpdir(), 'solid-cn-checkbox-hydration-'));
const vitest = resolve(root, 'node_modules/.bin/vitest');
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

function run(framework) {
  const config = framework === 'react'
    ? 'tooling/parity/reference-checkbox-hydration.config.ts'
    : 'tooling/parity/dual-checkbox-hydration-solid.config.ts';
  const outputFile = resolve(temp, `${framework}.json`);
  const result = spawnSync(vitest, [
    'run', '--config', config, '--reporter=default', '--reporter=json', `--outputFile=${outputFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, TZ: 'UTC' } });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(outputFile, 'utf8')); }
  catch {
    errors.push(`${framework} produced no JSON report (exit ${result.status}): ${output.slice(-800)}`);
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0]?.name ?? '') !== originalTestFile)
    errors.push(`${framework} did not report the unchanged Checkbox Root file.`);
  const assertions = (suites[0]?.assertionResults ?? []).map((item) => ({
    fullName: item.fullName, status: item.status,
    error: item.status === 'failed' ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
  }));
  const sourceModules = [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]))
    .filter((item) => item.mode === framework)
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
    ssrEvidence: [...output.matchAll(/Native Solid Checkbox SSR evidence: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1])),
    hydrationEvidenceCount: output.match(/Native Solid hydration evidence:/g)?.length ?? 0,
    identityEvidence: [...output.matchAll(/Native Solid Checkbox node identity: (\d+)/g)]
      .map((match) => Number(match[1])),
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
  };
}

try {
  guard('Before');
  const react = run('react');
  const solid = run('solid');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  for (const [framework, result] of [['react', react], ['solid', solid]]) {
    if (result.counts.total !== 103 || result.assertions.length !== 103)
      errors.push(`${framework} did not load the complete original 103-assertion inventory.`);
    const selected = result.assertions.filter((item) => item.fullName.includes(selectedCase));
    if (selected.length !== 2 || selected.some((item) => item.status !== 'passed'))
      errors.push(`${framework} did not pass exactly two original SSR/hydration assertions.`);
    if (result.counts.passed !== 2 || result.counts.failed !== 0 || result.counts.skipped !== 101)
      errors.push(`${framework} has unexpected hydration assertion counts.`);
    if (result.exitCode !== 0 || result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${framework} hydration runner failed or had an unhandled error.`);
  }
  if (!react.sourceModules.includes('base-ui/packages/react/src/checkbox/root/CheckboxRoot.tsx'))
    errors.push('React did not load the pinned Checkbox Root implementation.');
  const unexpected = unexpectedOriginalReactModules(solid.sourceModules);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sourceModules.includes('base-ui/packages/solid/src/controls.tsx') ||
      !solid.nativeExecutions['base-ui/packages/solid/src/controls.tsx#Checkbox.Root'])
    errors.push('Solid did not load and execute native Checkbox.Root.');
  if (solid.ssrEvidence.length !== 2 || solid.ssrEvidence.some((entry) => entry.hydrationKeys < 1) ||
      solid.hydrationEvidenceCount !== 2 || solid.identityEvidence.length !== 2 ||
      solid.identityEvidence.some((count) => count < 1))
    errors.push('Solid did not prove native SSR, hydration, and retained server nodes in both cases.');
  const reactByName = new Map(react.assertions.map((item) => [item.fullName, item]));
  const mismatches = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(item.fullName);
    return reference?.status === item.status ? [] : [{ fullName: item.fullName,
      react: reference?.status ?? 'missing', solid: item.status, solidError: item.error }];
  });
  if (mismatches.length) errors.push(`${mismatches.length} assertion statuses differ.`);
  const evidence = { success: errors.length === 0, originalTestFile, selectedCase,
    note: 'This separate route runs the two original SSR and hydration cases. Other assertions are filtered, not parity skips.',
    react, solid, mismatches, inputsBefore: before.digest, inputsAfter: after.digest, errors };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    mismatches: mismatches.length, nativeSsr: solid.ssrEvidence.length === 2,
    nativeHydration: solid.hydrationEvidenceCount === 2,
    retainedServerNodes: solid.identityEvidence.length === 2,
    sourceHashStable: before.digest === after.digest, errors,
    artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
