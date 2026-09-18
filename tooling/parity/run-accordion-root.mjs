import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const runtimeFile = 'base-ui/packages/react/src/accordion/root/AccordionRoot.test.tsx';
const typeFile = 'base-ui/packages/react/src/accordion/root/AccordionRoot.spec.tsx';
const nativeFile = 'base-ui/packages/solid/src/structure.tsx';
const artifact = resolve(root, 'artifacts/unchanged-accordion-root-diagnostic.json');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-accordion-root-'));
const errors = [];
const watchedFiles = [
  runtimeFile, typeFile, nativeFile,
  'tooling/parity/accordion-route.ts',
  'tooling/parity/fixture-renderer.ts',
  'tooling/parity/fixture-runtime.ts',
  'tooling/parity/select-client-fixture-entry.ts',
  'tooling/parity/dual-accordion-root-client-solid.config.ts',
  'tooling/parity/reference-accordion-root-client.config.ts',
  'tooling/parity/accordion-root-react-spec.tsconfig.json',
  'tooling/parity/accordion-root-solid-spec.tsconfig.json',
];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function hashes() {
  return Object.fromEntries(watchedFiles.map((file) => [
    file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex'),
  ]));
}

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    errors.push(`${stage}: original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode) {
  const reportFile = resolve(temporary, `${mode}.json`);
  const config = mode === 'react'
    ? 'tooling/parity/reference-accordion-root-client.config.ts'
    : 'tooling/parity/dual-accordion-root-client-solid.config.ts';
  const process = spawnSync(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--reporter=default', '--reporter=json', `--outputFile=${reportFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${process.stdout ?? ''}\n${process.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(reportFile, 'utf8')); }
  catch {
    errors.push(`${mode}: no JSON report (exit ${process.status}): ${output.slice(-1200)}`);
    report = { testResults: [] };
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0].name ?? '') !== runtimeFile)
    errors.push(`${mode}: did not report the exact unchanged AccordionRoot runtime file.`);
  const assertions = suites.flatMap((suite) => suite.assertionResults ?? []).map((item) => ({
    fullName: item.fullName,
    status: item.status,
    error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
  }));
  return {
    exitCode: process.status,
    counts: {
      total: report.numTotalTests ?? 0, passed: report.numPassedTests ?? 0,
      failed: report.numFailedTests ?? 0, skipped: report.numPendingTests ?? 0,
    },
    assertions,
    sources: [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
      .map((match) => JSON.parse(match[1])).filter((item) => item.mode === mode).map((item) => item.file),
    nativeExecutions: Object.fromEntries([...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
      .flatMap((match) => Object.entries(JSON.parse(match[1])))),
    unhandledErrors: report.unhandledErrors ?? [],
  };
}

function runSpec(mode) {
  const config = `tooling/parity/accordion-root-${mode}-spec.tsconfig.json`;
  const process = spawnSync(resolve(root, 'node_modules/.bin/tsc'), [
    '--project', config, '--pretty', 'false',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return {
    exitCode: process.status,
    diagnostics: `${process.stdout ?? ''}\n${process.stderr ?? ''}`.split('\n')
      .map((line) => line.trim()).filter(Boolean),
  };
}

try {
  guard('Before');
  const before = hashes();
  const react = run('react');
  const solid = run('solid');
  const reactSpec = runSpec('react');
  const solidSpec = runSpec('solid');
  const after = hashes();
  guard('After');
  if (JSON.stringify(before) !== JSON.stringify(after))
    errors.push('Watched source or runner input changed during the run.');
  if (react.exitCode !== 0 || react.counts.total !== 50 || react.counts.failed !== 0)
    errors.push('React baseline did not pass all runnable original cases.');
  if (solid.exitCode !== 0 || solid.counts.failed !== 0)
    errors.push('Solid did not pass all runnable original cases.');
  if (reactSpec.exitCode !== 0)
    errors.push('The pinned React AccordionRoot type spec did not compile.');
  if (solidSpec.exitCode !== 0)
    errors.push('The unchanged AccordionRoot type spec did not compile against native Solid types.');
  if (react.counts.total !== solid.counts.total || react.assertions.length !== solid.assertions.length)
    errors.push('React and Solid did not collect the same number of original cases.');
  const caseNames = (result) => result.assertions.map((item) => item.fullName).sort();
  const skippedNames = (result) => result.assertions
    .filter((item) => item.status === 'pending').map((item) => item.fullName).sort();
  if (JSON.stringify(caseNames(react)) !== JSON.stringify(caseNames(solid)))
    errors.push('React and Solid case identities differ.');
  if (JSON.stringify(skippedNames(react)) !== JSON.stringify(skippedNames(solid)))
    errors.push('React and Solid original skip identities differ.');
  if (!react.sources.includes('base-ui/packages/react/src/accordion/root/AccordionRoot.tsx'))
    errors.push('React did not load the pinned AccordionRoot implementation.');
  const unexpected = unexpectedOriginalReactModules(solid.sources, [
    'base-ui/packages/react/src/internals/reasons.ts',
    'base-ui/packages/react/src/internals/reason-parts.ts',
  ]);
  if (unexpected.length)
    errors.push(`Solid loaded original React implementation modules: ${unexpected.join(', ')}`);
  if (!solid.sources.includes(nativeFile) ||
      !solid.nativeExecutions[`${nativeFile}#Accordion.Root`])
    errors.push('Solid did not execute native Accordion.Root.');
  const evidence = {
    success: errors.length === 0,
    originalRuntimeTest: runtimeFile,
    originalTypeSpec: {
      file: typeFile,
      sha256: before[typeFile],
      assertionCount: (readFileSync(resolve(root, typeFile), 'utf8').match(/\bexpectType</g) ?? []).length,
      note: 'Type-only file; TypeScript checks its unchanged assertions against each public component route.',
      react: reactSpec,
      solid: solidSpec,
    },
    react, solid, inputHashesBefore: before, inputHashesAfter: after, errors,
  };
  writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    react: react.counts,
    solid: solid.counts,
    nativeRoot: solid.nativeExecutions[`${nativeFile}#Accordion.Root`] ?? 0,
    sameCases: JSON.stringify(caseNames(react)) === JSON.stringify(caseNames(solid)),
    sameSkips: JSON.stringify(skippedNames(react)) === JSON.stringify(skippedNames(solid)),
    typeSpec: { react: reactSpec.exitCode, solid: solidSpec.exitCode,
      solidDiagnostics: solidSpec.diagnostics.length },
    errors,
    artifact: relative(root, artifact),
  }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
