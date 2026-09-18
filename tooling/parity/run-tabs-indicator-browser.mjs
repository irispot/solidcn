import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTestFile = 'base-ui/packages/react/src/tabs/indicator/TabsIndicator.test.tsx';
const artifact = resolve(root, 'artifacts/unchanged-tabs-indicator-browser-comparison.json');
const ssrArtifact = resolve(root, 'artifacts/unchanged-tabs-indicator-hydration-comparison.json');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-tabs-indicator-browser-'));
const browserVitest = resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules/vitest/vitest.mjs');
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
    ? 'tooling/parity/reference-tabs-indicator-browser-runtime.config.ts'
    : 'tooling/parity/dual-tabs-indicator-browser-runtime-solid.config.ts';
  const outputFile = resolve(temporary, `${mode}.json`);
  const result = spawnSync(process.execPath, [browserVitest, 'run', '--config', config,
    '--reporter=default', '--reporter=json', `--outputFile=${outputFile}`], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(outputFile, 'utf8')); }
  catch {
    errors.push(`${mode} produced no browser JSON report (exit ${result.status}): ${output.slice(-1000)}`);
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
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
  };
}

try {
  const before = parityInputHashes();
  guard('Before');
  const react = run('react');
  const solid = run('solid');
  const ssrRun = spawnSync(process.execPath, ['tooling/parity/run-tabs-indicator-hydration.mjs'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  let ssr;
  try { ssr = JSON.parse(readFileSync(ssrArtifact, 'utf8')); }
  catch { errors.push('The genuine Solid SSR/hydration artifact is missing.'); }
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  const filteredNames = [
    'renders the inline pre-hydration script during server-side rendering',
    'inlines the script contents during server-side rendering',
    'applies the CSP nonce to the pre-hydration script',
    'keeps the script during hydration and removes it afterwards',
  ];
  for (const [mode, result] of [['react', react], ['solid', solid]]) {
    if (result.counts.total !== 45 || result.assertions.length !== 45)
      errors.push(`${mode} did not load the full 45-assertion Indicator inventory.`);
    const skipped = result.assertions.filter((item) => item.status === 'skipped');
    if (skipped.length !== 4 || skipped.some((item) =>
      !filteredNames.some((name) => item.fullName.includes(name))))
      errors.push(`${mode} browser route skipped an unexpected assertion.`);
    if (result.counts.passed !== 41 || result.counts.failed !== 0 || result.counts.skipped !== 4)
      errors.push(`${mode} browser runtime did not pass all 41 active assertions.`);
    if (result.exitCode !== 0 || result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${mode} browser runner failed or had an unhandled error.`);
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
  const reactByName = new Map(react.assertions.map((item) => [item.fullName, item]));
  const mismatches = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(item.fullName);
    return reference?.status === item.status ? [] : [{ fullName: item.fullName,
      react: reference?.status ?? 'missing', solid: item.status, solidError: item.error }];
  });
  if (mismatches.length) errors.push(`${mismatches.length} browser assertion statuses differ.`);
  if (ssrRun.status !== 0 || !ssr?.success || ssr.react?.counts?.passed !== 4 ||
      ssr.solid?.counts?.passed !== 4)
    errors.push('The complementary four original Node SSR/hydration assertions are not green.');
  const completeInventory = react.assertions.reduce((count, item, index) => {
    const serverCase = ssr?.react?.assertions?.[index];
    if (serverCase && serverCase.fullName !== item.fullName)
      errors.push(`SSR and browser inventories differ at assertion ${index + 1}.`);
    return count + Number(item.status === 'passed' || serverCase?.status === 'passed');
  }, 0);
  if (completeInventory !== 45)
    errors.push(`Combined browser and SSR routes cover ${completeInventory}/45 assertions.`);
  const evidence = { success: errors.length === 0, originalTestFile,
    note: 'The browser route runs 41 active assertions. Four server/hydration assertions run in the separate genuine Node SSR route. Together they cover all 45 original assertions.',
    react, solid, ssr: { success: Boolean(ssr?.success), artifact: relative(root, ssrArtifact),
      reactPassed: ssr?.react?.counts?.passed, solidPassed: ssr?.solid?.counts?.passed },
    combinedAssertions: completeInventory, mismatches,
    inputsBefore: before.digest, inputsAfter: after.digest, errors };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    ssr: evidence.ssr, combinedAssertions: completeInventory,
    mismatches: mismatches.length, sourceHashStable: before.digest === after.digest,
    errors, artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
