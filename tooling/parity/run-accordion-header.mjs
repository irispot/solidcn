import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const file = 'base-ui/packages/react/src/accordion/header/AccordionHeader.test.tsx';
const artifact = resolve(root, 'artifacts/unchanged-accordion-header-comparison.json');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-accordion-header-'));
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
  const outputFile = resolve(temporary, `${mode}.json`);
  const config = `tooling/parity/${mode === 'react' ? 'reference' : 'dual'}-accordion-header-client${mode === 'solid' ? '-solid' : ''}.config.ts`;
  const result = spawnSync(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--reporter=default', '--reporter=json', `--outputFile=${outputFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(outputFile, 'utf8')); }
  catch {
    errors.push(`${mode} produced no JSON report (exit ${result.status}): ${output.slice(-1000)}`);
    report = { testResults: [] };
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0].name ?? '') !== file)
    errors.push(`${mode} did not report the exact unchanged AccordionHeader test file.`);
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
  const react = run('react');
  const solid = run('solid');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest) errors.push('Source or runner inputs changed during the run.');
  for (const [mode, result] of [['React', react], ['Solid', solid]])
    if (result.exitCode !== 0 || result.counts.total !== 16 || result.counts.passed !== 16 ||
        result.counts.failed !== 0 || result.counts.skipped !== 0 ||
        result.assertions.length !== 16 || result.unhandledErrors.length)
      errors.push(`${mode} did not pass all 16 original AccordionHeader assertions.`);
  if (!react.sources.includes('base-ui/packages/react/src/accordion/header/AccordionHeader.tsx'))
    errors.push('React did not load the pinned AccordionHeader implementation.');
  const unexpected = unexpectedOriginalReactModules(solid.sources);
  if (unexpected.length) errors.push(`Solid loaded original React implementation: ${unexpected.join(', ')}`);
  if (!solid.sources.includes('base-ui/packages/solid/src/structure.tsx') ||
      !solid.nativeExecutions['base-ui/packages/solid/src/structure.tsx#Accordion.Header'])
    errors.push('Solid did not execute native Accordion.Header.');
  const identities = (result) => result.assertions.map((item) => `${item.fullName}\u0000${item.status}`).sort();
  if (JSON.stringify(identities(react)) !== JSON.stringify(identities(solid)))
    errors.push('React and Solid assertion identities or results differ.');
  const evidence = { success: errors.length === 0, originalTest: file, react, solid,
    inputHashBefore: before.digest, inputHashAfter: after.digest, errors };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    nativeHeader: !!solid.nativeExecutions['base-ui/packages/solid/src/structure.tsx#Accordion.Header'],
    sourceHashStable: before.digest === after.digest, errors, artifact: relative(root, artifact) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
