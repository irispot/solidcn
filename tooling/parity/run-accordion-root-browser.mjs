import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTestFile = 'base-ui/packages/react/src/accordion/root/AccordionRoot.test.tsx';
const nativeFile = 'base-ui/packages/solid/src/structure.tsx';
const selectedCase = 'preserves generated part associations during hydration';
const artifact = resolve(root, 'artifacts/unchanged-accordion-root-browser-comparison.json');
const hydrationArtifact = resolve(root, 'artifacts/unchanged-accordion-root-hydration-comparison.json');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-accordion-root-browser-'));
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

function runBrowser(mode) {
  const config = mode === 'react'
    ? 'tooling/parity/reference-accordion-root-browser.config.ts'
    : 'tooling/parity/dual-accordion-root-browser-runtime-solid.config.ts';
  const reportFile = resolve(temporary, `${mode}.json`);
  const result = spawnSync(process.execPath, [browserVitest, 'run', '--config', config,
    '--reporter=default', '--reporter=json', `--outputFile=${reportFile}`], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(reportFile, 'utf8')); }
  catch {
    errors.push(`${mode} produced no browser JSON report (exit ${result.status}): ${output.slice(-1000)}`);
    report = { testResults: [] };
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0]?.name ?? '') !== originalTestFile)
    errors.push(`${mode} did not report the unchanged Accordion Root file.`);
  return {
    exitCode: result.status,
    counts: { total: report.numTotalTests ?? 0, passed: report.numPassedTests ?? 0,
      failed: report.numFailedTests ?? 0, skipped: report.numPendingTests ?? 0 },
    assertions: (suites[0]?.assertionResults ?? []).map((item) => ({
      fullName: item.fullName, status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
    })),
    sourceModules: [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1]))
      .filter((item) => item.mode === mode).map((item) => item.file),
    nativeExecutions: Object.fromEntries(
      [...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
        .flatMap((match) => Object.entries(JSON.parse(match[1]))),
    ),
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
  };
}

try {
  guard('Before');
  const before = parityInputHashes();
  const react = runBrowser('react');
  const solid = runBrowser('solid');
  const hydrationRun = spawnSync(process.execPath, ['tooling/parity/run-accordion-root-hydration.mjs'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  let hydration;
  try { hydration = JSON.parse(readFileSync(hydrationArtifact, 'utf8')); }
  catch { errors.push('The genuine Solid SSR/hydration report is missing.'); }
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  for (const [mode, result] of [['react', react], ['solid', solid]]) {
    const expectedPassed = mode === 'react' ? 50 : 49;
    const expectedSkipped = mode === 'react' ? 0 : 1;
    if (result.counts.total !== 50 || result.assertions.length !== 50 ||
        result.counts.passed !== expectedPassed || result.counts.failed !== 0 ||
        result.counts.skipped !== expectedSkipped)
      errors.push(`${mode} browser route did not pass its expected unchanged-test inventory.`);
    if (result.exitCode !== 0 || result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${mode} browser runner failed or had an unhandled error.`);
    const skipped = result.assertions.filter((item) => item.status === 'skipped');
    if (skipped.length !== expectedSkipped || skipped.some((item) => !item.fullName.includes(selectedCase)))
      errors.push(`${mode} browser route skipped an unexpected assertion.`);
  }
  if (!react.sourceModules.includes('base-ui/packages/react/src/accordion/root/AccordionRoot.tsx'))
    errors.push('React did not load the pinned Accordion Root implementation.');
  const unexpected = unexpectedOriginalReactModules(solid.sourceModules, [
    'base-ui/packages/react/src/internals/reasons.ts',
    'base-ui/packages/react/src/internals/reason-parts.ts',
  ]);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sourceModules.includes(nativeFile) ||
      !solid.nativeExecutions[`${nativeFile}#Accordion.Root`])
    errors.push('Solid did not load and execute native Accordion.Root.');
  if (hydrationRun.status !== 0 || !hydration?.success ||
      hydration.react?.counts?.passed !== 1 || hydration.solid?.counts?.passed !== 1 ||
      hydration.inputsBefore !== before.digest || hydration.inputsAfter !== before.digest)
    errors.push('The complementary original native SSR/hydration assertion is not green on these inputs.');
  const reactByName = new Map(react.assertions.map((item) => [item.fullName, item]));
  const hydrationByName = new Map(hydration?.solid?.assertions?.map((item) => [item.fullName, item]) ?? []);
  const mismatches = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(item.fullName);
    if (reference?.status === 'passed' &&
        (item.status === 'passed' || item.fullName.includes(selectedCase) &&
         hydrationByName.get(item.fullName)?.status === 'passed')) return [];
    return [{ fullName: item.fullName, react: reference?.status ?? 'missing',
      solidBrowser: item.status, solidHydration: hydrationByName.get(item.fullName)?.status,
      solidError: item.error }];
  });
  if (mismatches.length) errors.push(`${mismatches.length} original assertion outcomes differ.`);
  const browserNames = react.assertions.map((item) => item.fullName);
  const nativeBrowserNames = solid.assertions.map((item) => item.fullName);
  const hydrationNames = hydration?.solid?.assertions?.map((item) => item.fullName) ?? [];
  if (JSON.stringify(browserNames) !== JSON.stringify(nativeBrowserNames) ||
      JSON.stringify(browserNames) !== JSON.stringify(hydrationNames))
    errors.push('Browser and SSR routes did not collect the same original 50-case inventory.');
  const completeInventory = react.assertions.filter((item) =>
    item.status === 'passed' && (solid.assertions.find((candidate) => candidate.fullName === item.fullName)?.status === 'passed' ||
      hydrationByName.get(item.fullName)?.status === 'passed')).length;
  if (completeInventory !== 50)
    errors.push(`Combined browser and SSR routes cover ${completeInventory}/50 assertions.`);
  const evidence = { success: errors.length === 0, originalTestFile,
    note: 'The browser route runs 49 native Solid runtime assertions. The one filtered case runs in a separate real Solid SSR/hydration route. Together they cover all 50 unchanged assertions.',
    react, solid, hydration: { success: Boolean(hydration?.success), artifact: relative(root, hydrationArtifact),
      reactPassed: hydration?.react?.counts?.passed, solidPassed: hydration?.solid?.counts?.passed },
    combinedAssertions: completeInventory, mismatches, inputsBefore: before.digest,
    inputsAfter: after.digest, errors };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    hydration: evidence.hydration, combinedAssertions: completeInventory,
    mismatches: mismatches.length, sourceHashStable: before.digest === after.digest,
    errors, artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
