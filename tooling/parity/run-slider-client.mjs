import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules, selectedSsrFixtureModules } from './original-react-module-policy.mjs';
const sliderTestFile = 'base-ui/packages/react/src/slider/root/SliderRoot.test.tsx';
const browser = process.argv.includes('--browser');

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(resolve(tmpdir(), 'solid-cn-slider-client-'));
const artifact = resolve(root, browser
  ? 'artifacts/unchanged-slider-browser-comparison.json'
  : 'artifacts/unchanged-slider-client-comparison.json');
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
const before = parityInputHashes();
const errors = [];

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8',
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const reportFile = resolve(temp, `${mode}.json`);
  const vitest = browser
    ? resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules/vitest/vitest.mjs')
    : resolve(root, 'node_modules/.bin/vitest');
  const processResult = spawnSync(browser ? process.execPath : vitest, [
    ...(browser ? [vitest] : []),
    'run', '--config', config, '--testNamePattern', '^(?!.*server-side rendering)',
    '--reporter=default', '--reporter=json', `--outputFile=${reportFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${processResult.stdout ?? ''}\n${processResult.stderr ?? ''}`;
  let report;
  try {
    report = JSON.parse(readFileSync(reportFile, 'utf8'));
  } catch {
    errors.push(`${mode} produced no JSON report (exit ${processResult.status}).`);
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0]?.name ?? '') !== sliderTestFile)
    errors.push(`${mode} did not report the unchanged Slider test file.`);
  const assertions = suites[0]?.assertionResults ?? [];
  const sourceModules = [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]))
    .filter((item) => item.mode === mode)
    .map((item) => item.file);
  const nativeExecutions = Object.fromEntries(
    [...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
      .flatMap((match) => Object.entries(JSON.parse(match[1]))),
  );
  return {
    exitCode: processResult.status,
    counts: {
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      skipped: report.numPendingTests,
    },
    assertions: assertions.map((item) => ({
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed'
        ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
    })),
    sourceModules,
    nativeExecutions,
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
  };
}

try {
  guard('Before');
  const react = run('react', browser
    ? 'tooling/parity/reference-slider-browser.config.ts'
    : 'tooling/parity/reference-slider-client.config.ts');
  const solid = run('solid', browser
    ? 'tooling/parity/dual-slider-browser-solid.config.ts'
    : 'tooling/parity/dual-slider-client-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  if (react.counts.total !== 216 || solid.counts.total !== 216)
    errors.push('The original 216-assertion inventory was not loaded in both modes.');
  const expected = browser ? { passed: 213, skipped: 3 } : { passed: 171, skipped: 45 };
  for (const [name, result] of [['React', react], ['Solid', solid]]) {
    if (result.exitCode !== 0 || result.counts.passed !== expected.passed ||
        result.counts.skipped !== expected.skipped || result.unhandledErrors.length ||
        result.outputHasUnhandledErrors)
      errors.push(`${name} has an unexpected count, process failure, or unhandled error.`);
  }
  if (!react.sourceModules.includes('base-ui/packages/react/src/slider/root/SliderRoot.tsx'))
    errors.push('React did not load the pinned original Slider implementation.');
  const unexpected = unexpectedOriginalReactModules(solid.sourceModules, selectedSsrFixtureModules.slider);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sourceModules.includes('base-ui/packages/solid/src/controls.tsx') ||
      !solid.nativeExecutions['base-ui/packages/solid/src/controls.tsx#Slider.Root'])
    errors.push('Solid did not load and execute native Slider.Root.');
  const reactByName = new Map(react.assertions.map((item) => [item.fullName, item]));
  const mismatches = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(item.fullName);
    return reference?.status === item.status ? [] : [{
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
    originalTestFile: sliderTestFile,
    clientFilter: '^(?!.*server-side rendering)',
    note: browser
      ? 'Three original browser skips remain. The server-render assertion has its own dual SSR runner; filtered cases are not passes.'
      : 'The one unchanged server-render assertion has its own dual SSR runner; filtered cases are not passes.',
    react: { counts: react.counts, sourceRoute: 'pinned React SliderRoot.tsx' },
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
