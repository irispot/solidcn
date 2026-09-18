import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTestFile = 'shadcn-ui/packages/react/src/message-scroller/geometry.test.ts';
const nativeSource = resolve(root, 'shadcn-ui/packages/solid/src/internal/message-scroller/geometry.ts');
const originalSource = resolve(root, 'shadcn-ui/packages/react/src/message-scroller/geometry.ts');
const reportPath = resolve(root, 'artifacts/unchanged-shadcn-geometry-comparison.json');
const temp = mkdtempSync(resolve(tmpdir(), 'solid-cn-shadcn-geometry-'));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const outputPath = resolve(temp, `${mode}.json`);
  const result = spawnSync(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--reporter=default', '--reporter=json', `--outputFile=${outputPath}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try {
    report = JSON.parse(readFileSync(outputPath, 'utf8'));
  } catch {
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numPendingTests: 0 };
    errors.push(`${mode} produced no JSON report (exit ${result.status}).`);
  }
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0].name) !== originalTestFile)
    errors.push(`${mode} did not load the exact unchanged geometry test.`);
  return {
    exitCode: result.status,
    counts: {
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      skipped: report.numPendingTests,
    },
    assertions: (suites[0]?.assertionResults ?? []).map((item) => ({
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
    })),
    routedToNative: output.includes(`Solid geometry route: ${nativeSource}`),
    loadedNative: output.includes(`Solid geometry source loaded: ${nativeSource}`),
    outputOnError: result.status ? output.slice(-3000) : undefined,
  };
}

try {
  guard('Before');
  const before = parityInputHashes();
  const react = run('react', 'tooling/parity/reference-shadcn-geometry.config.ts');
  const solid = run('solid', 'tooling/parity/dual-shadcn-geometry-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest) errors.push('Source or runner inputs changed during the run.');
  if (readFileSync(nativeSource).compare(readFileSync(originalSource)) !== 0)
    errors.push('The Solid-owned geometry source is not an exact copy of the pinned original.');
  for (const [mode, result] of [['React', react], ['Solid', solid]]) {
    if (result.exitCode !== 0 || result.counts.failed !== 0) errors.push(`${mode} geometry assertions fail.`);
    if (result.assertions.length !== 17 || result.counts.total !== 17 ||
        result.counts.passed !== 17 || result.counts.skipped !== 0)
      errors.push(`${mode} did not pass all 17 original geometry assertions.`);
  }
  if (!solid.routedToNative || !solid.loadedNative)
    errors.push('The unchanged test did not resolve and load the Solid-owned geometry source.');
  const identities = (result) => result.assertions.map((item) => `${item.fullName}\u0000${item.status}`).sort();
  if (JSON.stringify(identities(react)) !== JSON.stringify(identities(solid)))
    errors.push('React and Solid assertion identities or results differ.');
  const evidence = {
    success: errors.length === 0,
    originalTestFile,
    exactNativeSourceCopy: readFileSync(nativeSource).compare(readFileSync(originalSource)) === 0,
    react,
    solid,
    inputHashBefore: before.digest,
    inputHashAfter: after.digest,
    errors,
  };
  writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    react: react.counts,
    solid: solid.counts,
    nativeRoute: solid.routedToNative && solid.loadedNative,
    sourceHashStable: before.digest === after.digest,
    errors,
    artifact: relative(root, reportPath),
  }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
