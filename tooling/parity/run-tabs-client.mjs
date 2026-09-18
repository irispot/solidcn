import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const browser = process.argv.includes('--browser');
const parts = process.argv.includes('--parts');
const originalTestFile = 'base-ui/packages/react/src/tabs/root/TabsRoot.test.tsx';
const originalTestFiles = parts
  ? ['list/TabsList', 'tab/TabsTab', 'panel/TabsPanel', 'indicator/TabsIndicator']
    .map((name) => `base-ui/packages/react/src/tabs/${name}.test.tsx`)
  : [originalTestFile];
const serverCaseNames = [
  'renders the inline pre-hydration script during server-side rendering',
  'inlines the script contents during server-side rendering',
  'applies the CSP nonce to the pre-hydration script',
  'keeps the script during hydration and removes it afterwards',
];
const serverExclusionPattern = `^(?!.*(?:${serverCaseNames.map((name) =>
  name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`;
const artifact = resolve(root, `artifacts/unchanged-tabs-${parts ? 'parts-' : ''}${browser ? 'browser' : 'client'}-comparison.json`);
const temporary = mkdtempSync(resolve(tmpdir(), `solid-cn-tabs-${browser ? 'browser' : 'client'}-`));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const outputFile = resolve(temporary, `${mode}.json`);
  const executable = browser
    ? process.execPath
    : resolve(root, 'node_modules/.bin/vitest');
  const result = spawnSync(executable, [
    ...(browser ? [resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules/vitest/vitest.mjs')] : []),
    'run', '--config', config, '--reporter=default', '--reporter=json',
    ...(parts ? ['--testNamePattern', serverExclusionPattern] : []),
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
  if (suites.length !== originalTestFiles.length ||
      suites.some((suite) => !originalTestFiles.includes(relative(root, suite.name))))
    errors.push(`${mode} did not report the complete unchanged Tabs ${parts ? 'parts' : 'Root'} inventory.`);
  const assertions = suites.flatMap((suite) => suite.assertionResults ?? []).map((item) => ({
    fullName: item.fullName,
    status: item.status,
    error: item.status === 'failed'
      ? item.failureMessages?.join('\n').split('\n')[0] : undefined,
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
  let serverEvidence;
  if (parts) {
    const serverRun = spawnSync(process.execPath, ['tooling/parity/run-tabs-indicator-hydration.mjs'], {
      cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    try {
      serverEvidence = JSON.parse(readFileSync(resolve(root, 'artifacts/unchanged-tabs-indicator-hydration-comparison.json'), 'utf8'));
    } catch {
      errors.push('The separate genuine Solid SSR/hydration route has no evidence.');
    }
    if (serverRun.status !== 0 || !serverEvidence?.success ||
        serverEvidence.inputsBefore !== before.digest || serverEvidence.inputsAfter !== before.digest ||
        serverEvidence.react?.counts?.passed !== 4 || serverEvidence.solid?.counts?.passed !== 4)
      errors.push('The four original Indicator SSR/hydration cases did not pass on these inputs.');
  }
  const route = parts ? browser ? 'parts-browser' : 'parts' : browser ? 'browser' : 'client';
  const react = run('react', `tooling/parity/reference-tabs-${route}.config.ts`);
  const solid = run('solid', `tooling/parity/dual-tabs-${route}-solid.config.ts`);
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  const expectedTotal = parts ? 119 : 136;
  if (react.counts.total !== expectedTotal || solid.counts.total !== expectedTotal ||
      react.assertions.length !== expectedTotal || solid.assertions.length !== expectedTotal)
    errors.push(`The original ${expectedTotal}-assertion Tabs inventory was not loaded in both modes.`);
  if (browser && (react.counts.skipped !== (parts ? 4 : 0) || solid.counts.skipped !== (parts ? 4 : 0)))
    errors.push('The browser route has a different original skipped-case count.');
  if (!browser && (react.counts.skipped !== (parts ? 32 : 27) || solid.counts.skipped !== (parts ? 32 : 27)))
    errors.push('The JSDOM route has a different original skipped-case count.');
  if (parts)
    for (const name of serverCaseNames) {
      const selected = [react, solid].flatMap((run) => run.assertions.filter((item) => item.fullName.includes(name)));
      if (selected.length !== 2 || selected.some((item) => item.status !== 'skipped'))
        errors.push(`The server-only case was not routed separately: ${name}`);
    }
  for (const part of parts ? ['list/TabsList', 'tab/TabsTab', 'panel/TabsPanel', 'indicator/TabsIndicator'] : ['root/TabsRoot'])
    if (!react.sourceModules.includes(`base-ui/packages/react/src/tabs/${part}.tsx`))
      errors.push(`React did not load the pinned original Tabs ${part} implementation.`);
  const testOnlyFixtures = parts ? [
    'base-ui/packages/react/src/utils/getCssDimensions.ts',
    'base-ui/packages/react/src/tabs/indicator/prehydrationScript.min.ts',
  ] : [];
  const unexpected = unexpectedOriginalReactModules(solid.sourceModules, testOnlyFixtures);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sourceModules.includes('base-ui/packages/solid/src/structure.tsx') ||
      (parts ? ['List', 'Tab', 'Panel', 'Indicator'] : ['Root'])
        .some((part) => !solid.nativeExecutions[`base-ui/packages/solid/src/structure.tsx#Tabs.${part}`]))
    errors.push(`Solid did not load and execute all native Tabs ${parts ? 'parts' : 'Root'}.`);
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
  if (react.counts.failed) errors.push(`${react.counts.failed} pinned React assertions fail.`);
  if (solid.counts.failed) errors.push(`${solid.counts.failed} native Solid assertions fail.`);
  if (react.exitCode !== 0 || solid.exitCode !== 0)
    errors.push(`Vitest exit codes differ from success: React ${react.exitCode}, Solid ${solid.exitCode}.`);
  if (mismatches.length) errors.push(`${mismatches.length} assertion statuses differ.`);
  const evidence = {
    success: errors.length === 0,
    originalTestFiles,
    note: parts
      ? `The unchanged Tabs parts inventory routes four Indicator server cases to the real SSR/hydration runner; ${browser ? 'two' : '28'} other cases are original environment skips.`
      : browser
      ? 'The real Chromium route runs all 136 unchanged Tabs Root assertions.'
      : 'Twenty-seven original JSDOM assertions are skipped. The browser route runs them.',
    react: { counts: react.counts, sourceRoute: 'pinned React Tabs source' },
    solid: {
      counts: solid.counts,
      sourceRoute: 'native Solid structure.tsx',
      nativeExecutions: solid.nativeExecutions,
    },
    serverEvidence: parts ? {
      artifact: 'artifacts/unchanged-tabs-indicator-hydration-comparison.json',
      reactPassed: serverEvidence?.react?.counts?.passed,
      solidPassed: serverEvidence?.solid?.counts?.passed,
    } : undefined,
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
  rmSync(temporary, { recursive: true, force: true });
}
