import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  navigationSsrAssertions,
  navigationSsrTestFile,
  navigationSsrTestName,
} from './navigation-ssr-selected.mjs';
import { parityInputHashes } from './input-hashes.mjs';
import { selectedSsrFixtureModules, unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const artifacts = resolve(root, 'artifacts');
mkdirSync(artifacts, { recursive: true });
const outputPath = resolve(artifacts, 'unchanged-navigation-ssr-comparison.json');
writeFileSync(outputPath, JSON.stringify({ success: false, errors: ['Run did not complete.'] }));
const inputsBefore = parityInputHashes();

function command(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    exitCode: result.status,
    error: result.error?.message,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  };
}

function testRun(mode, config, auditMode = mode) {
  const name = `unchanged-navigation-${mode}-ssr`;
  const reportPath = `artifacts/${name}.json`;
  const logPath = `artifacts/${name}.log`;
  writeFileSync(resolve(root, reportPath), JSON.stringify({ success: false, testResults: [] }));
  const result = command([
    'node_modules/vitest/vitest.mjs', 'run', '--config', config,
    '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`,
  ]);
  writeFileSync(resolve(root, logPath), result.output);
  let report;
  try {
    report = JSON.parse(readFileSync(resolve(root, reportPath), 'utf8'));
  } catch (error) {
    report = { success: false, testResults: [], parseError: String(error) };
  }
  const sourceModules = [];
  for (const match of result.output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)) {
    const loaded = JSON.parse(match[1]);
    if (loaded.mode === auditMode) sourceModules.push(loaded.file);
  }
  const nativeExecutions = {};
  for (const match of result.output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)) {
    for (const [source, count] of Object.entries(JSON.parse(match[1]))) {
      nativeExecutions[source] = (nativeExecutions[source] ?? 0) + count;
    }
  }
  const nativeCaseExecutions = [...result.output.matchAll(/Native Solid case evidence: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]));
  const suites = (report.testResults ?? []).map((suite) => ({
    file: relative(root, suite.name).replaceAll('\\', '/'),
    status: suite.status,
    assertions: (suite.assertionResults ?? []).map(({ fullName, status, failureMessages }) => ({
      fullName, status, failureMessages,
    })),
  }));
  return {
    exitCode: result.exitCode,
    error: result.error,
    success: report.success === true,
    reportPath,
    logPath,
    counts: {
      files: suites.length,
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      skipped: report.numPendingTests,
      todo: report.numTodoTests,
    },
    suites,
    sourceModules: [...new Set(sourceModules)].sort(),
    nativeExecutions,
    nativeCaseExecutions,
  };
}

function assertionRows(run, errors, mode) {
  if (run.suites.length !== 1 || run.suites[0].file !== navigationSsrTestFile)
    errors.push(`${mode}: the suite file differs from ${navigationSsrTestFile}.`);
  const rows = run.suites.flatMap((suite) => suite.assertions);
  if (rows.length !== run.counts.total)
    errors.push(`${mode}: the report count differs from its assertion rows.`);
  const selected = rows.filter(({ fullName }) =>
    fullName.includes(navigationSsrTestName) &&
    navigationSsrAssertions.some((name) => fullName.endsWith(name)));
  if (selected.length !== navigationSsrAssertions.length ||
      new Set(selected.map(({ fullName }) => fullName)).size !== navigationSsrAssertions.length)
    errors.push(`${mode}: expected exactly two distinct Navigation Menu SSR assertions.`);
  if (rows.some((row) => !selected.includes(row) && !['pending', 'skipped'].includes(row.status)))
    errors.push(`${mode}: a test outside the SSR selection ran.`);
  if (run.counts.passed + run.counts.failed !== 2 ||
      run.counts.skipped !== rows.length - 2 || run.counts.todo !== 0)
    errors.push(`${mode}: the filtered counts differ from two active assertions.`);
  const sortRows = (items) => items.map(({ fullName, status }) => ({ fullName, status }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.status.localeCompare(b.status));
  return { selected: sortRows(selected), all: sortRows(rows) };
}

const errors = [];
const guardBefore = command(['tooling/parity/preserve.mjs', 'verify']);
if (guardBefore.exitCode !== 0) errors.push('The original-file guard failed before the runs.');
const react = testRun('react', 'tooling/parity/reference-navigation-ssr.config.ts');
const solid = testRun('solid', 'tooling/parity/dual-navigation-ssr-solid.config.ts');

const reactSelected = assertionRows(react, errors, 'React');
const solidSelected = assertionRows(solid, errors, 'Solid');
if (JSON.stringify(reactSelected.selected) !== JSON.stringify(solidSelected.selected))
  errors.push('The selected full names or statuses differ between React and Solid.');
if (JSON.stringify(reactSelected.all) !== JSON.stringify(solidSelected.all))
  errors.push('The full assertion inventories differ, including filtered rows.');
for (const [mode, run] of [['React', react], ['Solid', solid]]) {
  if (run.exitCode !== 0 || !run.success || run.counts.failed !== 0)
    errors.push(`${mode}: the SSR run did not pass.`);
  if (run.error) errors.push(`${mode}: ${run.error}`);
}
if (!react.sourceModules.includes('base-ui/packages/react/src/navigation-menu/root/NavigationMenuRoot.tsx'))
  errors.push('React did not load the original Navigation Menu root.');
const unexpectedOriginal = unexpectedOriginalReactModules(
  solid.sourceModules, selectedSsrFixtureModules.navigation);
if (unexpectedOriginal.length)
  errors.push(`Solid loaded unexpected original React source: ${unexpectedOriginal.join(', ')}`);
if (!solid.sourceModules.includes('base-ui/packages/solid/src/overlays.tsx') ||
    !(solid.nativeExecutions['base-ui/packages/solid/src/overlays.tsx#NavigationMenu.Root'] > 0))
  errors.push('Solid did not execute the native Navigation Menu root.');
for (const name of navigationSsrAssertions) {
  const cases = solid.nativeCaseExecutions.filter((row) =>
    relative(root, row.testPath).replaceAll('\\', '/') === navigationSsrTestFile &&
    row.fullName.endsWith(name));
  if (cases.length !== 1 ||
      !(cases[0].nativeExecutions?.['base-ui/packages/solid/src/overlays.tsx#NavigationMenu.Root'] > 0) ||
      !(cases[0].nativeExecutions?.['base-ui/packages/solid/src/overlays.tsx#NavigationMenu.Content'] > 0)) {
    errors.push(`Solid did not execute native Navigation Menu parts in: ${name}`);
  }
}
const hiddenFile = 'tooling/parity/navigation-hidden-probe.test.ts';
const hiddenReact = testRun('react-hidden', 'tooling/parity/reference-navigation-hidden.config.ts', 'react');
const hiddenSolid = testRun('solid-hidden', 'tooling/parity/dual-navigation-hidden-solid.config.ts', 'solid');
function hiddenRow(run, mode) {
  if (run.exitCode !== 0 || !run.success || run.counts.files !== 1 ||
      run.suites[0]?.file !== hiddenFile || run.counts.passed !== 1 ||
      run.counts.failed !== 0 || run.counts.skipped !== 0 || run.counts.total !== 1 ||
      run.suites[0].assertions.length !== 1 ||
      run.suites[0].assertions[0].status !== 'passed') {
    errors.push(`${mode}: the supplemental hidden-state check did not pass exactly once.`);
  }
  const { fullName, status } = run.suites[0]?.assertions[0] ?? {};
  return { fullName, status };
}
const hiddenReactRow = hiddenRow(hiddenReact, 'React');
const hiddenSolidRow = hiddenRow(hiddenSolid, 'Solid');
if (JSON.stringify(hiddenReactRow) !== JSON.stringify(hiddenSolidRow))
  errors.push('The supplemental hidden-state assertion differs between React and Solid.');
if (!hiddenReact.sourceModules.includes('base-ui/packages/react/src/navigation-menu/root/NavigationMenuRoot.tsx'))
  errors.push('The React hidden-state probe missed the original Navigation Menu root.');
const hiddenUnexpectedOriginal = unexpectedOriginalReactModules(
  hiddenSolid.sourceModules, selectedSsrFixtureModules.navigation);
if (hiddenUnexpectedOriginal.length ||
    !hiddenSolid.sourceModules.includes('base-ui/packages/solid/src/overlays.tsx'))
  errors.push(`The Solid hidden-state probe used an unexpected source route: ${hiddenUnexpectedOriginal.join(', ')}`);
const hiddenCases = hiddenSolid.nativeCaseExecutions.filter((row) =>
  relative(root, row.testPath).replaceAll('\\', '/') === hiddenFile &&
  row.fullName === hiddenSolidRow.fullName);
if (hiddenCases.length !== 1 ||
    !(hiddenCases[0].nativeExecutions?.['base-ui/packages/solid/src/overlays.tsx#NavigationMenu.Content'] > 0))
  errors.push('The Solid hidden-state probe did not execute native Navigation Menu Content.');
const guardAfter = command(['tooling/parity/preserve.mjs', 'verify']);
if (guardAfter.exitCode !== 0) errors.push('The original-file guard failed after the runs.');
const inputsAfter = parityInputHashes();
if (inputsBefore.digest !== inputsAfter.digest)
  errors.push('Source, dependency, or parity runner inputs changed during verification.');

const output = {
  schemaVersion: 1,
  command: 'node tooling/parity/run-navigation-ssr.mjs',
  selectedFile: navigationSsrTestFile,
  selectedGroup: navigationSsrTestName,
  react: { ...react, selected: reactSelected.selected },
  solid: { ...solid, selected: solidSelected.selected },
  supplementalHidden: {
    sourceFile: hiddenFile,
    react: { ...hiddenReact, selected: hiddenReactRow },
    solid: { ...hiddenSolid, selected: hiddenSolidRow },
  },
  allAssertionRowsMatch: JSON.stringify(reactSelected.all) === JSON.stringify(solidSelected.all),
  inputsBefore,
  inputsAfter,
  errors,
  success: errors.length === 0,
};
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({
  success: output.success,
  react: { counts: react.counts, selected: reactSelected.selected },
  solid: { counts: solid.counts, selected: solidSelected.selected },
  allAssertionRowsMatch: output.allAssertionRowsMatch,
  supplementalHidden: {
    reactPassed: hiddenReact.counts.passed,
    solidPassed: hiddenSolid.counts.passed,
    sameAssertion: JSON.stringify(hiddenReactRow) === JSON.stringify(hiddenSolidRow),
  },
  sourceHashStable: inputsBefore.digest === inputsAfter.digest,
  errors,
  report: relative(root, outputPath),
}, null, 2));
if (errors.length) process.exitCode = 1;
