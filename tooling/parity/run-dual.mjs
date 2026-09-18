import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { selectedTests, selectedNativeTargets } from './selected-tests.mjs';
import { ssrTestFile, ssrTestName } from './ssr-selected.mjs';
import { unexpectedOriginalReactModules, selectedSsrFixtureModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const artifacts = resolve(root, 'artifacts');
mkdirSync(artifacts, { recursive: true });

function sourcePaths(directory) {
  const output = [];
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) output.push(...sourcePaths(path));
    else if (/\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) output.push(path);
  }
  return output;
}

function inputHashes() {
  const paths = [
    'package.json',
    'package-lock.json',
    ...sourcePaths('base-ui/packages/react/src'),
    ...sourcePaths('base-ui/packages/react/test'),
    ...sourcePaths('base-ui/packages/utils/src'),
    ...sourcePaths('base-ui/packages/solid/src'),
    ...sourcePaths('tooling/parity'),
    'base-ui/test/setupVitest.ts',
  ];
  const files = Object.fromEntries(
    paths.sort().map((path) => [
      path,
      createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'),
    ]),
  );
  const digest = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  return { digest, files };
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(' '),
    exitCode: result.status,
    error: result.error?.message,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  };
}

function testRun(mode, auditMode, config) {
  const name = `unchanged-selected-${mode}`;
  const reportPath = `artifacts/${name}.json`;
  const logPath = `artifacts/${name}.log`;
  // A crash must never allow the prior JSON report to look current.
  writeFileSync(resolve(root, reportPath), JSON.stringify({ success: false, testResults: [] }));
  const result = run(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--reporter=default', '--reporter=json',
    `--outputFile=${reportPath}`,
  ]);
  writeFileSync(resolve(root, logPath), result.output);
  let report;
  try {
    report = JSON.parse(readFileSync(resolve(root, reportPath), 'utf8'));
  } catch (error) {
    report = { success: false, testResults: [], parseError: String(error) };
  }
  const sourceModules = new Set();
  for (const match of result.output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)) {
    try {
      const loaded = JSON.parse(match[1]);
      if (loaded.mode === auditMode) sourceModules.add(loaded.file);
    } catch { /* The report validation below will reject missing source evidence. */ }
  }
  const nativeExecutions = {};
  const nativeCaseExecutions = [];
  if (auditMode === 'solid') {
    for (const match of result.output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)) {
      for (const [source, count] of Object.entries(JSON.parse(match[1]))) {
        nativeExecutions[source] = (nativeExecutions[source] ?? 0) + count;
      }
    }
    for (const match of result.output.matchAll(/Native Solid case evidence: (\{[^\n]+\})/g)) {
      nativeCaseExecutions.push(JSON.parse(match[1]));
    }
  }
  return {
    command: result.command,
    exitCode: result.exitCode,
    error: result.error,
    reportPath,
    logPath,
    success: report.success === true,
    counts: {
      files: report.testResults?.length,
      nestedSuites: report.numTotalTestSuites,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      skipped: report.numPendingTests,
      todo: report.numTodoTests,
      total: report.numTotalTests,
    },
    sourceModules: [...sourceModules].sort(),
    nativeExecutions,
    nativeCaseExecutions,
    report,
  };
}

function suiteAssertions(runResult, errors, expectedFiles = selectedTests) {
  const suites = new Map();
  for (const suite of runResult.report.testResults ?? []) {
    const file = relative(root, suite.name).replaceAll('\\', '/');
    if (suites.has(file)) errors.push(`${runResult.reportPath}: duplicate suite ${file}`);
    const assertions = new Map();
    for (const assertion of suite.assertionResults ?? []) {
      const statuses = assertions.get(assertion.fullName) ?? [];
      statuses.push(assertion.status);
      assertions.set(assertion.fullName, statuses);
    }
    for (const statuses of assertions.values()) statuses.sort();
    suites.set(file, { status: suite.status, assertions });
  }
  const actual = [...suites.keys()].sort();
  const expected = [...expectedFiles].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${runResult.reportPath}: suite inventory differs from the selected source files`);
  }
  const total = [...suites.values()].reduce((count, suite) =>
    count + [...suite.assertions.values()].reduce((n, statuses) => n + statuses.length, 0), 0);
  if (total !== runResult.counts.total) {
    errors.push(`${runResult.reportPath}: total test count does not match assertion rows`);
  }
  return suites;
}

function compare(reactSuites, solidSuites, files = selectedTests) {
  const mismatches = [];
  const sharedSkips = [];
  const referenceOnlySkips = [];
  const solidOnlySkips = [];
  for (const file of files) {
    const reference = reactSuites.get(file)?.assertions ?? new Map();
    const native = solidSuites.get(file)?.assertions ?? new Map();
    const names = new Set([...reference.keys(), ...native.keys()]);
    for (const fullName of names) {
      const react = reference.get(fullName) ?? [];
      const solid = native.get(fullName) ?? [];
      const row = { file, fullName, react, solid };
      if (JSON.stringify(react) !== JSON.stringify(solid)) mismatches.push(row);
      const reactSkipped = react.filter((status) => status === 'pending' || status === 'skipped').length;
      const solidSkipped = solid.filter((status) => status === 'pending' || status === 'skipped').length;
      if (reactSkipped && solidSkipped) sharedSkips.push({ ...row, count: Math.min(reactSkipped, solidSkipped) });
      if (reactSkipped > solidSkipped) referenceOnlySkips.push({ ...row, count: reactSkipped - solidSkipped });
      if (solidSkipped > reactSkipped) solidOnlySkips.push({ ...row, count: solidSkipped - reactSkipped });
    }
  }
  return { mismatches, sharedSkips, referenceOnlySkips, solidOnlySkips };
}

const startedAt = new Date().toISOString();
const inputsBefore = inputHashes();
const errors = [];
if (new Set(selectedTests).size !== selectedTests.length) errors.push('Selected test paths are not unique.');
for (const file of selectedTests) {
  try {
    if (!statSync(resolve(root, file)).isFile()) errors.push(`Selected test is not a file: ${file}`);
  } catch { errors.push(`Selected test is missing: ${file}`); }
}
const guardBefore = run('node', ['tooling/parity/preserve.mjs', 'verify']);
if (guardBefore.exitCode !== 0) errors.push('Original-file guard failed before the runs.');
const react = testRun('react-reference', 'react', 'tooling/parity/reference.config.ts');
const solid = testRun('native-solid', 'solid', 'tooling/parity/dual-solid.config.ts');
const reactSsr = testRun('slider-react-ssr-reference', 'react', 'tooling/parity/reference-ssr.config.ts');
const solidSsr = testRun('slider-native-solid-ssr', 'solid', 'tooling/parity/dual-ssr-solid.config.ts');
const guardAfter = run('node', ['tooling/parity/preserve.mjs', 'verify']);
if (guardAfter.exitCode !== 0) errors.push('Original-file guard failed after the runs.');
const inputsAfter = inputHashes();
if (inputsBefore.digest !== inputsAfter.digest) errors.push('Source files changed during the runs.');
const reactSuites = suiteAssertions(react, errors);
const solidSuites = suiteAssertions(solid, errors);
const comparison = compare(reactSuites, solidSuites);
const reactSsrSuites = suiteAssertions(reactSsr, errors, [ssrTestFile]);
const solidSsrSuites = suiteAssertions(solidSsr, errors, [ssrTestFile]);
const ssrComparison = compare(reactSsrSuites, solidSsrSuites, [ssrTestFile]);
const skipCount = (rows) => rows.reduce((sum, row) => sum + row.count, 0);
if (comparison.mismatches.length) errors.push('Assertion identities or statuses differ.');
if (ssrComparison.mismatches.length) errors.push('SSR assertion identities or statuses differ.');
if (skipCount(comparison.sharedSkips) + skipCount(comparison.referenceOnlySkips) !== react.counts.skipped ||
    skipCount(comparison.sharedSkips) + skipCount(comparison.solidOnlySkips) !== solid.counts.skipped) {
  errors.push('Skip rows do not match the Vitest skip counts.');
}
for (const [mode, result] of [['React', react], ['Solid', solid], ['React SSR', reactSsr], ['Solid SSR', solidSsr]]) {
  if (result.exitCode !== 0 || !result.success || result.counts.failed !== 0 || result.counts.todo !== 0) {
    errors.push(`${mode} test run did not pass.`);
  }
  if (result.error) errors.push(`${mode} process error: ${result.error}`);
}
const referenceImplementation = react.sourceModules.filter((file) =>
  file.startsWith('base-ui/packages/react/src/') && !/\.(?:test|spec)\.[jt]sx?$/.test(file));
const solidOriginalImplementation = solid.sourceModules.filter((file) =>
  file.startsWith('base-ui/packages/react/src/') && !/\.(?:test|spec)\.[jt]sx?$/.test(file));
const nativeImplementation = solid.sourceModules.filter((file) =>
  file.startsWith('base-ui/packages/solid/src/'));
if (!referenceImplementation.length) errors.push('React implementation source was not loaded.');
if (react.sourceModules.some((file) => file.startsWith('base-ui/packages/solid/src/'))) {
  errors.push('React run loaded Solid source.');
}
if (solidOriginalImplementation.length) errors.push('Solid run loaded original React implementation source.');
if (!nativeImplementation.length) errors.push('Solid implementation source was not loaded.');
if (!Object.keys(solid.nativeExecutions).length) errors.push('No native Solid execution evidence was emitted.');
for (const file of selectedTests) {
  const expectedTarget = selectedNativeTargets[file];
  if (!expectedTarget) continue;
  for (const [fullName, statuses] of solidSuites.get(file)?.assertions ?? []) {
    const passed = statuses.filter((status) => status === 'passed').length;
    if (!passed) continue;
    const matching = solid.nativeCaseExecutions.filter((row) =>
      relative(root, row.testPath).replaceAll('\\', '/') === file &&
      row.fullName.replaceAll(' > ', ' ') === fullName);
    if (matching.length !== passed || matching.some((row) => !(row.nativeExecutions?.[expectedTarget] > 0))) {
      errors.push(`Solid case did not execute its native target: ${file} :: ${fullName}`);
    }
  }
}
if (!nativeImplementation.includes('base-ui/packages/solid/src/merge-props/mergeProps.ts')) {
  errors.push('The mergeProps utility did not load its Solid implementation.');
}
const ssrIdentity = [...(reactSsrSuites.get(ssrTestFile)?.assertions.keys() ?? [])].filter(
  (name) => name.endsWith(ssrTestName),
);
if (ssrIdentity.length !== 1 ||
    JSON.stringify(reactSsrSuites.get(ssrTestFile)?.assertions.get(ssrIdentity[0])) !== JSON.stringify(['passed']) ||
    JSON.stringify(solidSsrSuites.get(ssrTestFile)?.assertions.get(ssrIdentity[0])) !== JSON.stringify(['passed'])) {
  errors.push('The selected SSR assertion did not pass exactly once in each mode.');
}
for (const [mode, result] of [['React SSR', reactSsr], ['Solid SSR', solidSsr]]) {
  if (result.counts.files !== 1 || result.counts.passed !== 1 || result.counts.failed !== 0 ||
      result.counts.skipped !== result.counts.total - 1) {
    errors.push(`${mode} selected more or fewer than one SSR assertion.`);
  }
}
const ssrReferenceImplementation = reactSsr.sourceModules.filter((file) =>
  file.startsWith('base-ui/packages/react/src/') && !/\.(?:test|spec)\.[jt]sx?$/.test(file));
const ssrOriginalComponentModules = solidSsr.sourceModules.filter((file) =>
  file.startsWith('base-ui/packages/react/src/') && file.endsWith('.tsx') &&
  !/\.(?:test|spec)\.tsx$/.test(file));
const ssrNativeImplementation = solidSsr.sourceModules.filter((file) =>
  file.startsWith('base-ui/packages/solid/src/'));
if (!ssrReferenceImplementation.includes('base-ui/packages/react/src/slider/root/SliderRoot.tsx')) {
  errors.push('React SSR did not load the original Slider.Root implementation.');
}
if (ssrOriginalComponentModules.length) errors.push('Solid SSR loaded an original React component implementation.');
const ssrUnexpectedOriginal = unexpectedOriginalReactModules(
  solidSsr.sourceModules, selectedSsrFixtureModules.slider);
if (ssrUnexpectedOriginal.length) errors.push(`Solid SSR loaded unexpected original React source: ${ssrUnexpectedOriginal.join(', ')}`);
if (!ssrNativeImplementation.includes('base-ui/packages/solid/src/controls.tsx') ||
    (solidSsr.nativeExecutions['base-ui/packages/solid/src/controls.tsx#Slider.Root'] ?? 0) < 1) {
  errors.push('Solid SSR did not execute the native Slider.Root implementation.');
}
const sliderCases = solidSsr.nativeCaseExecutions.filter((row) =>
  relative(root, row.testPath).replaceAll('\\', '/') === ssrTestFile &&
  row.fullName.replaceAll(' > ', ' ') === ssrIdentity[0]);
if (sliderCases.length !== 1 ||
    !(sliderCases[0].nativeExecutions?.['base-ui/packages/solid/src/controls.tsx#Slider.Root'] > 0)) {
  errors.push('The selected Solid Slider SSR case did not execute native Slider.Root.');
}

const output = {
  schemaVersion: 1,
  command: 'npm run verify:dual',
  startedAt,
  finishedAt: new Date().toISOString(),
  success: errors.length === 0,
  selectedFiles: selectedTests,
  react: {
    ...react,
    report: undefined,
    implementationModules: referenceImplementation,
    configuredRoute: '@base-ui/react/* -> base-ui/packages/react/src/*/index.ts',
  },
  solid: {
    ...solid,
    report: undefined,
    implementationModules: nativeImplementation,
    originalImplementationModules: solidOriginalImplementation,
    configuredRoute: '@base-ui/react/* -> tooling/parity/*-route.ts -> base-ui/packages/solid/src/*; merge-props -> base-ui/packages/solid/src/merge-props/index.ts',
  },
  suites: Object.fromEntries(selectedTests.map((file) => [file, {
    react: Object.fromEntries(reactSuites.get(file)?.assertions ?? []),
    solid: Object.fromEntries(solidSuites.get(file)?.assertions ?? []),
  }])),
  comparison,
  ssr: {
    selectedFile: ssrTestFile,
    selectedAssertion: ssrIdentity[0] ?? null,
    react: {
      ...reactSsr,
      report: undefined,
      implementationModules: ssrReferenceImplementation,
    },
    solid: {
      ...solidSsr,
      report: undefined,
      implementationModules: ssrNativeImplementation,
      originalReactComponentModules: ssrOriginalComponentModules,
      otherOriginalReactModules: solidSsr.sourceModules.filter((file) =>
        file.startsWith('base-ui/packages/react/src/') && !/\.(?:test|spec)\.[jt]sx?$/.test(file)),
    },
    filteredAssertionsPerRun: reactSsr.counts.skipped,
    comparison: ssrComparison,
  },
  originalGuard: { beforeExitCode: guardBefore.exitCode, afterExitCode: guardAfter.exitCode },
  inputsBefore,
  inputsAfter,
  errors,
};
writeFileSync(resolve(artifacts, 'unchanged-selected-dual-evidence.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  success: output.success,
  suites: selectedTests.length,
  react: react.counts,
  solid: solid.counts,
  sharedSkips: skipCount(comparison.sharedSkips),
  referenceOnlySkips: skipCount(comparison.referenceOnlySkips),
  solidOnlySkips: skipCount(comparison.solidOnlySkips),
  mismatches: comparison.mismatches.length,
  ssr: {
    reactPassed: reactSsr.counts.passed,
    solidPassed: solidSsr.counts.passed,
    filteredPerRun: reactSsr.counts.skipped,
    mismatches: ssrComparison.mismatches.length,
    selectedAssertion: ssrIdentity[0] ?? null,
  },
  sourceHashStable: inputsBefore.digest === inputsAfter.digest,
  originalGuard: output.originalGuard,
  errors,
  evidence: 'artifacts/unchanged-selected-dual-evidence.json',
}, null, 2));
process.exitCode = output.success ? 0 : 1;
