import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const folder = mkdtempSync(resolve(tmpdir(), 'solid-cn-accordion-parts-'));
const artifact = resolve(root, 'artifacts/unchanged-accordion-parts-comparison.json');
const originalFiles = [
  'base-ui/packages/react/src/accordion/header/AccordionHeader.test.tsx',
  'base-ui/packages/react/src/accordion/item/AccordionItem.test.tsx',
  'base-ui/packages/react/src/accordion/panel/AccordionPanel.test.tsx',
  'base-ui/packages/react/src/accordion/trigger/AccordionTrigger.test.tsx',
];
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, environment) {
  const config = environment === 'client'
    ? `tooling/parity/${mode === 'react' ? 'reference' : 'dual'}-accordion-parts-client${mode === 'solid' ? '-solid' : ''}.config.ts`
    : `tooling/parity/${mode === 'react' ? 'reference' : 'dual'}-accordion-panel-ssr${mode === 'solid' ? '-solid' : ''}.config.ts`;
  const outputFile = resolve(folder, `${mode}-${environment}.json`);
  const result = spawnSync(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--reporter=default', '--reporter=json', `--outputFile=${outputFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(outputFile, 'utf8')); }
  catch {
    errors.push(`${mode} ${environment} produced no JSON report (exit ${result.status}): ${output.slice(-1000)}`);
    report = { testResults: [] };
  }
  const suites = report.testResults ?? [];
  const expectedFiles = environment === 'client' ? originalFiles : [originalFiles[2]];
  if (JSON.stringify(suites.map((suite) => relative(root, suite.name)).sort()) !== JSON.stringify([...expectedFiles].sort()))
    errors.push(`${mode} ${environment} did not report the exact unchanged Accordion test files.`);
  return {
    exitCode: result.status,
    counts: { total: report.numTotalTests ?? 0, passed: report.numPassedTests ?? 0,
      failed: report.numFailedTests ?? 0, skipped: report.numPendingTests ?? 0 },
    assertions: suites.flatMap((suite) => suite.assertionResults ?? []).map((item) => ({
      fullName: item.fullName, status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
    })),
    sources: [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1])).filter((item) => item.mode === mode).map((item) => item.file),
    nativeExecutions: Object.fromEntries([...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
      .flatMap((match) => Object.entries(JSON.parse(match[1])))),
    unhandledErrors: report.unhandledErrors ?? [],
  };
}

try {
  guard('Before');
  const before = parityInputHashes();
  const results = {
    reactClient: run('react', 'client'),
    solidClient: run('solid', 'client'),
    reactSsr: run('react', 'ssr'),
    solidSsr: run('solid', 'ssr'),
  };
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest) errors.push('Source or runner inputs changed during the run.');
  for (const [name, result] of Object.entries(results)) {
    const expected = name.endsWith('Client')
      ? { total: 73, passed: 69, skipped: 4 }
      : { total: 21, passed: 1, skipped: 20 };
    if (result.exitCode !== 0 || result.counts.total !== expected.total ||
        result.counts.passed !== expected.passed || result.counts.failed !== 0 ||
        result.counts.skipped !== expected.skipped ||
        result.assertions.length !== expected.total || result.unhandledErrors.length)
      errors.push(`${name} did not match the expected unchanged-test inventory and passes.`);
  }
  for (const environment of ['Client', 'Ssr']) {
    const react = results[`react${environment}`];
    const solid = results[`solid${environment}`];
    const identity = (result) => result.assertions.map((item) => `${item.fullName}\u0000${item.status}`).sort();
    if (JSON.stringify(identity(react)) !== JSON.stringify(identity(solid)))
      errors.push(`${environment} React and Solid assertion identities or results differ.`);
    const unexpected = unexpectedOriginalReactModules(solid.sources);
    if (unexpected.length) errors.push(`${environment} Solid loaded original React implementation: ${unexpected.join(', ')}`);
    if (!solid.sources.includes('base-ui/packages/solid/src/structure.tsx') ||
        !solid.nativeExecutions['base-ui/packages/solid/src/structure.tsx#Accordion.Panel'])
      errors.push(`${environment} Solid did not execute native Accordion.Panel.`);
  }
  const evidence = { success: errors.length === 0, originalFiles, results,
    inputHashBefore: before.digest, inputHashAfter: after.digest, errors };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success,
    counts: Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.counts])),
    sourceHashStable: before.digest === after.digest, errors, artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(folder, { recursive: true, force: true });
}
