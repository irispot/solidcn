import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTestFile = 'base-ui/packages/react/src/accordion/root/AccordionRoot.test.tsx';
const selectedCase = 'preserves generated part associations during hydration';
const artifact = resolve(root, 'artifacts/unchanged-accordion-root-hydration-comparison.json');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-accordion-root-hydration-'));
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
    ? 'tooling/parity/reference-accordion-root-hydration.config.ts'
    : 'tooling/parity/dual-accordion-root-hydration-solid.config.ts';
  const reportFile = resolve(temporary, `${mode}.json`);
  const processResult = spawnSync(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--reporter=default', '--reporter=json', `--outputFile=${reportFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${processResult.stdout ?? ''}\n${processResult.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(reportFile, 'utf8')); }
  catch {
    errors.push(`${mode} produced no JSON report (exit ${processResult.status}): ${output.slice(-1000)}`);
    report = { testResults: [] };
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0]?.name ?? '') !== originalTestFile)
    errors.push(`${mode} did not report the unchanged Accordion Root file.`);
  return {
    exitCode: processResult.status,
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
    ssrEvidence: [...output.matchAll(/Native Solid Accordion SSR evidence: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1])),
    hydrationEvidenceCount: output.match(/Native Solid hydration evidence:/g)?.length ?? 0,
    identityEvidence: [...output.matchAll(/Native Solid Accordion node identity: (\d+)/g)]
      .map((match) => Number(match[1])),
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
  };
}

try {
  guard('Before');
  const before = parityInputHashes();
  const react = run('react');
  const solid = run('solid');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest)
    errors.push('Source, dependency, or parity runner input changed during the run.');
  for (const [mode, result] of [['react', react], ['solid', solid]]) {
    if (result.counts.total !== 50 || result.assertions.length !== 50)
      errors.push(`${mode} did not load the complete original 50-case inventory.`);
    const selected = result.assertions.filter((item) => item.fullName.includes(selectedCase));
    if (selected.length !== 1 || selected[0].status !== 'passed')
      errors.push(`${mode} did not pass the original hydration assertion.`);
    if (result.counts.passed !== 1 || result.counts.failed !== 0 || result.counts.skipped !== 49)
      errors.push(`${mode} has unexpected selected-assertion counts.`);
    if (result.exitCode !== 0 || result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${mode} hydration runner failed or had an unhandled error.`);
  }
  if (!react.sourceModules.includes('base-ui/packages/react/src/accordion/root/AccordionRoot.tsx'))
    errors.push('React did not load the pinned Accordion Root implementation.');
  const unexpected = unexpectedOriginalReactModules(solid.sourceModules, [
    'base-ui/packages/react/src/internals/reasons.ts',
    'base-ui/packages/react/src/internals/reason-parts.ts',
  ]);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sourceModules.includes('base-ui/packages/solid/src/structure.tsx') ||
      !solid.nativeExecutions['base-ui/packages/solid/src/structure.tsx#Accordion.Root'])
    errors.push('Solid did not load and execute native Accordion.Root.');
  if (solid.ssrEvidence.length !== 1 || solid.ssrEvidence[0].hydrationKeys < 1 ||
      solid.ssrEvidence[0].triggerControls !== solid.ssrEvidence[0].panelId ||
      solid.ssrEvidence[0].panelLabelledBy !== solid.ssrEvidence[0].triggerId ||
      solid.hydrationEvidenceCount !== 1 || solid.identityEvidence.length !== 1 ||
      solid.identityEvidence[0] < 1)
    errors.push('Solid did not prove native SSR associations, hydration, and retained server nodes.');
  const reactByName = new Map(react.assertions.map((item) => [item.fullName, item]));
  const mismatches = solid.assertions.flatMap((item) => {
    const reference = reactByName.get(item.fullName);
    return reference?.status === item.status ? [] : [{ fullName: item.fullName,
      react: reference?.status ?? 'missing', solid: item.status, solidError: item.error }];
  });
  if (mismatches.length) errors.push(`${mismatches.length} assertion statuses differ.`);
  const evidence = { success: errors.length === 0, originalTestFile, selectedCase,
    note: 'This separate route runs the original browser-only SSR/hydration case in a JSDOM host with real Solid server and client graphs. Other assertions are filtered, not parity skips.',
    react, solid, mismatches, inputsBefore: before.digest, inputsAfter: after.digest, errors };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    nativeSsr: solid.ssrEvidence.length === 1, nativeHydration: solid.hydrationEvidenceCount === 1,
    retainedServerNodes: solid.identityEvidence.length === 1,
    sourceHashStable: before.digest === after.digest, errors, artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
