import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTestFiles = [
  'base-ui/packages/react/src/switch/root/SwitchRoot.test.tsx',
  'base-ui/packages/react/src/switch/thumb/SwitchThumb.test.tsx',
];
const deps = resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules');
const artifact = resolve(root, 'artifacts/unchanged-switch-browser-comparison.json');
const formCases = [
  'preserves Field validation props through canceled changes, submit, and reset',
  'should include the switch value in form submission, matching native checkbox behavior',
  'submits to an external form when `form` is provided',
  'submits uncheckedValue to an external form when off',
  'does not submit uncheckedValue when disabled',
  'matches native checkbox form submission behavior',
  'should submit uncheckedValue when switch is off and uncheckedValue is specified',
  'should submit custom uncheckedValue when switch is off',
  'submits custom value and uncheckedValue across an off/on/off cycle',
];
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
const temp = mkdtempSync(resolve(tmpdir(), 'solid-cn-switch-browser-'));

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const reportFile = resolve(temp, `${mode}.json`);
  const result = spawnSync(process.execPath, [
    resolve(deps, 'vitest/vitest.mjs'), 'run', '--config', config,
    '--reporter=default', '--reporter=json', `--outputFile=${reportFile}`,
  ], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, TZ: 'UTC' },
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try {
    report = JSON.parse(readFileSync(reportFile, 'utf8'));
  } catch {
    errors.push(`${mode} produced no JSON report (exit ${result.status}): ${output.slice(-1200)}`);
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
  const before = parityInputHashes();
  guard('Before');
  if (!existsSync(resolve(deps, '@vitest/browser-playwright/package.json')))
    throw new Error('Install the isolated browser dependencies with npm ci --prefix tooling/parity/shadcn-browser-deps --ignore-scripts.');
  const react = run('react', 'tooling/parity/reference-switch-browser.config.ts');
  const solid = run('solid', 'tooling/parity/dual-switch-browser-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  for (const [mode, result] of [['react', react], ['solid', solid]]) {
    if (result.counts.total !== 98 || result.assertions.length !== 98)
      errors.push(`${mode} did not run the complete original 98-assertion inventory.`);
    if (result.counts.skipped)
      errors.push(`${mode} skipped ${result.counts.skipped} original browser assertions.`);
    for (const name of formCases) {
      const matches = result.assertions.filter((item) => item.fullName.endsWith(` Form ${name}`));
      if (matches.length !== 1 || matches[0].status !== 'passed')
        errors.push(`${mode} Form case did not pass: ${name}`);
    }
  }
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
  if (react.counts.failed) errors.push(`${react.counts.failed} original React browser assertions fail.`);
  if (solid.counts.failed) errors.push(`${solid.counts.failed} native Solid browser assertions fail.`);
  if (mismatches.length) errors.push(`${mismatches.length} browser assertion statuses differ.`);
  const evidence = {
    success: errors.length === 0,
    originalTestFiles,
    browser: 'chromium',
    requiredFormCases: formCases,
    react,
    solid,
    mismatches,
    inputsBefore: before.digest,
    inputsAfter: after.digest,
    errors,
  };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    react: react.counts,
    solid: solid.counts,
    mismatches: mismatches.length,
    sourceHashStable: before.digest === after.digest,
    errors,
    artifact: relative(root, artifact),
  }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
