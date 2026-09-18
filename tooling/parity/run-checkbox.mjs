import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const mode = process.argv[2];
if (mode !== 'client' && mode !== 'browser')
  throw new Error('Use client or browser.');
const part = process.argv[3] === 'indicator' ? 'indicator' : 'root';
const root = resolve(import.meta.dirname, '../..');
const originalTestFile = part === 'root'
  ? 'base-ui/packages/react/src/checkbox/root/CheckboxRoot.test.tsx'
  : 'base-ui/packages/react/src/checkbox/indicator/CheckboxIndicator.test.tsx';
const artifact = resolve(root, `artifacts/unchanged-checkbox-${part === 'root' ? '' : 'indicator-'}${mode}-comparison.json`);
const temp = mkdtempSync(resolve(tmpdir(), `solid-cn-checkbox-${part}-${mode}-`));
const deps = resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules');
const vitest = mode === 'browser'
  ? resolve(deps, 'vitest/vitest.mjs')
  : resolve(root, 'node_modules/.bin/vitest');
const selectedCase = 'defers an explicit id until hydration';
const testNamePattern = part === 'root' ? `^(?!.*${selectedCase})` : undefined;
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
  const config = `tooling/parity/${framework === 'react' ? 'reference' : 'dual'}-checkbox-${part === 'root' ? '' : 'indicator-'}${mode}${framework === 'solid' ? '-solid' : ''}.config.ts`;
  const outputFile = resolve(temp, `${framework}.json`);
  const args = [
    'run', '--config', config,
    ...(testNamePattern ? ['--testNamePattern', testNamePattern] : []),
    '--reporter=default', '--reporter=json', `--outputFile=${outputFile}`,
  ];
  const result = spawnSync(mode === 'browser' ? process.execPath : vitest,
    mode === 'browser' ? [vitest, ...args] : args,
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
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
    errors.push(`${framework} did not report the unchanged Checkbox ${part} file.`);
  const assertions = (suites[0]?.assertionResults ?? []).map((item) => ({
    fullName: item.fullName,
    status: item.status,
    error: item.status === 'failed'
      ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
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
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
  };
}

try {
  guard('Before');
  if (mode === 'browser' && !existsSync(resolve(deps, '@vitest/browser-playwright/package.json')))
    errors.push('Isolated Chromium test dependencies are missing.');
  const react = run('react');
  const solid = run('solid');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  for (const [framework, result] of [['react', react], ['solid', solid]]) {
    const total = part === 'root' ? 103 : 27;
    if (result.counts.total !== total || result.assertions.length !== total)
      errors.push(`${framework} did not load the complete original ${total}-assertion inventory.`);
    if (part === 'root') {
      const selected = result.assertions.filter((item) => item.fullName.includes(selectedCase));
      if (selected.length !== 2 || selected.some((item) => item.status !== 'skipped'))
        errors.push(`${framework} did not exclude exactly two SSR/hydration assertions.`);
    }
    if (result.counts.skipped !== (part === 'root' ? (mode === 'browser' ? 2 : 18) : (mode === 'browser' ? 0 : 5)))
      errors.push(`${framework} has unexpected ${mode} skips.`);
    if (result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${framework} has unhandled error(s).`);
    if (result.exitCode !== 0) errors.push(`${framework} runner failed (exit ${result.exitCode}).`);
  }
  const referenceSource = part === 'root'
    ? 'base-ui/packages/react/src/checkbox/root/CheckboxRoot.tsx'
    : 'base-ui/packages/react/src/checkbox/indicator/CheckboxIndicator.tsx';
  if (!react.sourceModules.includes(referenceSource))
    errors.push(`React did not load the pinned Checkbox ${part} implementation.`);
  const unexpected = unexpectedOriginalReactModules(solid.sourceModules);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sourceModules.includes('base-ui/packages/solid/src/controls.tsx') ||
      !solid.nativeExecutions[`base-ui/packages/solid/src/controls.tsx#Checkbox.${part === 'root' ? 'Root' : 'Indicator'}`])
    errors.push(`Solid did not load and execute native Checkbox.${part === 'root' ? 'Root' : 'Indicator'}.`);
  const reactByName = new Map(react.assertions.map((item) => [item.fullName, item]));
  const mismatches = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(item.fullName);
    return reference?.status === item.status ? [] : [{
      fullName: item.fullName, react: reference?.status ?? 'missing',
      solid: item.status, solidError: item.error,
    }];
  });
  if (react.counts.failed) errors.push(`${react.counts.failed} original React assertions fail.`);
  if (solid.counts.failed) errors.push(`${solid.counts.failed} native Solid assertions fail.`);
  if (mismatches.length) errors.push(`${mismatches.length} assertion statuses differ.`);
  const evidence = {
    success: errors.length === 0, originalTestFile,
    environment: mode === 'browser' ? 'chromium' : 'jsdom',
    selectedCase: part === 'root' ? selectedCase : undefined,
    note: part === 'root' ? 'Two original SSR/hydration assertions are filtered and not covered by this route.' : undefined,
    react, solid, mismatches, inputsBefore: before.digest, inputsAfter: after.digest, errors,
  };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    mismatches: mismatches.length, sourceHashStable: before.digest === after.digest,
    errors, artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
